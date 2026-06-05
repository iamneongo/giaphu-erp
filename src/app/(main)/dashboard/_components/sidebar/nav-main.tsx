"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import { useAuth } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ErpPermissionKey } from "@/lib/clerk/erp-rbac-shared";
import { canAccessClerkPermission } from "@/lib/clerk/erp-rbac-shared";
import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  type ActiveProjectChangeDetail,
  readActiveProjectCode,
  readActiveProjectRouteId,
} from "@/lib/giaphu-erp/project-context";
import { erpPathForProject } from "@/lib/giaphu-erp/project-routes";
import type { ProjectRow } from "@/lib/giaphu-erp/types";
import type { NavGroup, NavMainItem } from "@/navigation/sidebar/sidebar-items";

import { DashboardLink } from "../dashboard-link";

interface NavMainProps {
  readonly items: readonly NavGroup[];
  readonly effectivePermissions?: readonly ErpPermissionKey[];
  readonly initialProjects?: readonly ProjectRow[];
}

const IsComingSoon = () => (
  <span className="ml-auto rounded-md bg-gray-200 px-2 py-1 text-xs dark:text-gray-800">Sắp có</span>
);

const NavItemExpanded = ({
  item,
  isActive,
  isSubmenuOpen,
}: {
  item: NavMainItem;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
  isSubmenuOpen: (subItems?: NavMainItem["subItems"]) => boolean;
}) => {
  return (
    <Collapsible key={item.title} asChild defaultOpen={isSubmenuOpen(item.subItems)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          {item.subItems ? (
            <SidebarMenuButton
              disabled={item.comingSoon}
              isActive={isActive(item.url, item.subItems)}
              tooltip={item.title}
            >
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.comingSoon && <IsComingSoon />}
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton
              asChild
              aria-disabled={item.comingSoon}
              isActive={isActive(item.url)}
              tooltip={item.title}
            >
              <DashboardLink
                href={item.url}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noreferrer" : undefined}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                {item.comingSoon && <IsComingSoon />}
              </DashboardLink>
            </SidebarMenuButton>
          )}
        </CollapsibleTrigger>
        {item.subItems && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton aria-disabled={subItem.comingSoon} isActive={isActive(subItem.url)} asChild>
                    <DashboardLink
                      href={subItem.url}
                      target={subItem.newTab ? "_blank" : undefined}
                      rel={subItem.newTab ? "noreferrer" : undefined}
                    >
                      {subItem.icon && <subItem.icon />}
                      <span>{subItem.title}</span>
                      {subItem.comingSoon && <IsComingSoon />}
                    </DashboardLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
};

const NavItemCollapsed = ({
  item,
  isActive,
}: {
  item: NavMainItem;
  isActive: (url: string, subItems?: NavMainItem["subItems"]) => boolean;
}) => {
  return (
    <SidebarMenuItem key={item.title}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            disabled={item.comingSoon}
            tooltip={item.title}
            isActive={isActive(item.url, item.subItems)}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-50 space-y-1" side="right" align="start">
          {item.subItems?.map((subItem) => (
            <DropdownMenuItem key={subItem.title} asChild>
              <SidebarMenuSubButton
                key={subItem.title}
                asChild
                className="focus-visible:ring-0"
                aria-disabled={subItem.comingSoon}
                isActive={isActive(subItem.url)}
              >
                <DashboardLink
                  href={subItem.url}
                  target={subItem.newTab ? "_blank" : undefined}
                  rel={subItem.newTab ? "noreferrer" : undefined}
                >
                  {subItem.icon && <subItem.icon className="[&>svg]:text-sidebar-foreground" />}
                  <span>{subItem.title}</span>
                  {subItem.comingSoon && <IsComingSoon />}
                </DashboardLink>
              </SidebarMenuSubButton>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export function NavMain({ items, effectivePermissions = [], initialProjects = [] }: NavMainProps) {
  const path = usePathname();
  const { state, isMobile } = useSidebar();
  const { has, orgRole } = useAuth();
  const [activeProjectRouteId, setActiveProjectRouteId] = React.useState("");
  const effectivePermissionSet = React.useMemo(() => new Set(effectivePermissions), [effectivePermissions]);

  React.useEffect(() => {
    const storedCode = readActiveProjectCode();
    const storedRouteId = readActiveProjectRouteId();
    const project = initialProjects.find((item) => item.code === storedCode);
    setActiveProjectRouteId(storedRouteId || project?.id || storedCode);

    function handleProjectChange(event: Event) {
      const detail = (event as CustomEvent<ActiveProjectChangeDetail>).detail;
      const nextCode = detail?.code;
      if (nextCode) {
        setActiveProjectRouteId(detail.routeId || nextCode);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    };
  }, [initialProjects]);

  const visibleGroups = items
    .map((group) => {
      const visibleItems = group.items
        .map((item) => {
          const visibleSubItems = item.subItems?.filter(
            (subItem) =>
              !subItem.permission ||
              canAccessClerkPermission(
                {
                  orgRole,
                  hasRole: (role) => has?.({ role }) ?? false,
                  hasPermission: (permission) => has?.({ permission }) ?? false,
                  permissionKeys: effectivePermissionSet,
                },
                subItem.permission,
              ),
          );

          if (item.subItems?.length) {
            if (!visibleSubItems?.length) {
              return null;
            }

            return { ...item, subItems: visibleSubItems };
          }

          if (
            item.permission &&
            !canAccessClerkPermission(
              {
                orgRole,
                hasRole: (role) => has?.({ role }) ?? false,
                hasPermission: (permission) => has?.({ permission }) ?? false,
                permissionKeys: effectivePermissionSet,
              },
              item.permission,
            )
          ) {
            return null;
          }

          return item;
        })
        .filter(Boolean) as NavMainItem[];

      return { ...group, items: visibleItems };
    })
    .filter((group) => group.items.length > 0);

  const hrefForProject = React.useCallback(
    (url: string) => (activeProjectRouteId ? erpPathForProject(activeProjectRouteId, url) : url),
    [activeProjectRouteId],
  );

  const projectScopedGroups = visibleGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      url: hrefForProject(item.url),
      subItems: item.subItems?.map((subItem) => ({ ...subItem, url: hrefForProject(subItem.url) })),
    })),
  }));

  const isItemActive = (url: string, subItems?: NavMainItem["subItems"]) => {
    if (subItems?.length) {
      return subItems.some((sub) => path.startsWith(sub.url));
    }
    return path === url;
  };

  const isSubmenuOpen = (subItems?: NavMainItem["subItems"]) => {
    return subItems?.some((sub) => path.startsWith(sub.url)) ?? false;
  };

  return (
    <>
      {projectScopedGroups.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {group.items.map((item) => {
                if (state === "collapsed" && !isMobile) {
                  // If no subItems, just render the button as a link
                  if (!item.subItems) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          aria-disabled={item.comingSoon}
                          tooltip={item.title}
                          isActive={isItemActive(item.url)}
                        >
                          <DashboardLink
                            href={item.url}
                            target={item.newTab ? "_blank" : undefined}
                            rel={item.newTab ? "noreferrer" : undefined}
                          >
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </DashboardLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  // Otherwise, render the dropdown as before
                  return <NavItemCollapsed key={item.title} item={item} isActive={isItemActive} />;
                }
                // Expanded view
                return (
                  <NavItemExpanded key={item.title} item={item} isActive={isItemActive} isSubmenuOpen={isSubmenuOpen} />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
