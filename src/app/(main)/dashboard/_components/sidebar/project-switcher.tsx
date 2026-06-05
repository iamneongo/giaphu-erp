"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import { BriefcaseBusiness, Check, ChevronsUpDown, PlusCircle, RefreshCw } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  type ActiveProjectChangeDetail,
  PROJECTS_REFRESH_EVENT,
  readActiveProjectCode,
  writeActiveProjectCode,
} from "@/lib/giaphu-erp/project-context";
import { getProjectRouteInfo, switchProjectInPath } from "@/lib/giaphu-erp/project-routes";
import type { ProjectRow } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

import { ProjectPinUnlockDialog } from "../../giaphu-erp/_components/project-pin-unlock";
import { DashboardLink } from "../dashboard-link";

type GiaPhuResponse = {
  status: "success" | "error";
  message?: string;
  projects?: ProjectRow[];
};

async function fetchProjects() {
  const response = await fetch("/api/giaphu-erp?view=projects", { cache: "no-store" });
  const result = (await response.json()) as GiaPhuResponse;

  if (!response.ok || result.status !== "success" || !result.projects) {
    throw new Error(result.message || "Không thể tải danh sách công trình.");
  }

  return result.projects;
}

export function ProjectSwitcher({
  initialProjects = [],
  organizationReady = true,
}: {
  initialProjects?: ProjectRow[];
  organizationReady?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeProjectId = getProjectRouteInfo(pathname)?.projectId ?? "";
  const [projects, setProjects] = React.useState<ProjectRow[]>(initialProjects);
  const [activeProjectCode, setActiveProjectCode] = React.useState("");
  const [pinProject, setPinProject] = React.useState<ProjectRow | null>(null);
  const [pendingProjectPath, setPendingProjectPath] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const activeProject = projects.find((project) => project.code === activeProjectCode) ?? projects[0];

  const loadProjects = React.useCallback(() => {
    startTransition(async () => {
      try {
        const nextProjects = await fetchProjects();
        const storedProjectCode = readActiveProjectCode();
        const nextActiveProject =
          nextProjects.find((project) => project.id === routeProjectId) ??
          nextProjects.find((project) => project.code === routeProjectId) ??
          nextProjects.find((project) => project.code === storedProjectCode) ??
          nextProjects[0];

        setProjects(nextProjects);

        if (nextActiveProject) {
          setActiveProjectCode((current) => (current === nextActiveProject.code ? current : nextActiveProject.code));
          writeActiveProjectCode(nextActiveProject.code, nextActiveProject.id);
        }
      } catch {
        setProjects([]);
      }
    });
  }, [routeProjectId]);

  React.useEffect(() => {
    const routeProject = initialProjects.find(
      (project) => project.id === routeProjectId || project.code === routeProjectId,
    );
    if (routeProject) {
      setActiveProjectCode((current) => (current === routeProject.code ? current : routeProject.code));
      writeActiveProjectCode(routeProject.code, routeProject.id);
      return;
    }

    const storedProjectCode = readActiveProjectCode();
    const nextActiveProject =
      initialProjects.find((project) => project.code === storedProjectCode) ?? initialProjects[0];

    if (nextActiveProject) {
      setActiveProjectCode((current) => (current === nextActiveProject.code ? current : nextActiveProject.code));
      writeActiveProjectCode(nextActiveProject.code, nextActiveProject.id);
    }
  }, [initialProjects, routeProjectId]);

  React.useEffect(() => {
    if (organizationReady && !initialProjects.length) {
      loadProjects();
    }
  }, [initialProjects.length, loadProjects, organizationReady]);

  React.useEffect(() => {
    function handleProjectChange(event: Event) {
      const nextCode = (event as CustomEvent<ActiveProjectChangeDetail>).detail?.code;
      if (nextCode) {
        setActiveProjectCode((current) => (current === nextCode ? current : nextCode));
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    if (organizationReady) {
      window.addEventListener(PROJECTS_REFRESH_EVENT, loadProjects);
    }

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
      window.removeEventListener(PROJECTS_REFRESH_EVENT, loadProjects);
    };
  }, [loadProjects, organizationReady]);

  const activateProject = React.useCallback(
    (project: ProjectRow, targetPath: string) => {
      setActiveProjectCode((current) => (current === project.code ? current : project.code));
      writeActiveProjectCode(project.code, project.id);
      if (targetPath !== pathname) router.push(targetPath);
    },
    [pathname, router],
  );

  if (!organizationReady) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            tooltip="Chọn tổ chức"
            asChild
          >
            <DashboardLink href="/dashboard/workspaces">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                <BriefcaseBusiness className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Chọn tổ chức</span>
                <span className="truncate text-muted-foreground text-xs">Trước khi dùng ERP</span>
              </div>
            </DashboardLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!projects.length && !pending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            tooltip="Tạo công trình"
            asChild
          >
            <DashboardLink href="/create-project">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                <PlusCircle className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Tạo công trình</span>
                <span className="truncate text-muted-foreground text-xs">Chưa có dữ liệu dự án</span>
              </div>
            </DashboardLink>
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
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip={activeProject ? activeProject.name : "Chọn công trình"}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                <BriefcaseBusiness className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeProject?.name ?? "Chọn công trình"}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {activeProject?.code ?? "Chưa có công trình"}
                </span>
              </div>
              {pending ? (
                <RefreshCw className="ml-auto size-4 animate-spin" />
              ) : (
                <ChevronsUpDown className="ml-auto size-4" />
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-64 rounded-lg" side="right" align="start" sideOffset={8}>
            <DropdownMenuLabel>Công trình đang làm việc</DropdownMenuLabel>
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.code}
                className={cn("gap-2", project.code === activeProjectCode && "bg-accent/50")}
                onSelect={(event) => {
                  event.preventDefault();
                  const targetPath = switchProjectInPath(pathname, project.id);
                  if (project.code === activeProjectCode) return;

                  if (project.hasPin) {
                    setPinProject(project);
                    setPendingProjectPath(targetPath);
                    return;
                  }

                  activateProject(project, targetPath);
                }}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background font-semibold text-xs">
                  {project.code.slice(0, 2)}
                </div>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{project.name}</span>
                  <span className="truncate text-muted-foreground text-xs">{project.code}</span>
                </div>
                <Check className={cn("size-4 opacity-0", project.code === activeProjectCode && "opacity-100")} />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <DashboardLink href="/create-project" className="gap-2">
                <PlusCircle className="size-4" />
                Thêm công trình
              </DashboardLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ProjectPinUnlockDialog
          project={pinProject}
          open={Boolean(pinProject)}
          onOpenChange={(open) => {
            if (!open) {
              setPinProject(null);
              setPendingProjectPath("");
            }
          }}
          onUnlocked={(project) => {
            const targetProject = projects.find((item) => item.id === project.id || item.code === project.code);
            if (!targetProject) return;
            activateProject(targetProject, pendingProjectPath || switchProjectInPath(pathname, targetProject.id));
            setPinProject(null);
            setPendingProjectPath("");
          }}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
