import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderFiles, orderCosts, publications, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { orderStaffUpdateSchema, orderClientUpdateSchema, firstError } from "@/lib/validation";
import { fileUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { z } from "zod";

async function loadOrder(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const order = await loadOrder(id);
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  const staff = isStaff(user);
  if (!staff && order.userId !== user.id) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const files = (await db.select().from(orderFiles).where(eq(orderFiles.orderId, id))).map((f) => ({
    ...f,
    url: fileUrl(f.filePath),
  }));
  // Les coûts et marges sont internes à IT-RIM.
  const costs = staff ? (await db.select().from(orderCosts).where(eq(orderCosts.orderId, id)).limit(1))[0] ?? null : null;
  const pubs = await db.select().from(publications).where(eq(publications.orderId, id));
  const msgs = await db.select().from(messages).where(eq(messages.orderId, id));
  return NextResponse.json({
    order: { ...order, paymentProofUrl: fileUrl(order.paymentProofPath) },
    files,
    costs,
    publications: pubs,
    messages: msgs,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { id } = await params;
  const order = await loadOrder(id);
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  const staff = isStaff(user);
  if (!staff && order.userId !== user.id) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = (staff ? orderStaffUpdateSchema : orderClientUpdateSchema).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const data = parsed.data as z.infer<typeof orderStaffUpdateSchema>;

  // « Payé » ne se pose que par la vérification de paiement (réservée aux admins).
  if (data.status === "paid" && order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "Validez d'abord le paiement." }, { status: 400 });
  }
  const [updated] = await db.update(orders).set({ ...data, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
  await audit(user.id, "order.update", "order", id, data);
  return NextResponse.json({ order: updated });
}
