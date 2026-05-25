import { neon } from "@neondatabase/serverless";

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL);
}

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Add your Neon connection string to .env.local.");
  }

  return neon(databaseUrl);
}
