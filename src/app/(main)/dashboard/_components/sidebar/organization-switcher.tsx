"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function OrganizationSwitcher() {
  const router = useRouter();
  const { isMobile, state } = useSidebar();
  const { orgId } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
      keepPreviousData: false,
    },
  });

  const memberships = userMemberships?.data ?? [];
  const activeOrganization = memberships.find((membership) => membership.organization.id === orgId)?.organization;
  const displayOrganization = activeOrganization ?? memberships[0]?.organization;

  async function switchOrganization(organizationId: string) {
    if (!setActive || orgId === organizationId) return;

    await setActive({ organization: organizationId });
    router.push("/dashboard/giaphu-erp/overview");
  }

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Đang tải...</span>
              <span className="truncate text-muted-foreground text-xs">Tổ chức</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!displayOrganization) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip="Tạo tổ chức"
            onClick={() => router.push("/dashboard/workspaces")}
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Tạo tổ chức</span>
              <span className="truncate text-muted-foreground text-xs">Bắt đầu workspace</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={displayOrganization.name}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {displayOrganization.hasImage && displayOrganization.imageUrl ? (
                  <Image
                    src={displayOrganization.imageUrl}
                    alt={displayOrganization.name}
                    width={32}
                    height={32}
                    className="size-full object-cover"
                  />
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div
                className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
                  state === "collapsed"
                    ? "invisible max-w-0 overflow-hidden opacity-0"
                    : "visible max-w-full opacity-100"
                }`}
              >
                <span className="truncate font-medium">{displayOrganization.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {memberships.find((membership) => membership.organization.id === displayOrganization.id)?.role ??
                    "Tổ chức"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel>Tổ chức</DropdownMenuLabel>
            {memberships.map((membership, index) => {
              const organization = membership.organization;
              const isActive = organization.id === orgId;

              return (
                <DropdownMenuItem
                  key={membership.id}
                  className="gap-2 p-2"
                  onClick={() => switchOrganization(organization.id)}
                >
                  <div className="flex size-6 items-center justify-center overflow-hidden rounded-md border">
                    {organization.hasImage && organization.imageUrl ? (
                      <Image
                        src={organization.imageUrl}
                        alt={organization.name}
                        width={24}
                        height={24}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Building2 className="size-3.5 shrink-0" />
                    )}
                  </div>
                  <span className="truncate">{organization.name}</span>
                  {isActive ? (
                    <Check className="ml-auto size-4" />
                  ) : (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => router.push("/dashboard/workspaces")}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">Thêm tổ chức</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
