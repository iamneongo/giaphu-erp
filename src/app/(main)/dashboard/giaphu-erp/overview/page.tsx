import { enforceErpRoutePermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac";

import { OverviewDashboard } from "../_components/overview-dashboard";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.overviewRead);
  return <OverviewDashboard />;
}
