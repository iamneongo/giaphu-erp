import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { ZaloMaterialBreakdownPage } from "../../_components/zalo-material-breakdown-page";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);

  return (
    <ZaloMaterialBreakdownPage
      allowedMaterialTypes={["VT Phụ"]}
      initialMaterialType="VT Phụ"
      title="Vật tư phụ"
      description="Nhập vật tư phụ từ tin nhắn Zalo hoặc thêm thủ công."
    />
  );
}
