import { notFound, redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import {
  ERP_PERMISSIONS,
  enforceErpRoutePermission,
  getEffectiveErpPermissions,
  getFirstAccessibleDashboardHref,
} from "@/lib/clerk/erp-rbac";
import { decodeProjectRouteSegment, projectScopedPath } from "@/lib/giaphu-erp/project-routes";

import { CatalogsWorkspace } from "../../../giaphu-erp/_components/catalogs-workspace";
import { CrmWorkspace } from "../../../giaphu-erp/_components/crm-workspace";
import { DetailPageContent } from "../../../giaphu-erp/_components/detail-page-content";
import { DocumentsWorkspace } from "../../../giaphu-erp/_components/documents-workspace";
import { ExcelImportPage } from "../../../giaphu-erp/_components/excel-import-page";
import { MaterialDebtWorkspace } from "../../../giaphu-erp/_components/material-debt-workspace";
import { MaterialEditorPage } from "../../../giaphu-erp/_components/material-editor-page";
import { OverviewDashboard } from "../../../giaphu-erp/_components/overview-dashboard";
import { ReportsWorkspace } from "../../../giaphu-erp/_components/reports-workspace";
import { SubcontractorsWorkspace } from "../../../giaphu-erp/_components/subcontractors-workspace";
import { WorkforceWorkspace } from "../../../giaphu-erp/_components/workforce-workspace";
import { ZaloMaterialBreakdownPage } from "../../../giaphu-erp/_components/zalo-material-breakdown-page";
import { getCatalogSectionBySlug } from "../../../giaphu-erp/_lib/catalog-config";

type ProjectPageParams = Promise<{
  projectId: string;
  path?: string[];
}>;

type ProjectPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

function getImportPermission(target: string) {
  if (["contracts", "payments", "projects"].includes(target)) return ERP_PERMISSIONS.crmManage;
  if (target === "catalogs") return ERP_PERMISSIONS.catalogsManage;
  if (target === "materials") return ERP_PERMISSIONS.materialsManage;
  if (["labor-norms", "progress", "staff"].includes(target)) return ERP_PERMISSIONS.workforceManage;
  if (["operations", "subcontractor-contracts", "subcontractors"].includes(target)) {
    return ERP_PERMISSIONS.subcontractorsManage;
  }

  return ERP_PERMISSIONS.overviewRead;
}

function normalizeSearchParams(searchParams: Awaited<ProjectPageSearchParams>) {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? (value[0] ?? "") : (value ?? "")]),
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: ProjectPageParams;
  searchParams: ProjectPageSearchParams;
}) {
  const [{ projectId, path = [] }, rawSearchParams] = await Promise.all([params, searchParams]);
  const decodedProjectId = decodeProjectRouteSegment(projectId);
  const routeKey = path.join("/");

  if (!routeKey) {
    const session = await auth();
    const permissionKeys = await getEffectiveErpPermissions(session);

    redirect(getFirstAccessibleDashboardHref(session, { projectRouteId: decodedProjectId, permissionKeys }));
  }

  switch (routeKey) {
    case "overview":
      await enforceErpRoutePermission(ERP_PERMISSIONS.overviewRead);
      return <OverviewDashboard />;
    case "reports":
      await enforceErpRoutePermission(ERP_PERMISSIONS.reportsRead);
      return <ReportsWorkspace routeProjectId={decodedProjectId} />;
    case "crm":
      return redirect(projectScopedPath(decodedProjectId, "/crm/projects"));
    case "crm/projects":
      await enforceErpRoutePermission(ERP_PERMISSIONS.crmRead);
      return <CrmWorkspace section="projects" />;
    case "crm/contracts":
      await enforceErpRoutePermission(ERP_PERMISSIONS.crmRead);
      return <CrmWorkspace section="contracts" />;
    case "crm/payments":
      await enforceErpRoutePermission(ERP_PERMISSIONS.crmRead);
      return <CrmWorkspace section="payments" />;
    case "materials":
      return redirect(projectScopedPath(decodedProjectId, "/materials/vat-tu-chinh"));
    case "materials/vat-tu-chinh":
      await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
      return (
        <ZaloMaterialBreakdownPage
          allowedMaterialTypes={["VT Chính"]}
          initialMaterialType="VT Chính"
          title="Vật tư chính"
          description="Nhập vật tư chính từ tin nhắn Zalo hoặc thêm thủ công."
        />
      );
    case "materials/vat-tu-chinh/new":
      await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
      return (
        <MaterialEditorPage
          listHref={projectScopedPath(decodedProjectId, "/materials/vat-tu-chinh")}
          materialType="VT Chính"
          mode="create"
        />
      );
    case "materials/vat-tu-phu":
    case "materials/vat-tu-mep-hvac":
      await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
      return (
        <ZaloMaterialBreakdownPage
          allowedMaterialTypes={["VT Phụ", "VT MEP-HVAC"]}
          initialMaterialType="VT Phụ"
          title="Vật tư phụ"
          description="Nhập vật tư phụ từ tin nhắn Zalo hoặc thêm thủ công."
        />
      );
    case "materials/vat-tu-phu/new":
    case "materials/vat-tu-mep-hvac/new":
      await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
      return (
        <MaterialEditorPage
          listHref={projectScopedPath(decodedProjectId, "/materials/vat-tu-phu")}
          materialType="VT Phụ"
          mode="create"
        />
      );
    case "materials/debt":
      await enforceErpRoutePermission(ERP_PERMISSIONS.materialsRead);
      return <MaterialDebtWorkspace />;
    case "workforce":
      return redirect(projectScopedPath(decodedProjectId, "/workforce/attendance"));
    case "workforce/attendance":
      await enforceErpRoutePermission(ERP_PERMISSIONS.workforceRead);
      return <WorkforceWorkspace section="attendance" />;
    case "workforce/staff":
      await enforceErpRoutePermission(ERP_PERMISSIONS.workforceRead);
      return <WorkforceWorkspace section="staff" />;
    case "workforce/labor-norms":
    case "workforce/norms":
    case "workforce/dinh-muc":
      await enforceErpRoutePermission(ERP_PERMISSIONS.workforceRead);
      return <WorkforceWorkspace section="laborNorms" />;
    case "workforce/progress":
      await enforceErpRoutePermission(ERP_PERMISSIONS.workforceRead);
      return <WorkforceWorkspace section="progress" />;
    case "subcontractors":
      return redirect(projectScopedPath(decodedProjectId, "/subcontractors/advances"));
    case "subcontractors/advances":
      await enforceErpRoutePermission(ERP_PERMISSIONS.subcontractorsRead);
      return <SubcontractorsWorkspace section="advances" />;
    case "subcontractors/contracts":
      await enforceErpRoutePermission(ERP_PERMISSIONS.subcontractorsRead);
      return <SubcontractorsWorkspace section="contracts" />;
    case "subcontractors/operations":
      return redirect(projectScopedPath(decodedProjectId, "/operations"));
    case "operations":
      await enforceErpRoutePermission(ERP_PERMISSIONS.subcontractorsRead);
      return <SubcontractorsWorkspace section="operations" />;
    case "documents":
      await enforceErpRoutePermission(ERP_PERMISSIONS.documentsRead);
      return <DocumentsWorkspace />;
    case "catalogs":
      return redirect(projectScopedPath(decodedProjectId, "/catalogs/hang-muc"));
    default:
      break;
  }

  if (path[0] === "catalogs" && path[1] && !path[2]) {
    await enforceErpRoutePermission(ERP_PERMISSIONS.catalogsRead);
    const section = getCatalogSectionBySlug(path[1]);
    if (!section) notFound();
    return <CatalogsWorkspace kind={section.kind} />;
  }

  if (path[0] === "materials" && path[2] === "edit" && path[3] && !path[4]) {
    await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);

    if (path[1] === "vat-tu-chinh") {
      return (
        <MaterialEditorPage
          listHref={projectScopedPath(decodedProjectId, "/materials/vat-tu-chinh")}
          materialId={path[3]}
          materialType="VT Chính"
          mode="edit"
        />
      );
    }

    if (path[1] === "vat-tu-phu" || path[1] === "vat-tu-mep-hvac") {
      return (
        <MaterialEditorPage
          listHref={projectScopedPath(decodedProjectId, "/materials/vat-tu-phu")}
          materialId={path[3]}
          materialType="VT Phụ"
          mode="edit"
        />
      );
    }
  }

  if (path[0] === "catalogs" && path[1] && path[2] === "zalo") {
    await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
    const section = getCatalogSectionBySlug(path[1]);
    if (!section || (section.kind !== "vatTu" && section.kind !== "vatTuPhu")) notFound();
    redirect(
      projectScopedPath(
        decodedProjectId,
        section.kind === "vatTu" ? "/materials/vat-tu-chinh" : "/materials/vat-tu-phu",
      ),
    );
  }

  if (path[0] === "import" && path[1] && !path[2]) {
    await enforceErpRoutePermission(getImportPermission(path[1]));
    return (
      <ExcelImportPage
        target={path[1]}
        query={normalizeSearchParams(rawSearchParams)}
        routeProjectId={decodedProjectId}
      />
    );
  }

  if (path[0] === "details" && path[1] && path[2] && !path[3]) {
    return <DetailPageContent type={path[1]} id={path[2]} routeProjectId={decodedProjectId} />;
  }

  notFound();
}
