"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAtelierText, STATUS_STYLE } from "@/lib/atelier-i18n";
import {
  FORMATS, LANGUAGES, SAMPLE_DATA, TEMPLATES, TEMPLATE_IDS, sampleTexts,
  type FormatId, type PosterLanguage, type PosterStatus, type PosterTexts, type TemplateId, type TextKey,
} from "@/lib/poster/catalog";
import { ensurePosterFonts, loadImage, renderPoster } from "@/lib/poster/render";
import { uploadBlob, uploadImage } from "@/lib/client-upload";
import VideoPanel from "@/components/VideoPanel";
import type { VideoInput } from "@/lib/poster/video";

type Poster = {
  id: string;
  orderId: string | null;
  merchantName: string;
  whatsapp: string | null;
  city: string | null;
  contactLine: string | null;
  logoKey: string | null;
  productName: string;
  description: string | null;
  price: number | null;
  currency: string;
  photoKeys: string[];
  template: TemplateId;
  format: FormatId;
  language: PosterLanguage;
  texts: PosterTexts;
  imageKey: string | null;
  videoKey: string | null;
  status: PosterStatus;
  publicationUrl: string | null;
};

// Champs modifiables dans l'éditeur.
type Form = {
  merchantName: string;
  whatsapp: string;
  city: string;
  contactLine: string;
  logoKey: string | null;
  productName: string;
  description: string;
  price: string;
  currency: string;
  photoKeys: string[];
  template: TemplateId;
  format: FormatId;
  language: PosterLanguage;
  texts: PosterTexts;
  publicationUrl: string;
};

type Merchant = { merchantName: string; whatsapp: string; city: string; contactLine: string; logoKey: string | null };

const fileUrl = (k: string | null) => (k ? `/api/files/${k}` : null);

function toForm(p: Poster): Form {
  return {
    merchantName: p.merchantName ?? "",
    whatsapp: p.whatsapp ?? "",
    city: p.city ?? "",
    contactLine: p.contactLine ?? "",
    logoKey: p.logoKey,
    productName: p.productName ?? "",
    description: p.description ?? "",
    price: p.price != null ? String(p.price) : "",
    currency: p.currency || "MRU",
    photoKeys: p.photoKeys ?? [],
    template: p.template,
    format: p.format === "story" ? "story" : "square",
    language: p.language,
    texts: p.texts ?? {},
    publicationUrl: p.publicationUrl ?? "",
  };
}

function payload(f: Form) {
  const price = f.price.replace(/\s/g, "");
  return {
    merchantName: f.merchantName,
    whatsapp: f.whatsapp,
    city: f.city,
    contactLine: f.contactLine,
    logoKey: f.logoKey,
    productName: f.productName,
    description: f.description,
    price: price === "" ? null : Math.round(Number(price)),
    currency: f.currency,
    photoKeys: f.photoKeys,
    template: f.template,
    format: f.format,
    language: f.language,
    texts: f.texts,
    publicationUrl: f.publicationUrl,
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Erreur ${r.status}`);
  return d as T;
}

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function PosterEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { a, locale } = useAtelierText();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [poster, setPoster] = useState<Poster | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [dirty, setDirty] = useState(false);
  const [imageOutdated, setImageOutdated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [variant, setVariant] = useState(0);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [tab, setTab] = useState<"poster" | "video">("poster");
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  // Chargement initial
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await api<{ poster: Poster }>(`/api/posters/${id}`);
        if (!active) return;
        setPoster(d.poster);
        setForm(toForm(d.poster));
      } catch (e) {
        if (active) setMessage({ kind: "err", text: (e as Error).message });
      }
      api<{ configured: boolean }>("/api/ai/copy").then((d) => active && setAiConfigured(d.configured)).catch(() => {});
      api<{ merchants: Merchant[] }>("/api/posters/merchants").then((d) => active && setMerchants(d.merchants)).catch(() => {});
      await ensurePosterFonts().catch(() => {});
      if (active) setFontsReady(true);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Chargement des images nécessaires (3 premières photos pour la vidéo + logo)
  const mainPhoto = form?.photoKeys[0] ?? null;
  const logoKey = form?.logoKey ?? null;
  const photoList = (form?.photoKeys ?? []).slice(0, 3).join("|");
  useEffect(() => {
    for (const k of [...photoList.split("|"), logoKey]) {
      if (!k || images[k]) continue;
      loadImage(fileUrl(k)!)
        .then((img) => setImages((m) => ({ ...m, [k]: img })))
        .catch(() => setMessage({ kind: "err", text: "Une image n'a pas pu être chargée." }));
    }
  }, [photoList, logoKey, images]);

  // Rendu en direct
  useEffect(() => {
    if (!form || !fontsReady || !canvasRef.current) return;
    const price = form.price.replace(/\s/g, "");
    renderPoster(canvasRef.current, {
      template: form.template,
      format: form.format,
      language: form.language,
      texts: form.texts,
      price: price === "" || Number.isNaN(Number(price)) ? null : Number(price),
      currency: form.currency,
      merchantName: form.merchantName,
      whatsapp: form.whatsapp,
      city: form.city,
      contactLine: form.contactLine,
      photo: mainPhoto ? images[mainPhoto] ?? null : null,
      logo: logoKey ? images[logoKey] ?? null : null,
    });
  }, [form, fontsReady, images, mainPhoto, logoKey]);

  // Données de la vidéo : mêmes informations que l'affiche + jusqu'à 3 photos
  const videoInput = useMemo<VideoInput | null>(() => {
    if (!form) return null;
    const price = form.price.replace(/\s/g, "");
    const photos = photoList ? photoList.split("|").map((k) => images[k]).filter(Boolean) : [];
    return {
      template: form.template,
      format: form.format,
      language: form.language,
      texts: form.texts,
      price: price === "" || Number.isNaN(Number(price)) ? null : Number(price),
      currency: form.currency,
      merchantName: form.merchantName,
      whatsapp: form.whatsapp,
      city: form.city,
      contactLine: form.contactLine,
      photo: photos[0] ?? null,
      logo: logoKey ? images[logoKey] ?? null : null,
      photos,
    };
  }, [form, images, photoList, logoKey]);

  async function saveVideo(blob: Blob, ext: string) {
    setBusy("video");
    try {
      const { key } = await uploadBlob(blob, "videos", `video.${ext}`);
      const p = await save({ videoKey: key });
      return Boolean(p);
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  }

  // Alerte avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = useCallback(
    (patch: Partial<Form>) => {
      setForm((f) => (f ? { ...f, ...patch } : f));
      setDirty(true);
      if (poster?.imageKey) setImageOutdated(true);
      setMessage(null);
    },
    [poster?.imageKey],
  );
  const setText = (k: TextKey, v: string) => form && update({ texts: { ...form.texts, [k]: v } });

  async function save(extra: Record<string, unknown> = {}) {
    if (!form) return null;
    setBusy("save");
    try {
      const d = await api<{ poster: Poster }>(`/api/posters/${id}`, { method: "PATCH", body: JSON.stringify({ ...payload(form), ...extra }) });
      setPoster(d.poster);
      setDirty(false);
      setMessage({ kind: "ok", text: a.saved });
      return d.poster;
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
      return null;
    } finally {
      setBusy(null);
    }
  }

  function canvasBlob(type: "image/png" | "image/jpeg", q?: number) {
    return new Promise<Blob>((res, rej) => canvasRef.current!.toBlob((b) => (b ? res(b) : rej(new Error("Export impossible"))), type, q));
  }

  async function exportPng() {
    const blob = await canvasBlob("image/png");
    const slug = (form?.productName || "affiche").normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slug}-${form?.format}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  // Enregistre une copie JPEG de l'affiche (la limite de 4 Mo par requête exclut le PNG en story).
  async function saveFile() {
    setBusy("image");
    try {
      const blob = await canvasBlob("image/jpeg", 0.92);
      const { key } = await uploadBlob(blob, "posters", "affiche.jpg");
      const p = await save({ imageKey: key });
      if (p) {
        setImageOutdated(false);
        setMessage({ kind: "ok", text: a.imageSaved });
      }
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: PosterStatus) {
    await save({ status });
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !form) return;
    setBusy("photos");
    try {
      const keys: string[] = [];
      for (const f of Array.from(files).slice(0, 6 - form.photoKeys.length)) keys.push((await uploadImage(f, "photos")).key);
      update({ photoKeys: [...form.photoKeys, ...keys] });
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function setLogo(file: File | undefined) {
    if (!file) return;
    setBusy("logo");
    try {
      update({ logoKey: (await uploadImage(file, "logos")).key });
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function chooseMerchant(name: string) {
    const m = merchants.find((x) => x.merchantName.toLowerCase() === name.toLowerCase());
    if (m) update({ merchantName: m.merchantName, whatsapp: m.whatsapp, city: m.city, contactLine: m.contactLine, logoKey: m.logoKey });
    else update({ merchantName: name });
  }

  function nextSuggestion() {
    if (!form) return;
    const v = variant + 1;
    setVariant(v);
    const s = sampleTexts(form.template, form.productName, v);
    update({ texts: { ...form.texts, taglineFr: s.taglineFr, taglineAr: s.taglineAr, ctaFr: s.ctaFr, ctaAr: s.ctaAr, badgeFr: s.badgeFr, badgeAr: s.badgeAr } });
  }

  function fillSample() {
    if (!form || !window.confirm(a.sampleConfirm)) return;
    const s = SAMPLE_DATA[form.template];
    update({
      merchantName: s.merchantName,
      productName: s.productName,
      price: String(s.price),
      city: s.city,
      whatsapp: s.whatsapp,
      contactLine: s.contactLine,
      texts: sampleTexts(form.template, s.productName, variant, s.productNameAr),
    });
  }

  async function aiWrite() {
    if (!form) return;
    setBusy("ai");
    try {
      const p = payload(form);
      const d = await api<{ texts: PosterTexts }>("/api/ai/copy", {
        method: "POST",
        body: JSON.stringify({ template: p.template, productName: p.productName, description: p.description, price: p.price, currency: p.currency, city: p.city }),
      });
      update({ texts: { ...form.texts, ...d.texts } });
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(a.deleteConfirm)) return;
    try {
      await api(`/api/posters/${id}`, { method: "DELETE" });
      setDirty(false);
      router.replace("/atelier");
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    }
  }

  const size = useMemo(() => FORMATS[form?.format ?? "square"], [form?.format]);

  if (!form || !poster) {
    return <div className="mx-auto max-w-6xl px-6 py-16 text-slate-600">{message?.text ?? a.loading}</div>;
  }

  const textFields: [TextKey, TextKey][] = [
    ["headlineFr", "headlineAr"],
    ["taglineFr", "taglineAr"],
    ["ctaFr", "ctaAr"],
    ["badgeFr", "badgeAr"],
  ];
  const showFr = form.language !== "ar";
  const showAr = form.language !== "fr";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/atelier" className="text-sm text-indigo-600 hover:underline">
            {a.back}
          </Link>
          <h1 className="mt-1 truncate text-2xl font-bold">{form.productName || a.untitled}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[poster.status]}`}>{a.status[poster.status]}</span>
            {poster.orderId && (
              <Link href={`/orders/${poster.orderId}`} className="text-slate-500 hover:underline">
                {a.fromOrder}
              </Link>
            )}
            <span className={dirty ? "text-amber-600" : "text-slate-400"}>{busy === "save" ? a.saving : dirty ? a.unsaved : a.saved}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fillSample} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
            {a.fillSample}
          </button>
          <button
            onClick={() => save()}
            disabled={!!busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {a.save}
          </button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-4 py-2 text-sm ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Aperçu */}
        <div className="lg:order-2">
          <div className="lg:sticky lg:top-20">
            <div className="mb-3 flex justify-center">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="tablist">
                {(["poster", "video"] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`rounded-md px-4 py-1.5 ${tab === k ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    {k === "poster" ? `🖼 ${a.tabPoster}` : `🎬 ${a.tabVideo}`}
                  </button>
                ))}
              </div>
            </div>
            <div hidden={tab !== "poster"}>
            <div className="mx-auto rounded-2xl bg-slate-200 p-3" style={{ maxWidth: form.format === "story" ? 400 : 600 }}>
              <canvas
                ref={canvasRef}
                width={size.width}
                height={size.height}
                aria-label="Aperçu de l'affiche"
                className="block h-auto w-full rounded-lg bg-white shadow"
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={exportPng} disabled={!fontsReady} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                ⬇ {a.exportPng}
              </button>
              <button
                onClick={saveFile}
                disabled={!!busy || !fontsReady}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "image" ? a.saving : a.saveFile}
              </button>
            </div>
            {poster.imageKey && (
              <p className={`mt-2 text-center text-xs ${imageOutdated ? "text-amber-600" : "text-emerald-700"}`}>
                {imageOutdated ? a.imageOutdated : `✓ ${a.imageSaved}`}
              </p>
            )}
            </div>
            {tab === "video" && (
              <VideoPanel
                input={videoInput}
                ready={fontsReady}
                labels={a.video}
                savedVideoUrl={poster.videoKey ? fileUrl(poster.videoKey) : null}
                fileSlug={(form.productName || "video").normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase()}
                onSave={saveVideo}
              />
            )}
          </div>
        </div>

        {/* Formulaire */}
        <div className="space-y-5 lg:order-1">
          <Section title={a.design}>
            <Field label={a.template}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {TEMPLATE_IDS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update({ template: t })}
                    className={`rounded-xl p-1.5 text-xs font-semibold ring-2 ${form.template === t ? "ring-indigo-600" : "ring-transparent hover:ring-slate-300"}`}
                  >
                    <span className="block h-10 rounded-lg border border-slate-200" style={{ background: `linear-gradient(135deg, ${TEMPLATES[t].swatch[0]} 50%, ${TEMPLATES[t].swatch[1]} 50%)` }} />
                    <span className="mt-1 block">{locale === "ar" ? TEMPLATES[t].nameAr : TEMPLATES[t].nameFr}</span>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={a.format}>
                <select className={input} value={form.format} onChange={(e) => update({ format: e.target.value as FormatId })}>
                  {(Object.keys(FORMATS) as FormatId[]).map((f) => (
                    <option key={f} value={f}>
                      {locale === "ar" ? FORMATS[f].labelAr : FORMATS[f].labelFr}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={a.language}>
                <select className={input} value={form.language} onChange={(e) => update({ language: e.target.value as PosterLanguage })}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {a.langs[l]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title={a.merchant}>
            <Field label={a.merchantName}>
              <input className={input} list="merchants" value={form.merchantName} onChange={(e) => chooseMerchant(e.target.value)} />
              <datalist id="merchants">
                {merchants.map((m) => (
                  <option key={m.merchantName} value={m.merchantName} />
                ))}
              </datalist>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={a.whatsapp}>
                <input className={input} inputMode="tel" dir="ltr" value={form.whatsapp} onChange={(e) => update({ whatsapp: e.target.value })} placeholder="222 …" />
              </Field>
              <Field label={a.city}>
                <input className={input} value={form.city} onChange={(e) => update({ city: e.target.value })} />
              </Field>
            </div>
            <Field label={a.contactLine}>
              <input className={input} value={form.contactLine} onChange={(e) => update({ contactLine: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3">
              {form.logoKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(form.logoKey)!} alt="" className="h-14 w-14 rounded-full bg-white object-contain ring-1 ring-slate-200" />
              )}
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                {busy === "logo" ? a.uploading : a.addLogo}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setLogo(e.target.files?.[0])} />
              </label>
              {form.logoKey && (
                <button type="button" onClick={() => update({ logoKey: null })} className="text-sm text-red-600 hover:underline">
                  {a.remove}
                </button>
              )}
            </div>
          </Section>

          <Section title={a.product}>
              <Field label={a.productName}>
                <input
                  className={input}
                  value={form.productName}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Le titre suit le nom du produit, sauf s'il a été personnalisé.
                    const follow = !form.texts.headlineFr || form.texts.headlineFr === form.productName;
                    update({ productName: v, texts: follow ? { ...form.texts, headlineFr: v } : form.texts });
                  }}
                />
              </Field>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label={a.price}>
                <input className={input} inputMode="numeric" dir="ltr" value={form.price} onChange={(e) => update({ price: e.target.value.replace(/[^\d\s]/g, "") })} />
              </Field>
              <Field label={"\u00a0"}>
                <select className={input} value={form.currency} onChange={(e) => update({ currency: e.target.value })}>
                  <option>MRU</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </Field>
            </div>
            <Field label={a.description}>
              <textarea className={input} rows={3} value={form.description} onChange={(e) => update({ description: e.target.value })} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{a.photos}</p>
              <div className="flex flex-wrap gap-3">
                {form.photoKeys.map((k, i) => (
                  <div key={k} className="relative w-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(k)!} alt="" className={`h-24 w-24 rounded-lg object-cover ring-2 ${i === 0 ? "ring-indigo-600" : "ring-slate-200"}`} />
                    <div className="mt-1 flex flex-col text-[11px] leading-tight">
                      {i === 0 ? (
                        <span className="font-semibold text-indigo-700">{a.mainPhoto}</span>
                      ) : (
                        <button type="button" className="text-start text-slate-600 hover:underline" onClick={() => update({ photoKeys: [k, ...form.photoKeys.filter((x) => x !== k)] })}>
                          {a.makeMain}
                        </button>
                      )}
                      <button type="button" className="text-start text-red-600 hover:underline" onClick={() => update({ photoKeys: form.photoKeys.filter((x) => x !== k) })}>
                        {a.remove}
                      </button>
                    </div>
                  </div>
                ))}
                {form.photoKeys.length < 6 && (
                  <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-xs font-medium text-slate-500 hover:border-indigo-400">
                    {busy === "photos" ? a.uploading : `+ ${a.addPhotos}`}
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                )}
              </div>
            </div>
          </Section>

          <Section
            title={a.texts}
            right={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={nextSuggestion} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                  ↻ {a.otherSuggestion}
                </button>
                {aiConfigured && (
                  <button type="button" onClick={aiWrite} disabled={!!busy} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                    {busy === "ai" ? "…" : `✦ ${a.aiGenerate}`}
                  </button>
                )}
              </div>
            }
          >
            <p className="text-xs text-slate-500">{aiConfigured ? a.sampleNote : `${a.sampleNote} ${a.aiOff}`}</p>
            {textFields.map(([frK, arK]) => (
              <div key={frK} className={`grid gap-3 ${showFr && showAr ? "sm:grid-cols-2" : ""}`}>
                {showFr && (
                  <Field label={a[frK]}>
                    <input className={input} value={form.texts[frK] ?? ""} onChange={(e) => setText(frK, e.target.value)} />
                  </Field>
                )}
                {showAr && (
                  <Field label={a[arK]}>
                    <input className={input} dir="rtl" value={form.texts[arK] ?? ""} onChange={(e) => setText(arK, e.target.value)} />
                  </Field>
                )}
              </div>
            ))}
          </Section>

          <Section title={a.tracking}>
            <Field label={a.publicationUrl}>
              <input className={input} dir="ltr" type="url" placeholder="https://…" value={form.publicationUrl} onChange={(e) => update({ publicationUrl: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {poster.status !== "sent" && poster.status !== "published" && (
                <button onClick={() => setStatus("sent")} disabled={!!busy} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                  {a.markSent}
                </button>
              )}
              {poster.status !== "validated" && poster.status !== "published" && (
                <button onClick={() => setStatus("validated")} disabled={!!busy} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                  {a.markValidated}
                </button>
              )}
              {poster.status !== "published" && (
                <button onClick={() => setStatus("published")} disabled={!!busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {a.markPublished}
                </button>
              )}
              {poster.status !== "draft" && (
                <button onClick={() => setStatus("draft")} disabled={!!busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                  {a.backToDraft}
                </button>
              )}
            </div>
            {poster.publicationUrl && poster.status === "published" && (
              <a href={poster.publicationUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-600 hover:underline" dir="ltr">
                {poster.publicationUrl}
              </a>
            )}
            {poster.status === "draft" && (
              <button onClick={remove} className="text-sm text-red-600 hover:underline">
                {a.delete}
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
