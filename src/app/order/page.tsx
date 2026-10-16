"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useT } from "@/components/LanguageProvider";
import AuthGate from "@/components/AuthGate";
import { uploadImage } from "@/lib/client-upload";

const NETWORKS = ["facebook", "instagram", "tiktok", "whatsapp"];

export default function OrderPage() {
  return (
    <Suspense>
      <AuthGate>{() => <OrderInner />}</AuthGate>
    </Suspense>
  );
}

function OrderInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { locale } = useLocale();
  const t = useT();

  const [packages, setPackages] = useState<any[]>([]);
  const [step, setStep] = useState<"form" | "review">("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    merchantName: "",
    productName: "",
    category: "",
    description: "",
    sellingPrice: "",
    currency: "MRU",
    whatsapp: "",
    contactInfo: "",
    targetCity: "",
    adLanguage: "fr",
    objective: "",
    packageId: params.get("package") || "",
    instructions: "",
    networks: [] as string[],
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [logo, setLogo] = useState<File | null>(null);

  useEffect(() => {
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(d.packages ?? []));
  }, []);

  function toggleNetwork(n: string) {
    setForm((f) => ({
      ...f,
      networks: f.networks.includes(n) ? f.networks.filter((x) => x !== n) : [...f.networks, n],
    }));
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      // 1. envoi des images une par une (redimensionnées dans le navigateur)
      const photoKeys: string[] = [];
      for (const p of photos.slice(0, 8)) photoKeys.push((await uploadImage(p, "photos")).key);
      const logoKey = logo ? (await uploadImage(logo, "logos")).key : null;
      // 2. création de la commande
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sellingPrice: form.sellingPrice.replace(/\s/g, "") === "" ? null : Number(form.sellingPrice.replace(/\s/g, "")),
          photoKeys,
          logoKey,
        }),
      });
      if (res.status === 401) {
        router.replace(`/login?next=${encodeURIComponent("/order")}`);
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error);
      router.push(`/orders/${d.order.id}`);
    } catch (e) {
      setError((e as Error).message || (locale === "ar" ? "تعذر إرسال الطلب" : "Impossible d’envoyer la commande"));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "review") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">{t("order.review")}</h1>
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm space-y-2 text-sm">
          <p><strong>{t("order.merchantName")}:</strong> {form.merchantName}</p>
          <p><strong>{t("order.productName")}:</strong> {form.productName}</p>
          <p><strong>{t("order.category")}:</strong> {form.category}</p>
          <p><strong>{t("order.adLanguage")}:</strong> {t(`order.langs.${form.adLanguage}`)}</p>
          <p><strong>{t("order.networks")}:</strong> {form.networks.join(", ")}</p>
          <p><strong>{t("order.photos")}:</strong> {photos.length}</p>
          <p><strong>{t("order.logo")}:</strong> {logo ? "✓" : "—"}</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setStep("form")} className="rounded-lg border border-slate-300 px-4 py-2">
            {t("common.cancel")}
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "..." : t("order.submit")}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{t("order.title")}</h1>
      <div className="mt-6 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.merchantName")} value={form.merchantName} onChange={(e) => setForm({ ...form, merchantName: e.target.value })} />
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.productName")} value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.category")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-2">
          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.sellingPrice")} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          <input className="w-24 rounded-lg border border-slate-300 px-3 py-2" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.whatsapp")} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.contact")} value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} />
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.city")} value={form.targetCity} onChange={(e) => setForm({ ...form, targetCity: e.target.value })} />

        <label className="block text-sm">
          {t("order.adLanguage")}
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.adLanguage} onChange={(e) => setForm({ ...form, adLanguage: e.target.value })}>
            <option value="fr">{t("order.langs.fr")}</option>
            <option value="ar">{t("order.langs.ar")}</option>
            <option value="both">{t("order.langs.both")}</option>
          </select>
        </label>

        <div>
          <p className="text-sm font-medium">{t("order.networks")}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {NETWORKS.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.networks.includes(n)} onChange={() => toggleNetwork(n)} />
                {n}
              </label>
            ))}
          </div>
        </div>

        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.objective")} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />

        <label className="block text-sm">
          {t("order.package")}
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
            <option value="">--</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {locale === "ar" ? p.nameAr || p.nameFr : p.nameFr} — {p.price} {p.currency}
              </option>
            ))}
          </select>
        </label>

        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder={t("order.instructions")} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />

        <div>
          <p className="text-sm font-medium">{t("order.photos")}</p>
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhotos(Array.from(e.target.files || []))} className="mt-1" />
        </div>
        <div>
          <p className="text-sm font-medium">{t("order.logo")}</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] || null)} className="mt-1" />
        </div>

        <button onClick={() => setStep("review")} className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700">
          {t("order.review")}
        </button>
      </div>
    </div>
  );
}