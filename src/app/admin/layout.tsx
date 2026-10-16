import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) redirect("/login?next=/admin");
  return <>{children}</>;
}
