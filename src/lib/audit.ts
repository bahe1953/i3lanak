import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/** Journalise une opération sensible. Ne bloque jamais l'action en cas d'échec. */
export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    await db.insert(auditLogs).values({ userId, action, entityType, entityId, details });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
