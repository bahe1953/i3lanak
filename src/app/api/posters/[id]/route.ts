import { NextResponse } from "next/server";
import { db } from "@/db";
import { posters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStaffUser, isAdmin } from "@/lib/auth";
import { posterUpdateSchema } from "@/lib/poster/schema";
import { firstError } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { withUrls } from "@/lib/poster/urls";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  return (await db.select().from(posters).where(eq(posters.id, id)).limit(1))[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const poster = await load((await params).id);
  if (!poster) return NextResponse.json({ error: "Affiche introuvable." }, { status: 404 });
  return NextResponse.json({ poster: withUrls(poster) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const { id } = await params;
  const poster = await load(id);
  if (!poster) return NextResponse.json({ error: "Affiche introuvable." }, { status: 404 });

  const parsed = posterUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const d = parsed.data;
  const next = { ...poster, ...d, publicationUrl: d.publicationUrl === "" ? null : d.publicationUrl ?? poster.publicationUrl };
  const now = new Date();
  const stamps: Partial<typeof posters.$inferInsert> = {};

  if (d.status && d.status !== poster.status) {
    // Règles honnêtes : on n'envoie/valide qu'une affiche réellement enregistrée,
    // et « Publiée » exige le lien de la publication.
    if (d.status !== "draft" && !next.imageKey && !next.videoKey) {
      return NextResponse.json({ error: "Enregistrez d'abord l'affiche ou la vidéo finale (bouton « Enregistrer »)." }, { status: 400 });
    }
    if (d.status === "published" && !next.publicationUrl) {
      return NextResponse.json({ error: "Ajoutez le lien de la publication avant de la marquer « Publiée »." }, { status: 400 });
    }
    if (d.status === "sent") stamps.sentAt = now;
    if (d.status === "validated") stamps.validatedAt = now;
    if (d.status === "published") stamps.publishedAt = now;
  }

  const [updated] = await db
    .update(posters)
    .set({ ...d, texts: d.texts as Record<string, string> | undefined, publicationUrl: next.publicationUrl, ...stamps, updatedAt: now })
    .where(eq(posters.id, id))
    .returning();
  if (d.status && d.status !== poster.status) {
    await audit(user.id, "poster.status", "poster", id, { from: poster.status, to: d.status });
  }
  return NextResponse.json({ poster: withUrls(updated) });
}

// Suppression : brouillons uniquement (sauf administrateur).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const { id } = await params;
  const poster = await load(id);
  if (!poster) return NextResponse.json({ error: "Affiche introuvable." }, { status: 404 });
  if (poster.status !== "draft" && !isAdmin(user)) {
    return NextResponse.json({ error: "Seuls les brouillons peuvent être supprimés." }, { status: 400 });
  }
  await db.delete(posters).where(eq(posters.id, id));
  await audit(user.id, "poster.delete", "poster", id, { status: poster.status });
  return NextResponse.json({ ok: true });
}
