import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { auth } from "@clerk/nextjs/server";

import { filterGiaPhuDashboardDataByPermissions, getEffectiveErpPermissions } from "@/lib/clerk/erp-rbac";
import { getGiaPhuDashboardData } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { decodeProjectRouteSegment } from "@/lib/giaphu-erp/project-routes";

import { GiaPhuErpProvider } from "./_hooks/use-giaphu-erp";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const session = await auth();
  const [data, effectivePermissions] = await Promise.all([
    getGiaPhuDashboardData({
      organizationId: session.orgId ?? "",
      activeProjectCode: decodeProjectRouteSegment(cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value ?? ""),
    }),
    getEffectiveErpPermissions(session),
  ]);

  return (
    <GiaPhuErpProvider initialData={filterGiaPhuDashboardDataByPermissions(data, session, effectivePermissions)}>
      {children}
    </GiaPhuErpProvider>
  );
}
