import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { createGiaPhuSchema, getGiaPhuDashboardData } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";

import { GiaPhuErpProvider } from "./_hooks/use-giaphu-erp";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  await createGiaPhuSchema();
  const cookieStore = await cookies();
  const data = await getGiaPhuDashboardData({
    activeProjectCode: cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value,
  });

  return <GiaPhuErpProvider initialData={data}>{children}</GiaPhuErpProvider>;
}
