"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/components/LanguageProvider";

type Pkg = {
  id: string;
  nameFr: string;
  nameAr: string | null;
  descFr: string | null;
  descAr: string | null;
  price: number;
  currency: string;
  featuresFr: string[];
  featuresAr: string[];
  networks: string[];
  corrections: number;
};

export default function PackagesPage() {
  const { locale } = useLocale();
  const t = useT();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">{t("nav.packages")}</h1>
      {loading ? (
        <p className="mt-8">{t("common.loading")}</p>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => {
            const name = locale === "ar" ? p.nameAr || p.nameFr : p.nameFr;
            const desc = locale === "ar" ? p.descAr || p.descFr : p.descFr;
            const features = locale === "ar" ? p.featuresAr || p.featuresFr : p.featuresFr;
            return (
              <div key={p.id} className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">{name}</h3>
                <p className="mt-2 text-slate-600">{desc}</p>
                <p className="mt-4 text-3xl font-bold">
                  {p.price} <span className="text-base font-normal">{p.currency}</span>
                </p>
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  {features.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
                <Link
                  href={`/order?package=${p.id}`}
                  className="mt-6 block rounded-lg bg-indigo-600 py-2 text-center font-semibold text-white hover:bg-indigo-700"
                >
                  {t("hero.ctaOrder")}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}