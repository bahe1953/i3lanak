import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  plan: string;
  credits: number;
  createdAt: Date;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(sessions).values({ userId, token, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete("session");
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      locale: users.locale,
      plan: users.plan,
      credits: users.credits,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    locale: r.locale,
    plan: r.plan,
    credits: r.credits,
    createdAt: r.createdAt,
  };
}

export function isStaff(u: SafeUser): boolean {
  return u.role === "admin" || u.role === "operator";
}

export function isAdmin(u: SafeUser): boolean {
  return u.role === "admin";
}

/** Équipe IT-RIM (opérateur ou admin), vérifié côté serveur. */
export async function getStaffUser(): Promise<SafeUser | null> {
  const u = await getCurrentUser();
  return u && isStaff(u) ? u : null;
}