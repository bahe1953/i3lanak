import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { TEMPLATES, TEMPLATE_IDS, TEXT_KEYS, formatPrice } from "@/lib/poster/catalog";
import { z } from "zod";

export const dynamic = "force-dynamic";

// L'atelier demande d'abord si l'IA est configurée, pour n'afficher le bouton que si c'est le cas.
export async function GET() {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  return NextResponse.json({ configured: Boolean(process.env.OPENAI_API_KEY) });
}

const schema = z.object({
  template: z.enum(TEMPLATE_IDS),
  productName: z.string().trim().min(1, "Indiquez le produit").max(160),
  description: z.string().max(2000).default(""),
  price: z.number().int().nullable().default(null),
  currency: z.string().max(8).default("MRU"),
  city: z.string().max(120).default(""),
});

export async function POST(req: Request) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe IT-RIM." }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "IA non configurée (OPENAI_API_KEY absente)." }, { status: 503 });
  if (await rateLimit(`ai:${user.id}`, 40, 3600)) {
    return NextResponse.json({ error: "Limite d'utilisation de l'IA atteinte pour l'heure." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  const d = parsed.data;

  const prompt = `Tu es rédacteur publicitaire pour des commerçants en Mauritanie.
Secteur : ${TEMPLATES[d.template].nameFr}. Produit : ${d.productName}.
Description : ${d.description || "aucune"}. Prix : ${formatPrice(d.price, d.currency) || "non précisé"}. Ville : ${d.city || "non précisée"}.
Écris une affiche courte. Réponds uniquement en JSON avec ces clés :
headlineFr (≤ 40 caractères), headlineAr (arabe standard, ≤ 40), taglineFr (≤ 60), taglineAr (≤ 60),
ctaFr (≤ 30), ctaAr (≤ 30), badgeFr (1 à 2 mots), badgeAr (1 à 2 mots).
N'invente aucune caractéristique absente de la description, aucune promesse de résultat, aucun prix.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error("openai error", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "Le service d'IA a renvoyé une erreur." }, { status: 502 });
    }
    const data = await res.json();
    const raw = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    const texts = Object.fromEntries(
      TEXT_KEYS.filter((k) => typeof raw[k] === "string").map((k) => [k, String(raw[k]).slice(0, 220)]),
    );
    return NextResponse.json({ texts });
  } catch (e) {
    console.error("ai copy failed", e);
    return NextResponse.json({ error: "Échec de la génération par IA." }, { status: 502 });
  }
}
