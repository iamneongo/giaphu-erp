import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DashboardLink } from "../_components/dashboard-link";
import { OrganizationManager } from "./_components/organization-manager";

export const metadata = {
  title: "Tổ chức | Gia Phú ERP",
};

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Quản lý tổ chức</h1>
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
