import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { FOLDERS, saveFile, StorageError, fileUrl, type Folder } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Envoi d'UN fichier (image, ou vidéo pour l'équipe) par requête (limite Vercel de 4,5 Mo par requête).
// Les images sont redimensionnées dans le navigateur avant l'envoi.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const limited = await rateLimit(`upload:${user.id}`, 60, 10 * 60);
  if (limited) return NextResponse.json({ error: "Trop d'envois, réessayez dans quelques minutes." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = String(form?.get("folder") ?? "photos") as Folder;
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  if (!FOLDERS.includes(folder)) return NextResponse.json({ error: "Dossier invalide." }, { status: 400 });
  // Seule l'équipe enregistre les affiches finales et les preuves de publication.
  if ((folder === "posters" || folder === "proofs" || folder === "videos") && user.role === "client") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  try {
    const key = await saveFile(user.id, folder, file);
    return NextResponse.json({ key, url: fileUrl(key) });
  } catch (e) {
    if (e instanceof StorageError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("upload failed", e);
    return NextResponse.json({ error: "Échec de l'envoi du fichier." }, { status: 500 });
  }
}
