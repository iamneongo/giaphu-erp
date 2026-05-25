import { createGiaPhuSchema } from "../lib/giaphu-erp/db";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const envFile of [".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);

  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function main() {
  await createGiaPhuSchema();
  console.log("GiaPhu ERP Neon schema is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
