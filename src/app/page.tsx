"use client";

import Link from "next/link";
import { useT, useLocale } from "@/components/LanguageProvider";
import { dict } from "@/lib/i18n";

const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "22200000000";

export default function HomePage() {
  const t = useT();
  const { locale } = useLocale();
  return (
    <div>
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">I3LANAK — إعلانك</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 md:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{t("hero.subtitle")}</p>
        <p className="mt-2 text-base font-medium text-slate-700">
          {locale === "fr" ? "Votre produit mérite une publicité exceptionnelle." : "منتجك يستحق إعلانًا مميزًا."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/order" className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
            {t("hero.ctaOrder")}
          </Link>
          <a
            href={`https://wa.me/${WA}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-green-500 px-6 py-3 font-semibold text-green-600 hover:bg-green-50"
          >
            {t("hero.ctaWhatsapp")}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-4">
          {(dict as any)[locale].advantages.map((a: string) => (
            <div key={a} className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="font-semibold">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center text-3xl font-bold">{t("steps.title")}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(dict as any)[locale].steps.items.map((s: string, i: number) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-sm">
              <span className="text-2xl font-bold text-indigo-600">{i + 1}</span>
              <p className="mt-2">{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center text-3xl font-bold">{t("faq.title")}</h2>
        <div className="mt-8 space-y-4">
          {(dict as any)[locale].faq.items.map((f: any, i: number) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="font-semibold">{f.q}</p>
              <p className="mt-2 text-slate-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 text-center">
        <Link href="/packages" className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800">
          {t("nav.packages")}
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        {t("footer")}
      </footer>
    </div>
  );
}