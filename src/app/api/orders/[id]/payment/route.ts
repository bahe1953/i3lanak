import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ownKey, firstError } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { z } from "zod";

// Le client déclare son paiement (référence + preuve). Un admin le vérifie ensuite.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.userId !== user.id) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (order.paymentStatus === "paid") return NextResponse.json({ error: "Cette commande est déjà payée." }, { status: 400 });

  const parsed = z
    .object({
      method: z.enum(["bankily", "masrvi", "sedad"]),
      reference: z.string().trim().min(3, "Référence de paiement requise").max(120),
      proofKey: ownKey(user.id, "payments").optional().nullable(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const [updated] = await db
    .update(orders)
    .set({
      paymentMethod: parsed.data.method,
      paymentReference: parsed.data.reference,
      paymentProofPath: parsed.data.proofKey ?? null,
      paymentStatus: "pending_verification",
      status: "payment_to_verify",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();
  await audit(user.id, "payment.declare", "order", id, { method: parsed.data.method, reference: parsed.data.reference });
  return NextResponse.json({ order: updated });
}
