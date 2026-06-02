import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { auth } from "@clerk/nextjs/server";

import { getGiaPhuDashboardData } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";

import { GiaPhuErpProvider } from "./_hooks/use-giaphu-erp";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const session = await auth();
  const data = await getGiaPhuDashboardData({
    organizationId: session.orgId ?? "",
    activeProjectCode: cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value,
  });

  return <GiaPhuErpProvider initialData={data}>{children}</GiaPhuErpProvider>;
}
