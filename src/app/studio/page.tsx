"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/components/LanguageProvider";

type Order = { id: string; productName: string; merchantName: string; status: string; createdAt: string; targetCity: string | null };

// Commandes reçues des clients, avec un raccourci pour en créer l'affiche dans l'atelier.
export default function StudioPage() {
  const t = useT();
  const { locale } = useLocale();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/orders")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Erreur");
        setOrders(d.orders);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">{locale === "ar" ? "طلبات العملاء" : "Commandes clients"}</h1>
        <Link href="/atelier" className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
          {t("nav.atelier")}
        </Link>
      </div>
      {error && <p className="mt-6 text-red-600">{error}</p>}
      {orders === null && !error && <p className="mt-6 text-slate-500">{t("common.loading")}</p>}
      {orders?.length === 0 && <p className="mt-6 text-slate-500">{locale === "ar" ? "لا توجد طلبات." : "Aucune commande."}</p>}
      <div className="mt-6 space-y-3">
        {orders?.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <Link href={`/orders/${o.id}`} className="min-w-0 hover:underline">
              <p className="truncate font-semibold">{o.productName}</p>
              <p className="truncate text-sm text-slate-500">
                {o.merchantName}
                {o.targetCity ? ` · ${o.targetCity}` : ""} · {new Date(o.createdAt).toLocaleDateString(locale === "ar" ? "ar" : "fr-FR")}
              </p>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{t(`status.${o.status}`)}</span>
              <Link href={`/atelier/nouveau?order=${o.id}`} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                {locale === "ar" ? "إنشاء الأفيش" : "Créer l'affiche"}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
