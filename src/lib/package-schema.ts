import { z } from "zod";
import { NETWORKS } from "@/lib/validation";

export const packageSchema = z.object({
  nameFr: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).nullable(),
  descFr: z.string().max(2000).nullable(),
  descAr: z.string().max(2000).nullable(),
  price: z.number().int().min(0).max(100_000_000),
  currency: z.enum(["MRU"]),
  featuresFr: z.array(z.string().max(200)).max(20),
  featuresAr: z.array(z.string().max(200)).max(20),
  networks: z.array(z.enum(NETWORKS)).max(4),
  languages: z.array(z.enum(["fr", "ar"])).max(2),
  corrections: z.number().int().min(0).max(20),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
});
