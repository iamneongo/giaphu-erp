import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { MaterialEditorPage } from "../../../_components/material-editor-page";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);

  return <MaterialEditorPage materialType="VT Chính" mode="create" />;
}
