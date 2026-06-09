import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { MaterialEditorPage } from "../../../../_components/material-editor-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
  const { id } = await params;

  return <MaterialEditorPage materialId={id} materialType="VT Phụ" mode="edit" />;
}
