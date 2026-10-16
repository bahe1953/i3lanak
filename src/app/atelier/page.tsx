"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAtelierText, STATUS_STYLE } from "@/lib/atelier-i18n";
import { POSTER_STATUSES, TEMPLATES, formatPrice, type PosterStatus, type TemplateId } from "@/lib/poster/catalog";

type Poster = {
  id: string;
  merchantName: string;
  productName: string;
  price: number | null;
  currency: string;
  template: TemplateId;
  format: string;
  status: PosterStatus;
  updatedAt: string;
  imageUrl: string | null;
  photoUrls: string[];
};

export default function AtelierPage() {
  const { a, locale } = useAtelierText();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PosterStatus | "">("");
  const [posters, setPosters] = useState<Poster[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (status) params.set("status", status);
        const r = await fetch(`/api/posters?${params}`, { signal: ctrl.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Erreur");
        setPosters(d.posters);
        setError("");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, status]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{a.title}</h1>
          <p className="mt-1 text-slate-600">{a.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio" className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
            {a.orders}
          </Link>
          <Link href="/atelier/nouveau" className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
            + {a.newPoster}
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={a.search}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2"
        />
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {(["", ...POSTER_STATUSES] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1.5 font-medium ${status === s ? "bg-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {s ? a.status[s] : a.all}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-6 text-red-600">{error}</p>}
      {posters === null && !error && <p className="mt-10 text-slate-500">{a.loading}</p>}
      {posters?.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold">{a.empty}</p>
          <p className="mt-1 text-sm text-slate-500">{a.emptyHint}</p>
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posters?.map((p) => {
          const thumb = p.imageUrl ?? p.photoUrls[0];
          const tpl = TEMPLATES[p.template] ?? TEMPLATES.shop;
          return (
            <Link key={p.id} href={`/atelier/${p.id}`} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 hover:shadow-md">
              <div className="flex aspect-square items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${tpl.swatch[0]}, ${tpl.swatch[1]})` }}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-contain transition group-hover:scale-[1.02]" />
                ) : (
                  <span className="text-sm font-semibold text-white/80">{locale === "ar" ? tpl.nameAr : tpl.nameFr}</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.productName || a.untitled}</p>
                    <p className="truncate text-sm text-slate-500">{p.merchantName || "—"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>{a.status[p.status]}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {locale === "ar" ? tpl.nameAr : tpl.nameFr} · {p.format === "story" ? "Story" : "1:1"}
                  </span>
                  <span>{p.price != null ? formatPrice(p.price, p.currency) : ""}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
