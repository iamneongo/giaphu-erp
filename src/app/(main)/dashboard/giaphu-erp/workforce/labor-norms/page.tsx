import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { WorkforceWorkspace } from "../../_components/workforce-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.workforceRead);
  return <WorkforceWorkspace section="laborNorms" />;
}
