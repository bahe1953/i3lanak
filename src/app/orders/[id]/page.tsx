"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useT } from "@/components/LanguageProvider";
import AuthGate from "@/components/AuthGate";
import { uploadImage } from "@/lib/client-upload";

type OrderData = any;
type Me = { role: string } | null;

async function fetchOrder(id: string): Promise<[OrderData | null, Me]> {
  const [res, meRes] = await Promise.all([fetch(`/api/orders/${id}`), fetch("/api/me")]);
  return [res.ok ? await res.json() : null, meRes.ok ? (await meRes.json()).user : null];
}

function OrderDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [payError, setPayError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bankily");
  const [reference, setReference] = useState("");
  const [me, setMe] = useState<any>(null);
  const [costState, setCostState] = useState<any>(null);
  const [costForm, setCostForm] = useState<any>({});
  const [pubForm, setPubForm] = useState({ network: "facebook", plannedDate: "", url: "", status: "planned" });

  function apply([d, meUser]: [OrderData | null, Me | null]) {
    if (d) {
      setData(d);
      setCostState(d.costs);
      setCostForm(d.costs ?? {});
    }
    setMe(meUser);
  }

  function load() {
    return fetchOrder(id).then(apply);
  }

  useEffect(() => {
    fetchOrder(id).then(apply);
  }, [id]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setPayError("");
    try {
      const fileInput = document.getElementById("proofFile") as HTMLInputElement;
      const file = fileInput?.files?.[0];
      const proofKey = file ? (await uploadImage(file, "payments")).key : null;
      const res = await fetch(`/api/orders/${id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: paymentMethod, reference, proofKey }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Erreur");
      load();
    } catch (err) {
      setPayError((err as Error).message);
    }
  }

  async function sendMessage() {
    if (!msg.trim()) return;
    await fetch(`/api/orders/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: msg }),
    });
    setMsg("");
    load();
  }

  if (!data) return <div className="p-6">{t("common.loading")}</div>;
  const { order, files, costs, publications, messages } = data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">{order.productName}</h1>
      <p className="mt-1 text-slate-600">{order.merchantName}</p>
      <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
        <p><strong>Status:</strong> {t(`status.${order.status}`)}</p>
        <p><strong>Payment:</strong> {order.paymentStatus}</p>

        <p><strong>Networks:</strong> {(order.networks || []).join(", ")}</p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Files</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {(files || []).map((f: any) => (
            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
              {f.kind === "logo" ? "Logo" : "Photo"}
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("payment.title")}</h2>
        <form onSubmit={submitPayment} className="mt-3 space-y-3 rounded-2xl bg-white p-6 shadow-sm">
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="bankily">Bankily</option>
            <option value="masrvi">Masrvi</option>
            <option value="sedad">Sedad</option>
          </select>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("payment.reference")} value={reference} onChange={(e) => setReference(e.target.value)} />
          <input id="proofFile" type="file" accept="image/png,image/jpeg,image/webp" />
          {payError && <p className="text-sm text-red-600">{payError}</p>}
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
            {t("payment.submitProof")}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          {locale === "fr"
            ? "Instructions: payez via Bankily/Masrvi/Sedad puis envoyez la référence et la preuve. La production démarre après validation."
            : "تعليمات: ادفع عبر Bankily/Masrvi/Sedad ثم أرسل المرجع والإثبات. يبدأ الإنتاج بعد التحقق."}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Publications</h2>
        <div className="mt-3 space-y-2">
          {(publications || []).map((p: any) => (
            <div key={p.id} className="rounded-lg bg-white p-4 shadow-sm text-sm">
              <p>{p.network} — {p.status} {p.url && <a href={p.url} className="text-indigo-600" target="_blank">lien</a>}</p>
            </div>
          ))}
          {(publications || []).length === 0 && <p className="text-slate-500">Aucune publication.</p>}
        </div>
      </section>

      {me && (me.role === "admin" || me.role === "operator") && (
        <>
          <a href={`/atelier/nouveau?order=${order.id}`} className="mt-8 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
            {locale === "ar" ? "إنشاء الأفيش في الورشة" : "Créer l'affiche dans l'atelier"}
          </a>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Coûts & marges</h2>
            <div className="mt-3 grid gap-2 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-3">
              {["designCost","videoCost","voiceoverCost","externalCost","diffusionCost","sponsoredBudget","discount"].map((k) => (
                <label key={k} className="text-sm">
                  {k}
                  <input
                    type="number"
                    value={costForm?.[k] ?? 0}
                    onChange={(e) => setCostForm({ ...costForm, [k]: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              ))}
              <button
                onClick={async () => {
                  await fetch(`/api/orders/${id}/costs`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(costForm),
                  });
                  load();
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
              >
                Save costs
              </button>
              {costState && (
                <p className="md:col-span-3 text-sm text-slate-600">
                  Marge estimée: {costState.grossMarginEstimated} MRU — Coût total: {costState.totalEstimatedCost} MRU
                </p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Publication</h2>
            <div className="mt-3 space-y-2 rounded-2xl bg-white p-6 shadow-sm">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="network" value={pubForm.network} onChange={(e) => setPubForm({ ...pubForm, network: e.target.value })} />
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={pubForm.plannedDate} onChange={(e) => setPubForm({ ...pubForm, plannedDate: e.target.value })} />
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="url" value={pubForm.url} onChange={(e) => setPubForm({ ...pubForm, url: e.target.value })} />
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={pubForm.status} onChange={(e) => setPubForm({ ...pubForm, status: e.target.value })}>
                <option value="planned">planned</option>
                <option value="published">published</option>
                <option value="failed">failed</option>
              </select>
              <button
                onClick={async () => {
                  await fetch(`/api/orders/${id}/publications`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pubForm),
                  });
                  load();
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
              >
                Add publication
              </button>
            </div>
          </section>
        </>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Messages / Corrections</h2>
        <div className="mt-3 space-y-2">
          {(messages || []).map((m: any) => (
            <div key={m.id} className="rounded-lg bg-white p-3 shadow-sm text-sm">
              <span className="font-semibold">{m.authorRole}:</span> {m.body}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message..." />
          <button onClick={sendMessage} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Send</button>
        </div>
      </section>
    </div>
  );
}

export default function OrderDetailPage() {
  return <AuthGate>{() => <OrderDetailContent />}</AuthGate>;
}