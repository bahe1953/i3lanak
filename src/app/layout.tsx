import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/components/LanguageProvider";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "I3LANAK — إعلانك | by IT-RIM Mauritanie",
  description: "Agence publicitaire numérique assistée par l'IA.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value as Locale) || "fr";
  const initial: Locale = lang === "ar" ? "ar" : "fr";
  return (
    <html lang={initial} dir={initial === "ar" ? "rtl" : "ltr"}>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <LanguageProvider initial={initial}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
