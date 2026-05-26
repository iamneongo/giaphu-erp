import { enforceErpRoutePermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac";

import { MaterialsWorkspace } from "../../_components/materials-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsRead);
  return <MaterialsWorkspace section="entries" />;
}
