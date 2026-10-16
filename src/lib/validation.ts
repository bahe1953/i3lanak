import { z } from "zod";
import { isValidKey, ownerOfKey } from "@/lib/storage";

export const NETWORKS = ["facebook", "instagram", "tiktok", "whatsapp"] as const;
export const ORDER_STATUSES = [
  "draft", "quote_sent", "awaiting_payment", "payment_to_verify", "paid", "in_production",
  "awaiting_client_validation", "ready_to_publish", "publishing", "completed", "delivered", "cancelled",
] as const;

const optText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

/** Clé de fichier valide ET appartenant à l'utilisateur (dans le bon dossier). */
export const ownKey = (userId: string, folder: string) =>
  z.string().refine((k) => isValidKey(k) && ownerOfKey(k) === userId && k.split("/")[2] === folder, {
    message: "Fichier invalide",
  });

export const orderCreateSchema = (userId: string) =>
  z.object({
    merchantName: z.string().trim().min(1, "Nom du commerçant requis").max(160),
    productName: z.string().trim().min(1, "Nom du produit requis").max(160),
    category: optText(80),
    description: optText(2000),
    sellingPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
    currency: z.enum(["MRU", "EUR", "USD"]).default("MRU"),
    adLanguage: z.enum(["fr", "ar", "both"]).default("fr"),
    targetCity: optText(120),
    whatsapp: z.string().trim().regex(/^\+?[0-9 ]{6,20}$/, "Numéro WhatsApp invalide").optional().nullable().or(z.literal("")),
    contactInfo: optText(500),
    networks: z.array(z.enum(NETWORKS)).max(4).default([]),
    objective: optText(1000),
    packageId: z.string().uuid().optional().nullable().or(z.literal("")),
    instructions: optText(2000),
    photoKeys: z.array(ownKey(userId, "photos")).max(8).default([]),
    logoKey: ownKey(userId, "logos").optional().nullable(),
  });

export const orderStaffUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    quotedPrice: z.number().int().min(0).nullable(),
    finalPrice: z.number().int().min(0).nullable(),
    instructions: z.string().max(2000).nullable(),
  })
  .partial()
  .strict();

export const orderClientUpdateSchema = z.object({ instructions: z.string().max(2000).nullable() }).strict();

export function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Données invalides";
}
