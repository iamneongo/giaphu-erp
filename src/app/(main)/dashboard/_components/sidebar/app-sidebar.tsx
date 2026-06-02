"use client";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import type { ErpPermissionKey } from "@/lib/clerk/erp-rbac-shared";
import type { ProjectRow } from "@/lib/giaphu-erp/types";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

import { NavMain } from "./nav-main";
import { ProjectSwitcher } from "./project-switcher";
import { SidebarUserInfo } from "./sidebar-user-info";
export function AppSidebar({
  initialProjects = [],
  organizationReady = true,
  effectivePermissions = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  initialProjects?: ProjectRow[];
  organizationReady?: boolean;
  effectivePermissions?: ErpPermissionKey[];
}) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-2 group-data-[collapsible=icon]:pt-4">
        <ProjectSwitcher initialProjects={initialProjects} organizationReady={organizationReady} />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <NavMain items={sidebarItems} effectivePermissions={effectivePermissions} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserInfo />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
