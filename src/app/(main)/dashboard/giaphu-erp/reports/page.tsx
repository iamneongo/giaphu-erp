import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { ReportsWorkspace } from "../_components/reports-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.reportsRead);
  return <ReportsWorkspace />;
}
