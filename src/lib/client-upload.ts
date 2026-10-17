"use client";

// Redimensionne une image dans le navigateur puis l'envoie à /api/uploads.
// Les photos de téléphone (souvent 5 à 12 Mo) passent ainsi sous la limite de 4 Mo.

type Folder = "photos" | "logos" | "posters" | "payments" | "proofs" | "videos";

async function toBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export async function shrinkImage(file: Blob, maxSide: number, keepPng = false): Promise<Blob> {
  const bmp = await toBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const type = keepPng ? "image/png" : "image/jpeg";
  for (const q of [0.88, 0.8, 0.7, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
    if (blob && blob.size < 3.8 * 1024 * 1024) return blob;
  }
  throw new Error("Image trop lourde même après compression.");
}

export async function uploadBlob(blob: Blob, folder: Folder, name = "image"): Promise<{ key: string; url: string }> {
  const fd = new FormData();
  fd.append("file", blob, name);
  fd.append("folder", folder);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Échec de l'envoi");
  return data;
}

export async function uploadImage(file: File, folder: Folder) {
  const isLogo = folder === "logos";
  const blob = await shrinkImage(file, isLogo ? 800 : 2000, isLogo && file.type === "image/png");
  return uploadBlob(blob, folder, file.name);
}
