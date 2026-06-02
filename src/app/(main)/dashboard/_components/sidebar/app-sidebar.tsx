"use client";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import type { ProjectRow } from "@/lib/giaphu-erp/types";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

import { NavMain } from "./nav-main";
import { ProjectSwitcher } from "./project-switcher";
import { SidebarUserInfo } from "./sidebar-user-info";
export function AppSidebar({
  initialProjects = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & { initialProjects?: ProjectRow[] }) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-2 group-data-[collapsible=icon]:pt-4">
        <ProjectSwitcher initialProjects={initialProjects} />
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserInfo />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
