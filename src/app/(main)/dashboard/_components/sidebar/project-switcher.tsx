"use client";

import * as React from "react";

import Link from "next/link";

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
import type { GiaPhuDashboardData, ProjectRow } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

type GiaPhuResponse = {
  status: "success" | "error";
  message?: string;
  data?: GiaPhuDashboardData;
};

async function fetchProjects() {
  const response = await fetch("/api/giaphu-erp", { cache: "no-store" });
  const result = (await response.json()) as GiaPhuResponse;

  if (!response.ok || result.status !== "success" || !result.data) {
    throw new Error(result.message || "Không thể tải danh sách công trình.");
  }

  return result.data.projects;
}

export function ProjectSwitcher() {
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [activeProjectCode, setActiveProjectCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const activeProject = projects.find((project) => project.code === activeProjectCode) ?? projects[0];

  const loadProjects = React.useCallback(() => {
    startTransition(async () => {
      try {
        const nextProjects = await fetchProjects();
        const storedProjectCode = readActiveProjectCode();
        const nextActiveProject = nextProjects.find((project) => project.code === storedProjectCode) ?? nextProjects[0];

        setProjects(nextProjects);

        if (nextActiveProject) {
          setActiveProjectCode(nextActiveProject.code);
          writeActiveProjectCode(nextActiveProject.code);
        }
      } catch {
        setProjects([]);
      }
    });
  }, []);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  React.useEffect(() => {
    function handleProjectChange(event: Event) {
      const nextCode = (event as CustomEvent<ActiveProjectChangeDetail>).detail?.code;
      if (nextCode) {
        setActiveProjectCode(nextCode);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    window.addEventListener(PROJECTS_REFRESH_EVENT, loadProjects);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
      window.removeEventListener(PROJECTS_REFRESH_EVENT, loadProjects);
    };
  }, [loadProjects]);

  function selectProject(project: ProjectRow) {
    setActiveProjectCode(project.code);
    writeActiveProjectCode(project.code);
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
                onClick={() => selectProject(project)}
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
              <Link prefetch={false} href="/dashboard/giaphu-erp/crm" className="gap-2">
                <PlusCircle className="size-4" />
                Quản lý công trình
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
