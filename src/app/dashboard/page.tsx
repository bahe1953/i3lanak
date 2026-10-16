"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/components/LanguageProvider";
import AuthGate from "@/components/AuthGate";

type Order = { id: string; productName: string; status: string; createdAt: string };

function DashboardContent() {
  const { locale } = useLocale();
  const t = useT();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setUser(d.user));
    fetch("/api/orders").then((r) => r.json()).then((d) => setOrders(d.orders ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.dashboard")}</h1>
          {user && <p className="mt-1 text-slate-600">{user.name} — {user.role}</p>}
        </div>
        <Link href="/order" className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
          {t("hero.ctaOrder")}
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("admin.orders")}</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-slate-500">No orders.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm hover:shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{o.productName}</span>
                  <span className="text-sm text-slate-500">{t(`status.${o.status}`)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return <AuthGate>{() => <DashboardContent />}</AuthGate>;
}