import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { getEffectiveErpPermissions, getFirstAccessibleDashboardHref } from "@/lib/clerk/erp-rbac";

export default async function Page() {
  const session = await auth();
  const permissionKeys = await getEffectiveErpPermissions(session);

  redirect(getFirstAccessibleDashboardHref(session, { permissionKeys }));
}
