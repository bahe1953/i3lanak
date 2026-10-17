import { put, get, del } from "@vercel/blob";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SafeUser } from "@/lib/auth";

// Les fichiers sont privés. En base on stocke une « clé » du type
//   u/<id du propriétaire>/<dossier>/<uuid>.<ext>
// et on les sert via /api/files/<clé>, qui vérifie les droits.
//
// - Sur Vercel : Vercel Blob en accès privé (variable BLOB_READ_WRITE_TOKEN).
// - En local sans jeton : dossier .data/uploads (hors de public/, donc non exposé).

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // limite Vercel : 4,5 Mo par requête

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const FOLDERS = ["photos", "logos", "posters", "payments", "proofs"] as const;
export type Folder = (typeof FOLDERS)[number];

const KEY_RE = /^u\/[0-9a-f-]{36}\/(photos|logos|posters|payments|proofs)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function localRoot() {
  return path.join(process.cwd(), ".data", "uploads");
}

export class StorageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Vérifie la signature binaire : on ne se fie pas au type annoncé par le navigateur. */
function sniffType(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

export async function saveImage(ownerId: string, folder: Folder, file: File): Promise<string> {
  if (file.size === 0) throw new StorageError("Fichier vide.");
  if (file.size > MAX_UPLOAD_BYTES) throw new StorageError("Fichier trop lourd (4 Mo maximum).", 413);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buf);
  if (!type || !ALLOWED[type]) throw new StorageError("Format non accepté : JPEG, PNG ou WebP uniquement.", 415);

  const key = `u/${ownerId}/${folder}/${randomUUID()}.${ALLOWED[type]}`;

  if (blobEnabled()) {
    await put(key, buf, { access: "private", contentType: type, addRandomSuffix: false });
  } else {
    if (process.env.VERCEL) {
      throw new StorageError("Stockage non configuré : ajoutez un Blob store au projet Vercel.", 503);
    }
    const target = path.join(localRoot(), key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buf);
  }
  return key;
}

export function isValidKey(key: string) {
  return KEY_RE.test(key);
}

export function ownerOfKey(key: string) {
  return key.split("/")[1];
}

/** Équipe IT-RIM : accès à tout. Client : uniquement à ses propres fichiers. */
export function canRead(user: SafeUser, key: string) {
  if (!isValidKey(key)) return false;
  if (user.role === "admin" || user.role === "operator") return true;
  return ownerOfKey(key) === user.id;
}

export async function readImage(key: string): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  if (!isValidKey(key)) return null;
  const ext = key.split(".").pop()!;
  const contentType = Object.entries(ALLOWED).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  if (blobEnabled()) {
    const res = await get(key, { access: "private" });
    if (!res || !res.stream) return null;
    return { body: res.stream, contentType };
  }
  try {
    return { body: await readFile(path.join(localRoot(), key)), contentType };
  } catch {
    return null;
  }
}

export async function deleteImage(key: string) {
  if (!isValidKey(key)) return;
  try {
    if (blobEnabled()) await del(key);
    else await unlink(path.join(localRoot(), key));
  } catch {
    // fichier déjà absent : rien à faire
  }
}

export function fileUrl(key: string | null | undefined) {
  return key ? `/api/files/${key}` : null;
}
