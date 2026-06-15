import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { ActivityLogManager } from "../_components/activity-log-manager";

export const metadata = {
  title: "Lịch sử hoạt động | Gia Phú ERP",
};

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.organizationsManage, { allowLegacyMember: false });

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">Lịch sử hoạt động</h1>
      </div>
      <ActivityLogManager />
    </div>
  );
}
