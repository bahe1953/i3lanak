import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Protection côté serveur : la page n'est jamais envoyée à un non-membre de l'équipe.
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getStaffUser();
  if (!user) redirect("/login?next=/atelier");
  return <>{children}</>;
}
