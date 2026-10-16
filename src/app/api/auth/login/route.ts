import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession } from "@/lib/auth";
import { rateLimit, resetRateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

// Hash factice (mot de passe inconnu) pour un temps de réponse constant.
const DUMMY_HASH = "$2b$12$DDaL8rH631TsvTtT3vg4w.GkEb.gJ6xIqCbUHYy6Hy8.URyRZ.rsy";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email ou mot de passe invalide." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // 10 tentatives par email et 50 par adresse IP, par tranche de 15 minutes.
  const ip = clientIp(req);
  if ((await rateLimit(`login:email:${email}`, 10, 900)) || (await rateLimit(`login:ip:${ip}`, 50, 900))) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  // Comparaison effectuée même si l'email n'existe pas, pour ne pas révéler les comptes.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }
  await resetRateLimit(`login:email:${email}`);
  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
