import { NextResponse } from "next/server";
import { db } from "@/db";
import { packages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { packageSchema } from "@/lib/package-schema";
import { firstError } from "@/lib/validation";
import { audit } from "@/lib/audit";

export async function GET() {
  const rows = await db.select().from(packages).where(eq(packages.isActive, true)).orderBy(asc(packages.sortOrder));
  return NextResponse.json({ packages: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const parsed = packageSchema.partial({ nameAr: true, descFr: true, descAr: true, currency: true, featuresFr: true, featuresAr: true, networks: true, languages: true, corrections: true, isActive: true, sortOrder: true })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const [pkg] = await db.insert(packages).values(parsed.data).returning();
  await audit(user.id, "package.create", "package", pkg.id);
  return NextResponse.json({ package: pkg });
}
