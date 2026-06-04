"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  type ActiveProjectChangeDetail,
  PROJECTS_REFRESH_EVENT,
  readActiveProjectCode,
} from "@/lib/giaphu-erp/project-context";
import { decodeProjectRouteSegment, projectScopedPath } from "@/lib/giaphu-erp/project-routes";
import type { ProjectRow } from "@/lib/giaphu-erp/types";

const segmentLabels: Record<string, string> = {
  dashboard: "Bảng điều khiển",
  "giaphu-erp": "Công trình",
  overview: "Tổng quan",
  crm: "CRM công trình",
  materials: "Vật tư",
  workforce: "Nhân công",
  subcontractors: "Thầu phụ",
  catalogs: "Danh mục",
  documents: "Hồ sơ",
  reports: "Báo cáo",
  profile: "Hồ sơ tài khoản",
  workspaces: "Tổ chức",
  team: "Thành viên",
  roles: "Vai trò & quyền",
  create: "Tạo vai trò",
  edit: "Sửa vai trò",
  billing: "Thanh toán tổ chức",
  projects: "Công trình",
  details: "Chi tiết",
  contracts: "Hợp đồng",
  payments: "Thu tiền",
  norms: "Định mức",
  attendance: "Chấm công",
  staff: "Nhân sự",
  "labor-norms": "Định mức nhân công",
  progress: "Tiến độ",
  advances: "Tạm ứng",
  operations: "Vận hành",
  "hang-muc": "Hạng mục",
  "vat-tu": "Vật tư",
  "vat-tu-phu": "Vật tư phụ",
  "vat-tu-chinh": "Vật tư chính",
  "vat-tu-mep-hvac": "Vật tư phụ",
  debt: "Công nợ vật tư",
  zalo: "Phân rã Zalo",
  "nha-cung-cap": "Nhà cung cấp",
  "thau-phu": "Thầu phụ",
};

type GiaPhuProjectsResponse = {
  status: "success" | "error";
  message?: string;
  projects?: ProjectRow[];
};

async function fetchProjects() {
  const response = await fetch("/api/giaphu-erp?view=projects", { cache: "no-store" });
  const result = (await response.json()) as GiaPhuProjectsResponse;

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Không thể tải danh sách công trình.");
  }

  return result.projects ?? [];
}

export function DashboardBreadcrumbs({ initialProjects = [] }: { initialProjects?: ProjectRow[] }) {
  const pathname = usePathname();
  const [activeProjectCode, setActiveProjectCode] = React.useState("");
  const [projects, setProjects] = React.useState<ProjectRow[]>(initialProjects);
  const segments = pathname.split("/").filter(Boolean);
  const visibleSegments = segments
    .map((segment, index) => ({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      segment,
    }))
    .filter((item) => item.segment !== "dashboard");

  React.useEffect(() => {
    if (initialProjects.length) {
      setProjects(initialProjects);
    }
  }, [initialProjects]);

  React.useEffect(() => {
    setActiveProjectCode(readActiveProjectCode());

    function handleProjectChange(event: Event) {
      const nextCode = (event as CustomEvent<ActiveProjectChangeDetail>).detail?.code;
      if (nextCode) {
        setActiveProjectCode(nextCode);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const nextProjects = await fetchProjects();
        if (!cancelled) setProjects(nextProjects);
      } catch {
        if (!cancelled) setProjects([]);
      }
    }

    if (!initialProjects.length) {
      void loadProjects();
    }
    window.addEventListener(PROJECTS_REFRESH_EVENT, loadProjects);

    return () => {
      cancelled = true;
      window.removeEventListener(PROJECTS_REFRESH_EVENT, loadProjects);
    };
  }, [initialProjects.length]);

  function getSegmentLabel(segment: string, index: number) {
    if (segment.startsWith("role_")) return "Chi tiết vai trò";

    const previousSegment = visibleSegments[index - 1]?.segment;
    if (segment === "create" && previousSegment === "roles") {
      return "Tạo vai trò";
    }

    if (previousSegment === "projects") {
      const decodedProjectCode = decodeProjectRouteSegment(segment);
      return projects.find((project) => project.code === decodedProjectCode)?.name ?? decodedProjectCode;
    }

    return segmentLabels[segment] ?? segment;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={activeProjectCode ? projectScopedPath(activeProjectCode, "/overview") : "/dashboard"}>
            Bảng điều khiển
          </BreadcrumbLink>
        </BreadcrumbItem>
        {visibleSegments.map(({ href, segment }, index) => {
          const isLast = index === visibleSegments.length - 1;
          const label = getSegmentLabel(segment, index);

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
