"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useT } from "@/components/LanguageProvider";

type User = { id: string; name: string; email: string; role: string } | null;

export default function Navbar() {
  const [user, setUser] = useState<User>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { locale, setLocale } = useLocale();
  const t = useT();

  // Revérifié à chaque changement de page : après connexion ou inscription,
  // la navigation se fait sans rechargement et le menu doit se mettre à jour.
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold text-slate-900">
          I3LANAK <span className="text-xs text-slate-500">by IT-RIM</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900">{t("nav.home")}</Link>
          <Link href="/packages" className="text-slate-600 hover:text-slate-900">{t("nav.packages")}</Link>
          <Link href="/order" className="text-slate-600 hover:text-slate-900">{t("nav.order")}</Link>
          {user && (
            <>
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">{t("nav.dashboard")}</Link>
              {user.role !== "client" && (
                <>
                  <Link href="/atelier" className="font-semibold text-indigo-700 hover:text-indigo-900">{t("nav.atelier")}</Link>
                  <Link href="/studio" className="text-slate-600 hover:text-slate-900">{t("nav.studio")}</Link>
                </>
              )}
              {user.role === "admin" && (
                <Link href="/admin" className="text-slate-600 hover:text-slate-900">{t("nav.admin")}</Link>
              )}
            </>
          )}
          <button
            onClick={() => setLocale(locale === "fr" ? "ar" : "fr")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
          >
            {locale === "fr" ? "AR" : "FR"}
          </button>
          {user ? (
            <>
              <button onClick={logout} className="text-slate-600 hover:text-slate-900">{t("nav.logout")}</button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">{t("nav.login")}</Link>
              <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700">{t("nav.register")}</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}