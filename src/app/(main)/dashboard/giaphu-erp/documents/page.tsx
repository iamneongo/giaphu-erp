import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { DocumentsWorkspace } from "../_components/documents-workspace";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.documentsRead);
  return <DocumentsWorkspace />;
}
