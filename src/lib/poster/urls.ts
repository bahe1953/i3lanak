import { fileUrl } from "@/lib/storage";

export function withUrls<T extends { photoKeys: string[]; logoKey: string | null; imageKey: string | null }>(p: T) {
  return {
    ...p,
    photoUrls: p.photoKeys.map((k) => fileUrl(k)!),
    logoUrl: fileUrl(p.logoKey),
    imageUrl: fileUrl(p.imageKey),
  };
}
