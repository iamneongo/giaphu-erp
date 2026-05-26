import { enforceOrganizationRoleManagement } from "@/lib/clerk/erp-rbac";

import { RoleManager } from "../_components/role-manager";

export const metadata = {
  title: "Vai trò & quyền | Gia Phú ERP",
};

export default async function Page() {
  await enforceOrganizationRoleManagement();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Vai trò và quyền động</h1>
      </div>
      <RoleManager />
    </div>
  );
}
