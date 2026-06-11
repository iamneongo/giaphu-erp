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
import { PROJECTS_REFRESH_EVENT } from "@/lib/giaphu-erp/project-context";
import { decodeProjectRouteSegment, getProjectRouteInfo, projectScopedPath } from "@/lib/giaphu-erp/project-routes";
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
  payroll: "Bảng lương",
  payslips: "Phiếu lương",
  staff: "Nhân sự",
  "labor-norms": "Định mức nhân công",
  progress: "Tiến độ",
  advances: "Tạm ứng",
  operations: "Vận hành",
  "subcontractor-contracts": "Hợp đồng thầu phụ",
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

type BreadcrumbEntry = {
  href: string;
  label: string;
};

type DetailBreadcrumbMeta = {
  moduleLabel: string;
  listHref: string;
  typeLabel: string;
};

const detailBreadcrumbMeta: Record<string, DetailBreadcrumbMeta> = {
  projects: {
    moduleLabel: "CRM công trình",
    listHref: "/crm/projects",
    typeLabel: "Công trình",
  },
  contracts: {
    moduleLabel: "CRM công trình",
    listHref: "/crm/contracts",
    typeLabel: "Hợp đồng",
  },
  payments: {
    moduleLabel: "CRM công trình",
    listHref: "/crm/payments",
    typeLabel: "Thu tiền",
  },
  materials: {
    moduleLabel: "Vật tư",
    listHref: "/materials/vat-tu-chinh",
    typeLabel: "Vật tư",
  },
  staff: {
    moduleLabel: "Danh mục",
    listHref: "/workforce/staff",
    typeLabel: "Nhân sự",
  },
  attendance: {
    moduleLabel: "Nhân công",
    listHref: "/workforce/attendance",
    typeLabel: "Chấm công",
  },
  payroll: {
    moduleLabel: "Nhân công",
    listHref: "/workforce/payroll",
    typeLabel: "Bảng lương",
  },
  payslips: {
    moduleLabel: "Nhân công",
    listHref: "/workforce/payslips",
    typeLabel: "Phiếu lương",
  },
  "labor-norms": {
    moduleLabel: "Danh mục",
    listHref: "/workforce/labor-norms",
    typeLabel: "Định mức nhân công",
  },
  progress: {
    moduleLabel: "Danh mục",
    listHref: "/workforce/progress",
    typeLabel: "Tiến độ",
  },
  subcontractors: {
    moduleLabel: "Thầu phụ",
    listHref: "/subcontractors/advances",
    typeLabel: "Tạm ứng",
  },
  "subcontractor-contracts": {
    moduleLabel: "Thầu phụ",
    listHref: "/subcontractors/contracts",
    typeLabel: "Hợp đồng thầu phụ",
  },
  operations: {
    moduleLabel: "Vận hành",
    listHref: "/operations",
    typeLabel: "Vận hành",
  },
  documents: {
    moduleLabel: "Hồ sơ",
    listHref: "/documents",
    typeLabel: "Hồ sơ",
  },
  catalogs: {
    moduleLabel: "Danh mục",
    listHref: "/catalogs/hang-muc",
    typeLabel: "Danh mục",
  },
};

function findProject(projects: ProjectRow[], projectId: string) {
  const decodedProjectId = decodeProjectRouteSegment(projectId);
  return projects.find(
    (project) =>
      project.id === decodedProjectId || project.code === decodedProjectId || project.name === decodedProjectId,
  );
}

function projectRouteIdFor(projects: ProjectRow[], projectId: string) {
  return findProject(projects, projectId)?.id ?? decodeProjectRouteSegment(projectId);
}

function projectLabelFor(projects: ProjectRow[], projectId: string) {
  const decodedProjectId = decodeProjectRouteSegment(projectId);
  return findProject(projects, projectId)?.name ?? decodedProjectId;
}

function labelFor(segment: string) {
  if (segment.startsWith("role_")) return "Chi tiết vai trò";
  return segmentLabels[segment] ?? decodeProjectRouteSegment(segment);
}

function addModuleBreadcrumb(
  items: BreadcrumbEntry[],
  routeId: string,
  label: string,
  childHref: string,
  finalLabel?: string,
) {
  items.push({ label, href: projectScopedPath(routeId, childHref) });
  if (finalLabel && finalLabel !== label) {
    items.push({ label: finalLabel, href: projectScopedPath(routeId, childHref) });
  }
}

function buildProjectBreadcrumbs(pathname: string, projects: ProjectRow[]) {
  const projectRoute = getProjectRouteInfo(pathname);
  if (!projectRoute) return null;

  const routeId = projectRouteIdFor(projects, projectRoute.projectId);
  const childSegments = projectRoute.legacyPathname
    .replace(/^\/dashboard\/giaphu-erp\/?/, "")
    .split("/")
    .filter(Boolean);
  const [firstSegment, secondSegment, thirdSegment] = childSegments;
  const items: BreadcrumbEntry[] = [
    { label: "Công trình", href: projectScopedPath(routeId, "/crm/projects") },
    { label: projectLabelFor(projects, projectRoute.projectId), href: projectScopedPath(routeId, "") },
  ];

  if (!firstSegment || firstSegment === "overview") {
    items.push({ label: "Tổng quan", href: projectScopedPath(routeId, "/overview") });
    return items;
  }

  if (firstSegment === "details" && secondSegment && thirdSegment) {
    const detailMeta = detailBreadcrumbMeta[secondSegment];
    const decodedRecordId = decodeProjectRouteSegment(thirdSegment);

    if (detailMeta) {
      items.push({
        label: detailMeta.moduleLabel,
        href: projectScopedPath(routeId, detailMeta.listHref),
      });
      items.push({
        label: detailMeta.typeLabel,
        href: projectScopedPath(routeId, detailMeta.listHref),
      });
      items.push({
        label: decodedRecordId,
        href: projectScopedPath(routeId, `/details/${secondSegment}/${thirdSegment}`),
      });
      return items;
    }
  }

  if (firstSegment === "crm") {
    items.push({ label: "CRM công trình", href: projectScopedPath(routeId, "/crm/projects") });

    if (secondSegment && secondSegment !== "projects") {
      items.push({ label: labelFor(secondSegment), href: projectScopedPath(routeId, `/crm/${secondSegment}`) });
    }

    return items;
  }

  if (firstSegment === "materials") {
    addModuleBreadcrumb(items, routeId, "Vật tư", "/materials/vat-tu-chinh", labelFor(secondSegment || "vat-tu-chinh"));
    return items;
  }

  if (firstSegment === "workforce") {
    if (secondSegment && ["staff", "labor-norms", "progress"].includes(secondSegment)) {
      addModuleBreadcrumb(items, routeId, "Danh mục", `/workforce/${secondSegment}`, labelFor(secondSegment));
      return items;
    }

    addModuleBreadcrumb(items, routeId, "Nhân công", "/workforce/attendance", labelFor(secondSegment || "attendance"));
    return items;
  }

  if (firstSegment === "subcontractors") {
    addModuleBreadcrumb(items, routeId, "Thầu phụ", "/subcontractors/advances", labelFor(secondSegment || "advances"));
    return items;
  }

  if (firstSegment === "operations") {
    addModuleBreadcrumb(items, routeId, "Vận hành", "/operations");
    return items;
  }

  if (firstSegment === "catalogs") {
    addModuleBreadcrumb(items, routeId, "Danh mục", "/catalogs/hang-muc", labelFor(secondSegment || "hang-muc"));
    return items;
  }

  items.push({
    label: labelFor(firstSegment),
    href: projectScopedPath(routeId, `/${childSegments.join("/")}`),
  });

  return items;
}

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
  const [projects, setProjects] = React.useState<ProjectRow[]>(initialProjects);
  const segments = pathname.split("/").filter(Boolean);
  const projectBreadcrumbs = buildProjectBreadcrumbs(pathname, projects);
  const fallbackBreadcrumbs: BreadcrumbEntry[] = segments
    .map((segment, index) => {
      const previousSegment = segments[index - 1];
      const decodedProjectId = decodeProjectRouteSegment(segment);
      const label =
        segment === "create" && previousSegment === "roles"
          ? "Tạo vai trò"
          : previousSegment === "projects"
            ? (projects.find((project) => project.id === decodedProjectId || project.code === decodedProjectId)?.name ??
              decodedProjectId)
            : labelFor(segment);

      return {
        href: `/${segments.slice(0, index + 1).join("/")}`,
        label,
      };
    })
    .filter((item) => item.label !== "Bảng điều khiển");
  const visibleSegments = projectBreadcrumbs ?? fallbackBreadcrumbs;

  React.useEffect(() => {
    if (initialProjects.length) {
      setProjects(initialProjects);
    }
  }, [initialProjects]);

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

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">Bảng điều khiển</BreadcrumbLink>
        </BreadcrumbItem>
        {visibleSegments.map((item, index) => {
          const isLast = index === visibleSegments.length - 1;

          return (
            <React.Fragment key={`${item.href}-${item.label}`}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
