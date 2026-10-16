"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/LanguageProvider";

type User = {
  id: string;
  name: string;
  email: string;
  role: "client" | "operator" | "admin";
};

type AuthGateProps = {
  children: (user: User) => ReactNode;
  roles?: User["role"][];
};

export default function AuthGate({ children, roles }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (!response.ok) {
          const query = window.location.search;
          const next = `${pathname}${query}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          if (active) setState("denied");
          return;
        }
        const data = await response.json();
        const currentUser = data.user as User | null;
        if (!currentUser) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          if (active) setState("denied");
          return;
        }
        if (roles && !roles.includes(currentUser.role)) {
          if (active) setState("denied");
          return;
        }
        if (active) {
          setUser(currentUser);
          setState("allowed");
        }
      } catch {
        if (active) setState("denied");
      }
    }
    checkSession();
    return () => {
      active = false;
    };
  }, [pathname, router, roles]);

  if (state === "checking") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-slate-600">
        {locale === "ar" ? "جارٍ التحقق من الجلسة..." : "Vérification de la session..."}
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {locale === "ar" ? "الوصول غير مسموح" : "Accès non autorisé"}
        </h1>
        <p className="mt-2 text-slate-600">
          {roles
            ? locale === "ar"
              ? "هذه الصفحة مخصصة لفريق IT-RIM المصرح له."
              : "Cette page est réservée à l’équipe IT-RIM autorisée."
            : locale === "ar"
              ? "سيتم توجيهك إلى صفحة تسجيل الدخول."
              : "Redirection vers la page de connexion..."}
        </p>
      </div>
    );
  }

  return <>{user ? children(user) : null}</>;
}