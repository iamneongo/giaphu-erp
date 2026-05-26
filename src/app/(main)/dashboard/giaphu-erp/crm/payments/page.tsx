import { enforceErpRoutePermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac";

import { CrmWorkspace } from "../../_components/crm-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.crmRead);
  return <CrmWorkspace section="payments" />;
}
