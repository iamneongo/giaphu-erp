import { enforceOrganizationRoleManagement } from "@/lib/clerk/erp-rbac";

import { RoleEditorPage } from "../../_components/role-editor-page";

export const metadata = {
  title: "Tạo vai trò | Gia Phú ERP",
};

export default async function Page() {
  await enforceOrganizationRoleManagement();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Tạo vai trò</h1>
      </div>
      <RoleEditorPage mode="create" />
    </div>
  );
}
