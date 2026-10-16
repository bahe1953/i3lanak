import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// La connexion est créée au premier usage (et non à l'import) :
// le build Vercel peut ainsi se faire même si la base n'est pas joignable.
const globalForDb = globalThis as typeof globalThis & {
  __i3lanakPool?: Pool;
  __i3lanakDb?: NodePgDatabase;
};

function getDb(): NodePgDatabase {
  if (globalForDb.__i3lanakDb) return globalForDb.__i3lanakDb;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquante : configurez-la dans les variables d'environnement.");
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    // Fonctions serverless : peu de connexions par instance.
    max: process.env.VERCEL ? 3 : 10,
  });
  globalForDb.__i3lanakPool = pool;
  globalForDb.__i3lanakDb = drizzle(pool);
  return globalForDb.__i3lanakDb;
}

export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
