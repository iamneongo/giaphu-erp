import { auth } from "@clerk/nextjs/server";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { DashboardLink } from "../_components/dashboard-link";
import { OrganizationManager } from "./_components/organization-manager";

export const metadata = {
  title: "Tổ chức | Gia Phú ERP",
};

export default async function Page() {
  const session = await auth();

  if (session.orgId) {
    await enforceErpRoutePermission(ERP_PERMISSIONS.organizationsManage);
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">Quản lý tổ chức</h1>
        </div>
        <Button asChild variant="outline">
          <DashboardLink href="/dashboard/workspaces/roles">
            <ShieldCheck />
            Vai trò & quyền
          </DashboardLink>
        </Button>
      </div>

      <div className="grid gap-4">
        <OrganizationManager />
      </div>
    </div>
  );
}
