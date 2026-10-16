import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getStaffUser } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Commerçants déjà saisis (dernière fiche connue) : pour réutiliser WhatsApp, ville et logo.
export async function GET() {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const res = await db.execute<{
    merchant_name: string; whatsapp: string | null; city: string | null; contact_line: string | null; logo_key: string | null;
  }>(sql`
    select distinct on (lower(merchant_name)) merchant_name, whatsapp, city, contact_line, logo_key
    from posters where merchant_name <> ''
    order by lower(merchant_name), updated_at desc
    limit 300`);
  return NextResponse.json({
    merchants: res.rows.map((r) => ({
      merchantName: r.merchant_name,
      whatsapp: r.whatsapp ?? "",
      city: r.city ?? "",
      contactLine: r.contact_line ?? "",
      logoKey: r.logo_key,
      logoUrl: fileUrl(r.logo_key),
    })),
  });
}
