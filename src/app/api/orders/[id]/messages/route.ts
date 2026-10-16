import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const isAdmin = user.role === "admin" || user.role === "operator";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const orows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && orows[0].userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await db.select().from(messages).where(eq(messages.orderId, id));
  return NextResponse.json({ messages: rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const isAdmin = user.role === "admin" || user.role === "operator";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const orows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && orows[0].userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 2000) return NextResponse.json({ error: "Message vide ou trop long." }, { status: 400 });
  const [msg] = await db.insert(messages).values({
    orderId: id,
    userId: user.id,
    authorRole: isAdmin ? "admin" : "client",
    body: text,
  }).returning();
  return NextResponse.json({ message: msg });
}