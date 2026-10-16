"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAtelierText } from "@/lib/atelier-i18n";

// Crée un brouillon (éventuellement depuis une commande) puis ouvre l'éditeur.
function Create() {
  const router = useRouter();
  const params = useSearchParams();
  const { a } = useAtelierText();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const body: Record<string, string> = {};
    const order = params.get("order");
    const template = params.get("template");
    if (order) body.orderId = order;
    if (template) body.template = template;
    fetch("/api/posters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Erreur");
        router.replace(`/atelier/${d.poster.id}`);
      })
      .catch((e: Error) => setError(e.message));
  }, [params, router]);

  return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-slate-600">{error ? <p className="text-red-600">{error}</p> : a.loading}</div>;
}

export default function NewPosterPage() {
  return (
    <Suspense>
      <Create />
    </Suspense>
  );
}
