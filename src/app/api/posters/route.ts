import { NextResponse } from "next/server";
import { db } from "@/db";
import { posters, orders, orderFiles } from "@/db/schema";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getStaffUser } from "@/lib/auth";
import { isValidKey } from "@/lib/storage";
import { withUrls } from "@/lib/poster/urls";
import { guessTemplate, sampleTexts, POSTER_STATUSES, TEMPLATE_IDS, type PosterStatus, type TemplateId } from "@/lib/poster/catalog";
import { audit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Liste + recherche (commerçant ou produit) + filtre de statut. Réservé à l'équipe.
export async function GET(req: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = url.searchParams.get("status");
  const conds: SQL[] = [];
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(posters.merchantName, like), ilike(posters.productName, like))!);
  }
  if (status && (POSTER_STATUSES as readonly string[]).includes(status)) conds.push(eq(posters.status, status as PosterStatus));
  const rows = await db
    .select()
    .from(posters)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(posters.updatedAt))
    .limit(200);
  return NextResponse.json({ posters: rows.map(withUrls) });
}

const createSchema = z
  .object({
    orderId: z.string().uuid().optional(),
    template: z.enum(TEMPLATE_IDS).optional(),
  })
  .strict();

// Crée un brouillon, vide ou pré-rempli à partir d'une commande client.
export async function POST(req: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const parsed = createSchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  let values: typeof posters.$inferInsert = { createdBy: user.id, template: parsed.data.template ?? "shop" };

  if (parsed.data.orderId) {
    const order = (await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1))[0];
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    const files = await db.select().from(orderFiles).where(eq(orderFiles.orderId, order.id));
    const template: TemplateId = parsed.data.template ?? guessTemplate(order.category);
    const language = (["fr", "ar", "both"] as const).find((l) => l === order.adLanguage) ?? "fr";
    values = {
      ...values,
      orderId: order.id,
      template,
      language,
      merchantName: order.merchantName,
      whatsapp: order.whatsapp ?? "",
      city: order.targetCity ?? "",
      contactLine: (order.contactInfo ?? "").slice(0, 200),
      productName: order.productName,
      description: order.description ?? "",
      price: order.sellingPrice,
      currency: order.currency ?? "MRU",
      photoKeys: files.filter((f) => f.kind === "photo" && isValidKey(f.filePath)).map((f) => f.filePath).slice(0, 6),
      logoKey: files.find((f) => f.kind === "logo" && isValidKey(f.filePath))?.filePath ?? null,
      texts: sampleTexts(template, order.productName),
    };
  } else {
    values.texts = sampleTexts(values.template as TemplateId, "");
  }

  const [poster] = await db.insert(posters).values(values).returning();
  await audit(user.id, "poster.create", "poster", poster.id, { orderId: values.orderId ?? null });
  return NextResponse.json({ poster: withUrls(poster) });
}
