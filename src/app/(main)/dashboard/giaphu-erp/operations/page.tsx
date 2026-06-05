import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { SubcontractorsWorkspace } from "../_components/subcontractors-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.subcontractorsRead);
  return <SubcontractorsWorkspace section="operations" />;
}
