import { NextResponse } from "next/server";
import { db } from "@/db";
import { packages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { packageSchema } from "@/lib/package-schema";
import { firstError } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { z } from "zod";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Forfait introuvable." }, { status: 404 });
  const parsed = packageSchema.partial().strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const [pkg] = await db.update(packages).set({ ...parsed.data, updatedAt: new Date() }).where(eq(packages.id, id)).returning();
  if (!pkg) return NextResponse.json({ error: "Forfait introuvable." }, { status: 404 });
  await audit(user.id, "package.update", "package", id, parsed.data);
  return NextResponse.json({ package: pkg });
}

// Pas de suppression définitive : les commandes passées référencent le forfait.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Forfait introuvable." }, { status: 404 });
  await db.update(packages).set({ isActive: false, updatedAt: new Date() }).where(eq(packages.id, id));
  await audit(user.id, "package.deactivate", "package", id);
  return NextResponse.json({ ok: true });
}
