import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

// Inscription publique : crée toujours un compte « client ».
// Les comptes de l'équipe se créent avec `npm run user:create`.
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides (mot de passe : 8 caractères minimum)." }, { status: 400 });
  }
  if (await rateLimit(`register:ip:${clientIp(req)}`, 10, 3600)) {
    return NextResponse.json({ error: "Trop de comptes créés, réessayez plus tard." }, { status: 429 });
  }
  const { name, email, password } = parsed.data;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ name, email, passwordHash, role: "client" }).returning();
  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
}
