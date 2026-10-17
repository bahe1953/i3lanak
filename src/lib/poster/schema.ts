import { z } from "zod";
import { isValidKey } from "@/lib/storage";
import { FORMATS, LANGUAGES, POSTER_STATUSES, TEMPLATE_IDS, TEXT_KEYS } from "./catalog";

const key = (folder: string) =>
  z.string().refine((k) => isValidKey(k) && k.split("/")[2] === folder, { message: "Fichier invalide" });
const txt = (max: number) => z.string().trim().max(max);

export const posterUpdateSchema = z
  .object({
    merchantName: txt(160),
    whatsapp: z.string().trim().regex(/^(\+?[0-9 ]{6,20})?$/, "Numéro WhatsApp invalide"),
    city: txt(120),
    contactLine: txt(200),
    logoKey: key("logos").nullable(),
    productName: txt(160),
    description: txt(2000),
    price: z.number().int().min(0).max(10_000_000_000).nullable(),
    currency: z.enum(["MRU", "EUR", "USD"]),
    photoKeys: z.array(key("photos")).max(6),
    template: z.enum(TEMPLATE_IDS),
    format: z.enum(Object.keys(FORMATS) as [keyof typeof FORMATS]),
    language: z.enum(LANGUAGES),
    texts: z.object(Object.fromEntries(TEXT_KEYS.map((k) => [k, txt(220).optional()]))).strict(),
    imageKey: key("posters").nullable(),
    videoKey: key("videos").nullable(),
    status: z.enum(POSTER_STATUSES),
    publicationUrl: z.string().trim().url("Lien de publication invalide").max(500).nullable().or(z.literal("")),
  })
  .partial()
  .strict();

export type PosterUpdate = z.infer<typeof posterUpdateSchema>;
