import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Évite que Next.js prenne C:\Users\lenovo comme racine à cause d'un package-lock.json parasite.
  turbopack: { root: __dirname },
};

export default nextConfig;
