import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderCosts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { firstError } from "@/lib/validation";
import { z } from "zod";

const amount = z.number().int().min(0).max(1_000_000_000);
const costSchema = z
  .object({
    designCost: amount, videoCost: amount, voiceoverCost: amount, externalCost: amount,
    diffusionCost: amount, sponsoredBudget: amount, discount: amount,
    estimatedWorkHours: amount, actualWorkHours: amount, notes: z.string().max(2000).nullable(),
  })
  .partial();

// Coûts et marges : internes à IT-RIM.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  const rows = await db.select().from(orderCosts).where(eq(orderCosts.orderId, id)).limit(1);
  return NextResponse.json({ costs: rows[0] ?? null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  const order = (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  const parsed = costSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const existing = (await db.select().from(orderCosts).where(eq(orderCosts.orderId, id)).limit(1))[0];
  const m = { ...existing, ...parsed.data };
  const n = (v: number | null | undefined) => v ?? 0;
  // Coûts directs de la prestation. Le budget sponsorisé est refacturé à part :
  // il n'entre ni dans le chiffre d'affaires de la prestation ni dans ses coûts.
  const totalCost = n(m.designCost) + n(m.videoCost) + n(m.voiceoverCost) + n(m.externalCost) + n(m.diffusionCost);
  // Chiffre d'affaires = prix de la prestation (final, sinon devisé) moins la remise. Jamais le prix du produit.
  const revenue = n(order.finalPrice ?? order.quotedPrice) - n(m.discount);
  const margin = revenue - totalCost;

  const values = {
    ...parsed.data,
    totalEstimatedCost: totalCost,
    totalActualCost: totalCost,
    grossMarginEstimated: margin,
    grossMarginActual: margin,
    updatedAt: new Date(),
  };
  const [updated] = existing
    ? await db.update(orderCosts).set(values).where(eq(orderCosts.orderId, id)).returning()
    : await db.insert(orderCosts).values({ orderId: id, ...values }).returning();
  return NextResponse.json({ costs: updated });
}
