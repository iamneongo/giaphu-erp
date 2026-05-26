import { enforceErpRoutePermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac";

import { DocumentsWorkspace } from "../_components/documents-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.documentsRead);
  return <DocumentsWorkspace />;
}
