import { auth } from "@clerk/nextjs/server";
import { ShieldCheck, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEffectiveErpPermissions } from "@/lib/clerk/erp-rbac";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { DashboardLink } from "../../../_components/dashboard-link";
import { TeamManager } from "../../_components/team-manager";

export const metadata = {
  title: "Thành viên | Gia Phú ERP",
};

export default async function Page() {
  const session = await auth();
  const { orgId, orgRole, has } = session;
  const permissionKeys = await getEffectiveErpPermissions(session);
  const canManageRoles = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has({ role }),
      hasPermission: (permission) => has({ permission }),
      permissionKeys,
    },
    ERP_PERMISSIONS.rolesManage,
    { allowLegacyMember: false },
  );

  if (!orgId) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">Thành viên</h1>
        </div>
        <Card className="max-w-2xl">
          <CardHeader className="border-b">
            <CardTitle>Chưa có tổ chức hoạt động</CardTitle>
            <CardDescription>Hãy vào trang tổ chức để tạo hoặc chọn workspace trong Clerk.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <DashboardLink href="/dashboard/workspaces">
                <UsersRound />
                Mở quản lý tổ chức
              </DashboardLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManageRoles) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">Thành viên</h1>
        </div>
        <Card className="max-w-2xl">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Không đủ quyền quản trị
            </CardTitle>
            <CardDescription>
              Hãy nhờ quản trị viên cấp quyền Thành viên hoặc Vai trò nếu bạn cần mời thành viên hay chỉnh quyền.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <DashboardLink href="/dashboard/workspaces">Quay lại tổ chức</DashboardLink>
            </Button>
            <Button asChild variant="outline">
              <DashboardLink href="/dashboard/workspaces/roles">Vai trò & quyền</DashboardLink>
            </Button>
            <Button asChild>
              <DashboardLink href="/dashboard">Về ERP</DashboardLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-2">
        <h1 className="font-semibold text-3xl tracking-tight">Thành viên</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <DashboardLink href="/dashboard/workspaces/roles">Mở vai trò & quyền</DashboardLink>
        </Button>
      </div>
      <TeamManager />
    </div>
  );
}
