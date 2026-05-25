import type { ReactNode } from "react";

import { createGiaPhuSchema, getGiaPhuDashboardData } from "@/lib/giaphu-erp/db";

import { GiaPhuErpProvider } from "./_hooks/use-giaphu-erp";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  await createGiaPhuSchema();
  const data = await getGiaPhuDashboardData();

  return <GiaPhuErpProvider initialData={data}>{children}</GiaPhuErpProvider>;
}
