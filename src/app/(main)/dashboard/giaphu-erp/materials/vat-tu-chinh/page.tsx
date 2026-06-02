import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { ZaloMaterialBreakdownPage } from "../../_components/zalo-material-breakdown-page";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);

  return (
    <ZaloMaterialBreakdownPage
      allowedMaterialTypes={["VT Chính"]}
      initialMaterialType="VT Chính"
      title="Vật tư chính"
      description="Nhập vật tư chính bằng phân rã Zalo hoặc thêm tay thủ công, sau đó đối soát và chốt lưu ERP."
    />
  );
}
