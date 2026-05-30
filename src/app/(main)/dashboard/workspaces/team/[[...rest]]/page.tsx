import Link from "next/link";

import { auth } from "@clerk/nextjs/server";
import { ShieldCheck, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { TeamManager } from "../../_components/team-manager";

export const metadata = {
  title: "Phân quyền | Gia Phú ERP",
};

export default async function Page() {
  const { orgId, orgRole, has } = await auth();
  const canManageRoles = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has({ role }),
      hasPermission: (permission) => has({ permission }),
    },
    ERP_PERMISSIONS.rolesManage,
    { allowLegacyMember: false },
  );

  if (!orgId) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Thành viên và phân quyền</h1>
        </div>
        <Card className="max-w-2xl">
          <CardHeader className="border-b">
            <CardTitle>Chưa có tổ chức hoạt động</CardTitle>
            <CardDescription>Hãy vào trang tổ chức để tạo hoặc chọn workspace trong Clerk.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/workspaces">
                <UsersRound />
                Mở quản lý tổ chức
              </Link>
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
          <h1 className="text-3xl font-semibold tracking-tight">Thành viên và phân quyền</h1>
        </div>
        <Card className="max-w-2xl">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Không đủ quyền quản trị
            </CardTitle>
            <CardDescription>
              Hãy nhờ một quản trị viên tổ chức cấp vai trò `org:admin` nếu bạn cần mời thành viên hoặc chỉnh quyền.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/workspaces">Quay lại tổ chức</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/workspaces/roles">Vai trò & quyền</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Về ERP</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Thành viên</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/workspaces/roles">Mở vai trò & quyền</Link>
        </Button>
      </div>
      <TeamManager />
    </div>
  );
}
