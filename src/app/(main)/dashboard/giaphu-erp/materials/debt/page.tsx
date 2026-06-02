import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { MaterialDebtWorkspace } from "../../_components/material-debt-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsRead);
  return <MaterialDebtWorkspace />;
}
