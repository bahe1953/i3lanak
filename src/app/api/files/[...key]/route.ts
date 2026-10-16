import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canRead, readImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Sert un fichier privé après vérification des droits.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { key: parts } = await params;
  const key = parts.join("/");
  if (!canRead(user, key)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const file = await readImage(key);
  if (!file) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  return new Response(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
