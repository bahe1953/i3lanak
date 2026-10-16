import { NextResponse } from "next/server";
import { db } from "@/db";
import { publications, orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { NETWORKS, firstError } from "@/lib/validation";
import { isValidKey } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { z } from "zod";

const pubSchema = z.object({
  network: z.enum(NETWORKS),
  plannedDate: z.string().max(40).optional().nullable(),
  actualDate: z.string().max(40).optional().nullable(),
  url: z.string().trim().url("Lien de publication invalide").max(500).optional().nullable().or(z.literal("")),
  proofPath: z.string().refine(isValidKey).optional().nullable(),
  status: z.enum(["planned", "published", "failed", "cancelled"]).default("planned"),
  notes: z.string().max(1000).optional().nullable(),
});

const toDate = (s?: string | null) => (s ? new Date(s) : null);

async function orderExists(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  return (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const order = await orderExists(id);
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (!isStaff(user) && order.userId !== user.id) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  return NextResponse.json({ publications: await db.select().from(publications).where(eq(publications.orderId, id)) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  if (!(await orderExists(id))) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  const parsed = pubSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const d = parsed.data;
  // Une publication « publiée » doit avoir une preuve : un lien ou une capture.
  if (d.status === "published" && !d.url && !d.proofPath) {
    return NextResponse.json({ error: "Ajoutez le lien ou la capture de la publication." }, { status: 400 });
  }
  const [pub] = await db
    .insert(publications)
    .values({
      orderId: id,
      network: d.network,
      plannedDate: toDate(d.plannedDate),
      actualDate: d.status === "published" ? toDate(d.actualDate) ?? new Date() : toDate(d.actualDate),
      url: d.url || null,
      proofPath: d.proofPath ?? null,
      status: d.status,
      notes: d.notes ?? null,
    })
    .returning();
  await audit(user.id, "publication.create", "order", id, { network: d.network, status: d.status });
  return NextResponse.json({ publication: pub });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = pubSchema.partial().extend({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { id: pubId, plannedDate, actualDate, ...rest } = parsed.data;
  const [pub] = await db
    .update(publications)
    .set({
      ...rest,
      ...(plannedDate !== undefined ? { plannedDate: toDate(plannedDate) } : {}),
      ...(actualDate !== undefined ? { actualDate: toDate(actualDate) } : {}),
    })
    // la publication doit appartenir à cette commande
    .where(and(eq(publications.id, pubId), eq(publications.orderId, id)))
    .returning();
  if (!pub) return NextResponse.json({ error: "Publication introuvable." }, { status: 404 });
  await audit(user.id, "publication.update", "order", id, { publication: pubId });
  return NextResponse.json({ publication: pub });
}
