import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { z } from "zod";

// Réservé aux administrateurs : les opérateurs ne valident pas les paiements.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const { id } = await params;
  const parsed = z
    .object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const approve = parsed.data.action === "approve";
  // Uniquement un paiement déclaré et en attente de vérification.
  const [updated] = await db
    .update(orders)
    .set(
      approve
        ? { paymentStatus: "paid", status: "paid", updatedAt: new Date() }
        : { paymentStatus: "rejected", status: "awaiting_payment", updatedAt: new Date() },
    )
    .where(and(eq(orders.id, id), eq(orders.paymentStatus, "pending_verification")))
    .returning();
  if (!updated) return NextResponse.json({ error: "Aucun paiement en attente pour cette commande." }, { status: 409 });
  await audit(user.id, approve ? "payment.approve" : "payment.reject", "order", id, {
    reference: updated.paymentReference,
    note: parsed.data.note,
  });
  return NextResponse.json({ order: updated });
}
