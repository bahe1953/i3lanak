import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderFiles, orderCosts, packages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { orderCreateSchema, firstError } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const rows = isStaff(user)
    ? await db.select().from(orders).orderBy(desc(orders.createdAt))
    : await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt));
  return NextResponse.json({ orders: rows });
}

// Les photos et le logo sont envoyés avant via /api/uploads ; on reçoit ici leurs clés.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (await rateLimit(`order:${user.id}`, 20, 3600)) {
    return NextResponse.json({ error: "Trop de commandes envoyées, réessayez plus tard." }, { status: 429 });
  }

  const parsed = orderCreateSchema(user.id).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const d = parsed.data;

  if (d.packageId) {
    const pkg = await db.select({ id: packages.id }).from(packages).where(eq(packages.id, d.packageId)).limit(1);
    if (!pkg.length) return NextResponse.json({ error: "Forfait inconnu." }, { status: 400 });
  }

  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        userId: user.id,
        packageId: d.packageId || null,
        merchantName: d.merchantName,
        productName: d.productName,
        category: d.category,
        description: d.description,
        sellingPrice: d.sellingPrice ?? null,
        currency: d.currency,
        adLanguage: d.adLanguage,
        targetCity: d.targetCity,
        whatsapp: d.whatsapp || null,
        contactInfo: d.contactInfo,
        networks: d.networks,
        objective: d.objective,
        instructions: d.instructions,
        status: "draft",
      })
      .returning();
    const files = [
      ...d.photoKeys.map((k) => ({ orderId: o.id, kind: "photo", filePath: k })),
      ...(d.logoKey ? [{ orderId: o.id, kind: "logo", filePath: d.logoKey }] : []),
    ];
    if (files.length) await tx.insert(orderFiles).values(files);
    await tx.insert(orderCosts).values({ orderId: o.id });
    return o;
  });

  await audit(user.id, "order.create", "order", order.id);
  return NextResponse.json({ order });
}
