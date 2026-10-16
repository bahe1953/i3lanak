"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LanguageProvider";
import AuthGate from "@/components/AuthGate";

function fetchAdminData() {
  return Promise.all([fetch("/api/orders").then((r) => r.json()), fetch("/api/packages").then((r) => r.json())]);
}

function AdminContent() {
  const t = useT();
  const [orders, setOrders] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  function load() {
    return fetchAdminData().then(([o, p]) => {
      setOrders(o.orders ?? []);
      setPackages(p.packages ?? []);
    });
  }

  useEffect(() => {
    fetchAdminData().then(([o, p]) => {
      setOrders(o.orders ?? []);
      setPackages(p.packages ?? []);
    });
  }, []);

  async function verify(orderId: string, action: "approve" | "reject") {
    await fetch(`/api/orders/${orderId}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function updatePrice(pkgId: string, price: string) {
    await fetch(`/api/packages/${pkgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: Number(price) }),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">{t("nav.admin")}</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("admin.orders")}</h2>
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Link href={`/orders/${o.id}`} className="font-semibold hover:underline">{o.productName}</Link>
                <span className="text-sm text-slate-500">{o.status} / {o.paymentStatus}</span>
              </div>
              {o.paymentStatus === "pending_verification" && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => verify(o.id, "approve")} className="rounded bg-green-600 px-3 py-1 text-sm text-white">Approve</button>
                  <button onClick={() => verify(o.id, "reject")} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("admin.packages")}</h2>
        <div className="mt-4 space-y-3">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
              <span className="flex-1 font-semibold">{p.nameFr}</span>
              <input
                defaultValue={p.price}
                onBlur={(e) => updatePrice(p.id, e.target.value)}
                className="w-24 rounded border border-slate-300 px-2 py-1"
              />
              <span className="text-sm text-slate-500">{p.currency}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return <AuthGate roles={["admin"]}>{() => <AdminContent />}</AuthGate>;
}