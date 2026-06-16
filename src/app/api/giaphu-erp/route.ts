import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import {
  canAccessAnyErpPermission,
  canAccessErpPermission,
  ERP_DATA_ACCESS_PERMISSIONS,
  ERP_PERMISSIONS,
  filterGiaPhuDashboardDataByPermissions,
  getEffectiveErpPermissions,
} from "@/lib/clerk/erp-rbac";
import {
  approveSubcontractorContract,
  closeAttendance,
  createGiaPhuSchema,
  deleteAttendanceRow,
  deleteCatalog,
  deleteContract,
  deleteDocument,
  deleteLaborNorm,
  deleteMaterial,
  deleteOperation,
  deletePayment,
  deleteProgress,
  deleteProject,
  deleteStaff,
  deleteSubcontractor,
  deleteSubcontractorContract,
  destroyCatalog,
  getGiaPhuActivityLogs,
  getGiaPhuDashboardData,
  getGiaPhuFilterOptions,
  getGiaPhuMaterialDebtSummary,
  getGiaPhuOverviewInsights,
  getGiaPhuPagedRows,
  getGiaPhuProjectList,
  getGiaPhuReportsInsights,
  manageCatalog,
  manageStaff,
  markMaterialPaid,
  queryDocuments,
  recordGiaPhuActivity,
  reopenAttendance,
  restoreCatalog,
  saveContract,
  saveDocument,
  saveLaborNorm,
  saveMaterial,
  saveOperation,
  savePayment,
  savePayrollAdjustment,
  saveProgress,
  saveProject,
  saveStaffProfile,
  saveStaffSkillEvaluation,
  saveStaffWeeklyAttendance,
  saveSubcontractor,
  saveSubcontractorContract,
  saveWeeklyAttendance,
  saveZaloMaterialBreakdown,
  updateMaterialPrice,
  verifyProjectPin,
} from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import {
  encodeUnlockedProjectIds,
  PROJECT_PIN_UNLOCK_COOKIE_NAME,
  PROJECT_PIN_UNLOCK_MAX_AGE,
  parseUnlockedProjectIds,
} from "@/lib/giaphu-erp/project-pin";
import { decodeProjectRouteSegment } from "@/lib/giaphu-erp/project-routes";
import type { GiaPhuPagedDataset } from "@/lib/giaphu-erp/types";

export const runtime = "nodejs";

const pagedDatasets = [
  "projects",
  "catalogs",
  "staff",
  "contracts",
  "payments",
  "documents",
  "materials",
  "attendance",
  "laborNorms",
  "progress",
  "subcontractors",
  "subcontractorContracts",
  "operations",
] satisfies GiaPhuPagedDataset[];

type AllowedPagedDataset = (typeof pagedDatasets)[number];

function isPagedDataset(value: string | null): value is AllowedPagedDataset {
  return pagedDatasets.includes(value as AllowedPagedDataset);
}

type ActionBody = {
  action?: string;
  payload?: Record<string, unknown>;
};

type BulkImportItem = {
  action?: string;
  payload?: Record<string, unknown>;
};

type ClerkAuthSession = Awaited<ReturnType<typeof auth>>;

const datasetReadPermissions = {
  projects: ERP_PERMISSIONS.crmRead,
  catalogs: ERP_PERMISSIONS.catalogsRead,
  staff: ERP_PERMISSIONS.workforceRead,
  contracts: ERP_PERMISSIONS.crmRead,
  payments: ERP_PERMISSIONS.crmRead,
  documents: ERP_PERMISSIONS.documentsRead,
  materials: ERP_PERMISSIONS.materialsRead,
  attendance: ERP_PERMISSIONS.workforceRead,
  laborNorms: ERP_PERMISSIONS.workforceRead,
  progress: ERP_PERMISSIONS.workforceRead,
  subcontractors: ERP_PERMISSIONS.subcontractorsRead,
  subcontractorContracts: ERP_PERMISSIONS.subcontractorsRead,
  operations: ERP_PERMISSIONS.subcontractorsRead,
} as const satisfies Record<AllowedPagedDataset, (typeof ERP_PERMISSIONS)[keyof typeof ERP_PERMISSIONS]>;

const mutationPermissions = {
  saveProject: ERP_PERMISSIONS.crmManage,
  deleteProject: ERP_PERMISSIONS.crmManage,
  saveContract: ERP_PERMISSIONS.crmManage,
  deleteContract: ERP_PERMISSIONS.crmManage,
  savePayment: ERP_PERMISSIONS.crmManage,
  deletePayment: ERP_PERMISSIONS.crmManage,
  manageCatalog: ERP_PERMISSIONS.catalogsManage,
  deleteCatalog: ERP_PERMISSIONS.catalogsManage,
  destroyCatalog: ERP_PERMISSIONS.catalogsManage,
  restoreCatalog: ERP_PERMISSIONS.catalogsManage,
  manageStaff: ERP_PERMISSIONS.workforceManage,
  saveStaffProfile: ERP_PERMISSIONS.workforceManage,
  saveStaffSkillEvaluation: ERP_PERMISSIONS.workforceManage,
  deleteStaff: ERP_PERMISSIONS.workforceManage,
  saveMaterial: ERP_PERMISSIONS.materialsManage,
  saveZaloMaterialBreakdown: ERP_PERMISSIONS.materialsManage,
  deleteMaterial: ERP_PERMISSIONS.materialsManage,
  updateMaterialPrice: ERP_PERMISSIONS.materialsManage,
  markMaterialPaid: ERP_PERMISSIONS.materialsManage,
  saveWeeklyAttendance: ERP_PERMISSIONS.workforceManage,
  saveStaffWeeklyAttendance: ERP_PERMISSIONS.workforceManage,
  savePayrollAdjustment: ERP_PERMISSIONS.workforceManage,
  deleteAttendanceRow: ERP_PERMISSIONS.workforceManage,
  closeAttendance: ERP_PERMISSIONS.workforceManage,
  reopenAttendance: ERP_PERMISSIONS.workforceManage,
  saveSubcontractor: ERP_PERMISSIONS.subcontractorsManage,
  deleteSubcontractor: ERP_PERMISSIONS.subcontractorsManage,
  saveSubcontractorContract: ERP_PERMISSIONS.subcontractorsManage,
  deleteSubcontractorContract: ERP_PERMISSIONS.subcontractorsManage,
  approveSubcontractorContract: ERP_PERMISSIONS.subcontractorsManage,
  saveOperation: ERP_PERMISSIONS.subcontractorsManage,
  deleteOperation: ERP_PERMISSIONS.subcontractorsManage,
  saveLaborNorm: ERP_PERMISSIONS.workforceManage,
  deleteLaborNorm: ERP_PERMISSIONS.workforceManage,
  saveProgress: ERP_PERMISSIONS.workforceManage,
  deleteProgress: ERP_PERMISSIONS.workforceManage,
  saveDocument: ERP_PERMISSIONS.documentsManage,
  deleteDocument: ERP_PERMISSIONS.documentsManage,
  queryDocuments: ERP_PERMISSIONS.documentsRead,
} as const;

function sanitizeActionPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !key.startsWith("__")));
}

function forbidden(message = "Bạn không có quyền dùng chức năng này.") {
  return NextResponse.json({ status: "error", message }, { status: 403 });
}

function canUsePermission(
  session: ClerkAuthSession,
  permissionKeys: Awaited<ReturnType<typeof getEffectiveErpPermissions>>,
  permission: (typeof ERP_PERMISSIONS)[keyof typeof ERP_PERMISSIONS],
) {
  return canAccessErpPermission(session, permission, permissionKeys);
}

function canUseAdminRole(session: ClerkAuthSession) {
  return session.has({ role: "org:admin" });
}

function canUseAnyErpData(
  session: ClerkAuthSession,
  permissionKeys: Awaited<ReturnType<typeof getEffectiveErpPermissions>>,
) {
  return canAccessAnyErpPermission(session, ERP_DATA_ACCESS_PERMISSIONS, permissionKeys);
}

function readActiveProjectCode(request: Request, payload?: Record<string, unknown>) {
  const projectCode =
    typeof payload?.projectCode === "string"
      ? payload.projectCode
      : typeof payload?.code === "string"
        ? payload.code
        : undefined;
  if (projectCode) return decodeProjectRouteSegment(projectCode);

  const cookieValue = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTIVE_PROJECT_COOKIE_NAME}=`))
    ?.split("=")[1];

  return cookieValue ? decodeProjectRouteSegment(cookieValue) : undefined;
}

function requestIpAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || ""
  );
}

function activityModuleForAction(action: string | undefined) {
  switch (action) {
    case "saveProject":
    case "deleteProject":
    case "saveContract":
    case "deleteContract":
    case "savePayment":
    case "deletePayment":
      return "CRM công trình";
    case "manageCatalog":
    case "deleteCatalog":
    case "destroyCatalog":
    case "restoreCatalog":
      return "Danh mục";
    case "manageStaff":
    case "saveStaffProfile":
    case "saveStaffSkillEvaluation":
    case "deleteStaff":
    case "saveWeeklyAttendance":
    case "saveStaffWeeklyAttendance":
    case "savePayrollAdjustment":
    case "deleteAttendanceRow":
    case "closeAttendance":
    case "reopenAttendance":
    case "saveLaborNorm":
    case "deleteLaborNorm":
    case "saveProgress":
    case "deleteProgress":
      return "Nhân công";
    case "saveMaterial":
    case "saveZaloMaterialBreakdown":
    case "deleteMaterial":
    case "updateMaterialPrice":
    case "markMaterialPaid":
      return "Vật tư";
    case "saveSubcontractor":
    case "deleteSubcontractor":
    case "saveSubcontractorContract":
    case "deleteSubcontractorContract":
    case "approveSubcontractorContract":
    case "saveOperation":
    case "deleteOperation":
      return "Thầu phụ";
    case "saveDocument":
    case "deleteDocument":
      return "Hồ sơ";
    case "bulkImport":
      return "Import Excel";
    case "verifyProjectPin":
      return "Công trình";
    default:
      return "ERP";
  }
}

function activityLabelForAction(action: string | undefined) {
  switch (action) {
    case "saveProject":
      return "Lưu công trình";
    case "deleteProject":
      return "Xóa công trình";
    case "saveContract":
      return "Lưu hợp đồng";
    case "deleteContract":
      return "Xóa hợp đồng";
    case "savePayment":
      return "Lưu thu tiền";
    case "deletePayment":
      return "Xóa thu tiền";
    case "manageCatalog":
      return "Lưu danh mục";
    case "deleteCatalog":
      return "Lưu trữ danh mục";
    case "destroyCatalog":
      return "Xóa danh mục";
    case "restoreCatalog":
      return "Khôi phục danh mục";
    case "manageStaff":
      return "Lưu nhân sự";
    case "saveStaffProfile":
      return "Lưu hồ sơ công nhân";
    case "saveStaffSkillEvaluation":
      return "Lưu đánh giá tay nghề";
    case "deleteStaff":
      return "Lưu trữ nhân sự";
    case "saveMaterial":
      return "Lưu vật tư";
    case "saveZaloMaterialBreakdown":
      return "Phân rã vật tư";
    case "deleteMaterial":
      return "Xóa vật tư";
    case "updateMaterialPrice":
      return "Cập nhật giá vật tư";
    case "markMaterialPaid":
      return "Đánh dấu thanh toán vật tư";
    case "saveWeeklyAttendance":
    case "saveStaffWeeklyAttendance":
      return "Lưu chấm công";
    case "savePayrollAdjustment":
      return "Lưu điều chỉnh lương";
    case "deleteAttendanceRow":
      return "Xóa dòng chấm công";
    case "closeAttendance":
      return "Kết sổ chấm công";
    case "reopenAttendance":
      return "Mở khóa chấm công";
    case "saveSubcontractor":
      return "Lưu tạm ứng thầu phụ";
    case "deleteSubcontractor":
      return "Xóa tạm ứng thầu phụ";
    case "saveSubcontractorContract":
      return "Lưu hợp đồng thầu phụ";
    case "deleteSubcontractorContract":
      return "Xóa hợp đồng thầu phụ";
    case "approveSubcontractorContract":
      return "Duyệt hợp đồng thầu phụ";
    case "saveOperation":
      return "Lưu vận hành";
    case "deleteOperation":
      return "Xóa vận hành";
    case "saveLaborNorm":
      return "Lưu định mức";
    case "deleteLaborNorm":
      return "Xóa định mức";
    case "saveProgress":
      return "Lưu tiến độ";
    case "deleteProgress":
      return "Xóa tiến độ";
    case "saveDocument":
      return "Lưu hồ sơ";
    case "deleteDocument":
      return "Xóa hồ sơ";
    case "bulkImport":
      return "Import Excel";
    case "verifyProjectPin":
      return "Mở khóa công trình";
    default:
      return `Thao tác ${action ?? "ERP"}`;
  }
}

function activityEntityId(action: string | undefined, payload: Record<string, unknown>) {
  if (payload.id != null) return String(payload.id);
  if (payload.code != null) return String(payload.code);
  if (payload.contractNo != null) return String(payload.contractNo);
  if (payload.name != null) return String(payload.name);
  if (payload.staffId != null) return String(payload.staffId);
  if (payload.staffName != null) return String(payload.staffName);
  if (payload.materialName != null) return String(payload.materialName);
  if (payload.contractorName != null) return String(payload.contractorName);
  if (action === "bulkImport" && Array.isArray(payload.items)) return `${payload.items.length} dòng`;
  return "";
}

function activitySummary(action: string | undefined, payload: Record<string, unknown>) {
  const label = activityLabelForAction(action);
  const namedValue =
    payload.name ??
    payload.code ??
    payload.contractNo ??
    payload.staffId ??
    payload.staffName ??
    payload.materialName ??
    payload.contractorName ??
    payload.category ??
    payload.id ??
    "";

  if (action === "bulkImport" && Array.isArray(payload.items)) {
    return `${label}: ${payload.items.length.toLocaleString("vi-VN")} dòng`;
  }

  return namedValue ? `${label}: ${namedValue}` : label;
}

async function recordRequestActivity({
  request,
  session,
  action,
  payload,
  summary,
  module,
  entityId,
  projectCode,
}: {
  request: Request;
  session: ClerkAuthSession;
  action: string | undefined;
  payload: Record<string, unknown>;
  summary?: string;
  module?: string;
  entityId?: string | number;
  projectCode?: string;
}) {
  if (!session.orgId || !session.userId || !action) return;

  try {
    const user = await currentUser();
    await recordGiaPhuActivity({
      organizationId: session.orgId,
      userId: session.userId,
      actorName: user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
      actorEmail: user?.primaryEmailAddress?.emailAddress ?? "",
      action,
      module: module ?? activityModuleForAction(action),
      entityId: entityId ?? activityEntityId(action, payload),
      projectCode:
        projectCode ??
        (typeof payload.projectCode === "string"
          ? payload.projectCode
          : typeof payload.code === "string" && (action === "saveProject" || action === "deleteProject")
            ? payload.code
            : readActiveProjectCode(request, payload) || ""),
      summary: summary ?? activitySummary(action, payload),
      ipAddress: requestIpAddress(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });
  } catch (error) {
    console.error("Failed to record Gia Phu activity", error);
  }
}

async function runGiaPhuMutation(action: string | undefined, payload: Record<string, unknown>) {
  switch (action) {
    case "saveProject":
      await saveProject(payload);
      return;
    case "saveContract":
      await saveContract(payload);
      return;
    case "savePayment":
      await savePayment(payload);
      return;
    case "manageCatalog":
      await manageCatalog(payload);
      return;
    case "manageStaff":
      await manageStaff(payload);
      return;
    case "saveStaffProfile":
      await saveStaffProfile(payload);
      return;
    case "saveStaffSkillEvaluation":
      await saveStaffSkillEvaluation(payload);
      return;
    case "saveMaterial":
      await saveMaterial(payload);
      return;
    case "saveSubcontractor":
      await saveSubcontractor(payload);
      return;
    case "saveSubcontractorContract":
      await saveSubcontractorContract(payload);
      return;
    case "saveOperation":
      await saveOperation(payload);
      return;
    case "saveLaborNorm":
      await saveLaborNorm(payload);
      return;
    case "saveProgress":
      await saveProgress(payload);
      return;
    default:
      throw new Error(`Action import không hợp lệ: ${action ?? "(trống)"}.`);
  }
}

function parseFilters(searchParams: URLSearchParams) {
  const rawFilters = searchParams.get("filters");
  if (!rawFilters) return {};

  try {
    const parsed = JSON.parse(rawFilters) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === "string" && value.trim() && value !== "__all")
        .map(([key, value]) => [key, String(value)]),
    );
  } catch {
    return {};
  }
}

function parseSorting(searchParams: URLSearchParams) {
  const rawSorting = searchParams.get("sorting");
  if (!rawSorting) return [];

  try {
    const parsed = JSON.parse(rawSorting) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is { id: string; desc?: boolean } => {
        return typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string";
      })
      .map((item) => ({ id: item.id, desc: Boolean(item.desc) }))
      .slice(0, 1);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    await createGiaPhuSchema();
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }
    if (!session.orgId) {
      return NextResponse.json(
        { status: "error", message: "Vui lòng chọn tổ chức trước khi dùng ERP." },
        { status: 403 },
      );
    }
    const organizationId = session.orgId;
    const permissionKeys = await getEffectiveErpPermissions(session);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("view") === "projects") {
      if (!canUseAnyErpData(session, permissionKeys)) {
        return forbidden("Bạn chưa được cấp quyền truy cập dữ liệu ERP.");
      }

      const projects = await getGiaPhuProjectList({ organizationId });
      return NextResponse.json({ status: "success", projects });
    }

    if (searchParams.get("view") === "rows") {
      const dataset = searchParams.get("dataset");
      if (!isPagedDataset(dataset)) {
        return NextResponse.json({ status: "error", message: "Dataset không hợp lệ." }, { status: 400 });
      }

      if (!canUsePermission(session, permissionKeys, datasetReadPermissions[dataset])) {
        return forbidden("Bạn không có quyền xem nhóm dữ liệu này.");
      }

      const result = await getGiaPhuPagedRows({
        dataset,
        organizationId,
        activeProjectCode: searchParams.get("projectCode") || readActiveProjectCode(request),
        pageIndex: Number(searchParams.get("pageIndex") ?? 0),
        pageSize: Number(searchParams.get("pageSize") ?? 20),
        search: searchParams.get("search") ?? "",
        sorting: parseSorting(searchParams),
        filters: parseFilters(searchParams),
      });

      return NextResponse.json({ status: "success", ...result });
    }

    if (searchParams.get("view") === "filter-options") {
      const dataset = searchParams.get("dataset");
      if (!isPagedDataset(dataset)) {
        return NextResponse.json({ status: "error", message: "Dataset không hợp lệ." }, { status: 400 });
      }

      if (!canUsePermission(session, permissionKeys, datasetReadPermissions[dataset])) {
        return forbidden("Bạn không có quyền xem bộ lọc của nhóm dữ liệu này.");
      }

      const filterOptions = await getGiaPhuFilterOptions({
        dataset,
        organizationId,
        activeProjectCode: searchParams.get("projectCode") || readActiveProjectCode(request),
        filters: parseFilters(searchParams),
      });

      return NextResponse.json({ status: "success", filterOptions });
    }

    if (searchParams.get("view") === "insights") {
      const type = searchParams.get("type");
      const activeProjectCode = searchParams.get("projectCode") || readActiveProjectCode(request);

      if (type === "overview") {
        if (!canUsePermission(session, permissionKeys, ERP_PERMISSIONS.overviewRead)) {
          return forbidden("Bạn không có quyền xem tổng quan.");
        }

        const insights = await getGiaPhuOverviewInsights({ activeProjectCode, organizationId });
        return NextResponse.json({ status: "success", insights });
      }

      if (type === "reports") {
        if (!canUsePermission(session, permissionKeys, ERP_PERMISSIONS.reportsRead)) {
          return forbidden("Bạn không có quyền xem báo cáo.");
        }

        const insights = await getGiaPhuReportsInsights({ activeProjectCode, organizationId });
        return NextResponse.json({ status: "success", insights });
      }

      return NextResponse.json({ status: "error", message: "Loại báo cáo không hợp lệ." }, { status: 400 });
    }

    if (searchParams.get("view") === "material-debt-summary") {
      if (!canUsePermission(session, permissionKeys, ERP_PERMISSIONS.materialsRead)) {
        return forbidden("Bạn không có quyền xem công nợ vật tư.");
      }

      const materialDebtSummary = await getGiaPhuMaterialDebtSummary({
        activeProjectCode: searchParams.get("projectCode") || readActiveProjectCode(request),
        organizationId,
      });
      return NextResponse.json({ status: "success", materialDebtSummary });
    }

    if (searchParams.get("view") === "activity-logs") {
      if (!canUsePermission(session, permissionKeys, ERP_PERMISSIONS.organizationsManage)) {
        return forbidden("Bạn không có quyền xem lịch sử hoạt động.");
      }

      const result = await getGiaPhuActivityLogs({
        organizationId,
        pageIndex: Number(searchParams.get("pageIndex") ?? 0),
        pageSize: Number(searchParams.get("pageSize") ?? 20),
        search: searchParams.get("search") ?? "",
        module: searchParams.get("module") ?? "",
        action: searchParams.get("action") ?? "",
        projectCode: searchParams.get("projectCode") ?? "",
      });

      return NextResponse.json({ status: "success", ...result });
    }

    const data = await getGiaPhuDashboardData({
      organizationId,
      activeProjectCode: readActiveProjectCode(request),
    });

    if (!canUseAnyErpData(session, permissionKeys)) {
      return forbidden("Bạn chưa được cấp quyền truy cập dữ liệu ERP.");
    }

    return NextResponse.json({
      status: "success",
      data: filterGiaPhuDashboardDataByPermissions(data, session, permissionKeys),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await createGiaPhuSchema();
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }
    if (!session.orgId) {
      return NextResponse.json(
        { status: "error", message: "Vui lòng chọn tổ chức trước khi dùng ERP." },
        { status: 403 },
      );
    }
    const body = (await request.json()) as ActionBody;
    const rawPayload = body.payload ?? {};
    const shouldReturnData = rawPayload.__returnData !== false;
    const payload = { ...sanitizeActionPayload(rawPayload), organizationId: session.orgId };
    const permissionKeys = await getEffectiveErpPermissions(session);
    let activityRecorded = false;

    switch (body.action) {
      case "verifyProjectPin": {
        if (!canUseAnyErpData(session, permissionKeys)) {
          return forbidden("Bạn chưa được cấp quyền truy cập dữ liệu ERP.");
        }

        const project = await verifyProjectPin(payload);
        const cookieHeader = request.headers.get("cookie") ?? "";
        const currentUnlockCookie =
          cookieHeader
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${PROJECT_PIN_UNLOCK_COOKIE_NAME}=`))
            ?.split("=")[1] ?? "";
        const unlockedIds = parseUnlockedProjectIds(currentUnlockCookie);
        unlockedIds.add(project.id);

        const response = NextResponse.json({ status: "success", project, refresh: false });
        response.cookies.set(PROJECT_PIN_UNLOCK_COOKIE_NAME, encodeUnlockedProjectIds(unlockedIds), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: PROJECT_PIN_UNLOCK_MAX_AGE,
        });
        await recordRequestActivity({
          request,
          session,
          action: body.action,
          payload,
          entityId: project.id,
          projectCode: project.code,
          summary: `Mở khóa công trình: ${project.code}`,
        });
        return response;
      }
      case "bulkImport": {
        const items = Array.isArray(rawPayload.items) ? (rawPayload.items as BulkImportItem[]) : [];
        if (!items.length) {
          return NextResponse.json({ status: "error", message: "Không có dòng dữ liệu để import." }, { status: 400 });
        }
        if (items.length > 1000) {
          return NextResponse.json(
            { status: "error", message: "Mỗi lần chỉ import tối đa 1.000 dòng để đảm bảo ổn định." },
            { status: 400 },
          );
        }

        for (const item of items) {
          if (item.action === "savePayrollAdjustment" && !canUseAdminRole(session)) {
            return forbidden("Chỉ admin mới có quyền sửa bảng lương.");
          }

          const requiredPermission = mutationPermissions[item.action as keyof typeof mutationPermissions];

          if (!requiredPermission || !canUsePermission(session, permissionKeys, requiredPermission)) {
            return forbidden(`Bạn không có quyền import action ${item.action ?? "(trống)"}.`);
          }

          const itemPayload = {
            ...sanitizeActionPayload(item.payload ?? {}),
            organizationId: session.orgId,
          };
          await runGiaPhuMutation(item.action, itemPayload);
        }
        await recordRequestActivity({
          request,
          session,
          action: body.action,
          payload: { ...payload, items },
        });
        activityRecorded = true;
        break;
      }
      case "saveProject":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveProject)) return forbidden();
        await saveProject(payload);
        break;
      case "deleteProject":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteProject)) return forbidden();
        await deleteProject(payload);
        break;
      case "saveContract":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveContract)) return forbidden();
        await saveContract(payload);
        break;
      case "deleteContract":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteContract)) return forbidden();
        await deleteContract(payload);
        break;
      case "savePayment":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.savePayment)) return forbidden();
        await savePayment(payload);
        break;
      case "deletePayment":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deletePayment)) return forbidden();
        await deletePayment(payload);
        break;
      case "manageCatalog":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.manageCatalog)) return forbidden();
        await manageCatalog(payload);
        break;
      case "deleteCatalog":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteCatalog)) return forbidden();
        await deleteCatalog(payload);
        break;
      case "destroyCatalog":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.destroyCatalog)) return forbidden();
        await destroyCatalog(payload);
        break;
      case "restoreCatalog":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.restoreCatalog)) return forbidden();
        await restoreCatalog(payload);
        break;
      case "manageStaff":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.manageStaff)) return forbidden();
        await manageStaff(payload);
        break;
      case "saveStaffProfile":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveStaffProfile)) return forbidden();
        await saveStaffProfile(payload);
        break;
      case "saveStaffSkillEvaluation":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveStaffSkillEvaluation))
          return forbidden();
        await saveStaffSkillEvaluation(payload);
        break;
      case "deleteStaff":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteStaff)) return forbidden();
        await deleteStaff(payload);
        break;
      case "saveMaterial":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveMaterial)) return forbidden();
        await saveMaterial(payload);
        break;
      case "saveZaloMaterialBreakdown":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveZaloMaterialBreakdown))
          return forbidden();
        await saveZaloMaterialBreakdown(payload);
        break;
      case "deleteMaterial":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteMaterial)) return forbidden();
        await deleteMaterial(payload);
        break;
      case "updateMaterialPrice":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.updateMaterialPrice)) return forbidden();
        await updateMaterialPrice(payload);
        break;
      case "markMaterialPaid":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.markMaterialPaid)) return forbidden();
        await markMaterialPaid(payload);
        break;
      case "saveWeeklyAttendance": {
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveWeeklyAttendance)) return forbidden();
        const rows = await saveWeeklyAttendance(payload);
        await recordRequestActivity({
          request,
          session,
          action: body.action,
          payload,
          summary: `Lưu chấm công: ${rows.length.toLocaleString("vi-VN")} dòng`,
        });
        return NextResponse.json({ status: "success", patch: { attendanceUpsert: rows } });
      }
      case "saveStaffWeeklyAttendance": {
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveStaffWeeklyAttendance)) {
          return forbidden();
        }

        const { savedRows, deletedIds } = await saveStaffWeeklyAttendance(payload);
        await recordRequestActivity({
          request,
          session,
          action: body.action,
          payload,
          summary: `Lưu chấm công nhân sự: ${savedRows.length.toLocaleString("vi-VN")} dòng`,
        });
        return NextResponse.json({
          status: "success",
          patch: { attendanceUpsert: savedRows, attendanceDeleteIds: deletedIds },
        });
      }
      case "savePayrollAdjustment": {
        if (!canUseAdminRole(session)) {
          return forbidden("Chỉ admin mới có quyền sửa bảng lương.");
        }

        const { savedRows, adjustment, deletedAdjustmentIds } = await savePayrollAdjustment(payload);
        await recordRequestActivity({
          request,
          session,
          action: body.action,
          payload,
          entityId: adjustment.id,
          summary: `Lưu điều chỉnh lương: ${adjustment.staffName}`,
        });
        return NextResponse.json({
          status: "success",
          patch: {
            attendanceUpsert: savedRows,
            payrollAdjustmentUpsert: [adjustment],
            payrollAdjustmentDeleteIds: deletedAdjustmentIds,
          },
        });
      }
      case "deleteAttendanceRow": {
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteAttendanceRow)) return forbidden();
        const ids = (await deleteAttendanceRow(payload)) ?? [];
        await recordRequestActivity({
          request,
          session,
          action: body.action,
          payload,
          entityId: ids.join(", "),
          summary: `Xóa dòng chấm công: ${ids.length.toLocaleString("vi-VN")} dòng`,
        });
        return NextResponse.json({ status: "success", patch: { attendanceDeleteIds: ids } });
      }
      case "closeAttendance":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.closeAttendance)) return forbidden();
        await closeAttendance(payload);
        break;
      case "reopenAttendance":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.reopenAttendance)) return forbidden();
        await reopenAttendance(payload);
        break;
      case "saveSubcontractor":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveSubcontractor)) return forbidden();
        await saveSubcontractor(payload);
        break;
      case "deleteSubcontractor":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteSubcontractor)) return forbidden();
        await deleteSubcontractor(payload);
        break;
      case "saveSubcontractorContract":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveSubcontractorContract)) {
          return forbidden();
        }
        await saveSubcontractorContract(payload);
        break;
      case "deleteSubcontractorContract":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteSubcontractorContract)) {
          return forbidden();
        }
        await deleteSubcontractorContract(payload);
        break;
      case "approveSubcontractorContract":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.approveSubcontractorContract)) {
          return forbidden();
        }
        await approveSubcontractorContract(payload);
        break;
      case "saveOperation":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveOperation)) return forbidden();
        await saveOperation(payload);
        break;
      case "deleteOperation":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteOperation)) return forbidden();
        await deleteOperation(payload);
        break;
      case "saveLaborNorm":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveLaborNorm)) return forbidden();
        await saveLaborNorm(payload);
        break;
      case "deleteLaborNorm":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteLaborNorm)) return forbidden();
        await deleteLaborNorm(payload);
        break;
      case "saveProgress":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveProgress)) return forbidden();
        await saveProgress(payload);
        break;
      case "deleteProgress":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteProgress)) return forbidden();
        await deleteProgress(payload);
        break;
      case "saveDocument":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.saveDocument)) return forbidden();
        await saveDocument(payload);
        break;
      case "deleteDocument":
        if (!canUsePermission(session, permissionKeys, mutationPermissions.deleteDocument)) return forbidden();
        await deleteDocument(payload);
        break;
      case "queryDocuments": {
        if (!canUsePermission(session, permissionKeys, mutationPermissions.queryDocuments)) return forbidden();
        const rows = await queryDocuments(payload);
        return NextResponse.json({ status: "success", rows });
      }
      default:
        return NextResponse.json({ status: "error", message: "Unknown GiaPhu ERP action." }, { status: 400 });
    }

    if (!activityRecorded) {
      await recordRequestActivity({ request, session, action: body.action, payload });
    }

    if (!shouldReturnData) {
      return NextResponse.json({ status: "success", refresh: false });
    }

    const data = await getGiaPhuDashboardData({
      organizationId: session.orgId,
      activeProjectCode: readActiveProjectCode(request, payload),
    });
    return NextResponse.json({
      status: "success",
      data: filterGiaPhuDashboardDataByPermissions(data, session, permissionKeys),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
