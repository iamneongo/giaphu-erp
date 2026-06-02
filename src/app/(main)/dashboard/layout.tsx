import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { auth } from "@clerk/nextjs/server";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getEffectiveErpPermissions } from "@/lib/clerk/erp-rbac";
import { createGiaPhuSchema, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";

import { DashboardBreadcrumbs } from "./_components/dashboard-breadcrumbs";
import { EffectivePermissionsProvider } from "./_components/effective-permissions-provider";
import { SearchDialog } from "./_components/sidebar/search-dialog";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const session = await auth();
  const organizationReady = Boolean(session.orgId);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  await createGiaPhuSchema();
  const [variant, collapsible, initialProjects, effectivePermissions] = await Promise.all([
    getPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
    getPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
    organizationReady ? getGiaPhuProjectList() : Promise.resolve([]),
    getEffectiveErpPermissions(session),
  ]);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <EffectivePermissionsProvider permissions={effectivePermissions}>
        <AppSidebar
          variant={variant}
          collapsible={collapsible}
          initialProjects={initialProjects}
          organizationReady={organizationReady}
          effectivePermissions={effectivePermissions}
        />
        <SidebarInset
          className={cn(
            "[html[data-content-layout=centered]_&>*]:mx-auto",
            "[html[data-content-layout=centered]_&>*]:w-full",
            "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
            "peer-data-[variant=inset]:border",
            "peer-data-[variant=inset]:overflow-hidden",
            "[--dashboard-header-height:--spacing(12)]",
          )}
        >
          <header
            className={cn(
              "sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/60 backdrop-blur-md md:h-14",
              "group-has-data-[collapsible=icon]/sidebar-wrapper:h-16 md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-14",
            )}
          >
            <div className="flex min-w-0 items-center gap-2 px-4">
              <SidebarTrigger variant="outline" className="-ml-1 bg-background shadow-none" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <DashboardBreadcrumbs />
            </div>
            <div className="hidden items-center gap-2 px-4 md:flex">
              <SearchDialog />
            </div>
          </header>
          {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
          <div className="h-full px-4 pt-2 pb-4 has-data-[content-padding=false]:p-0 md:px-6 md:pt-4 md:pb-6 md:has-data-[content-padding=false]:p-0">
            {children}
          </div>
        </SidebarInset>
      </EffectivePermissionsProvider>
    </SidebarProvider>
  );
}
