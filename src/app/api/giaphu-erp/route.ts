import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

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
  getGiaPhuDashboardData,
  getGiaPhuFilterOptions,
  getGiaPhuOverviewInsights,
  getGiaPhuPagedRows,
  getGiaPhuProjectList,
  getGiaPhuReportsInsights,
  manageCatalog,
  manageStaff,
  markMaterialPaid,
  queryDocuments,
  reopenAttendance,
  saveContract,
  saveDocument,
  saveLaborNorm,
  saveMaterial,
  saveOperation,
  savePayment,
  saveProgress,
  saveProject,
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

function sanitizeActionPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !key.startsWith("__")));
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
    const { searchParams } = new URL(request.url);

    if (searchParams.get("view") === "projects") {
      const projects = await getGiaPhuProjectList({ organizationId });
      return NextResponse.json({ status: "success", projects });
    }

    if (searchParams.get("view") === "rows") {
      const dataset = searchParams.get("dataset");
      if (!isPagedDataset(dataset)) {
        return NextResponse.json({ status: "error", message: "Dataset không hợp lệ." }, { status: 400 });
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
        const insights = await getGiaPhuOverviewInsights({ activeProjectCode, organizationId });
        return NextResponse.json({ status: "success", insights });
      }

      if (type === "reports") {
        const insights = await getGiaPhuReportsInsights({ activeProjectCode, organizationId });
        return NextResponse.json({ status: "success", insights });
      }

      return NextResponse.json({ status: "error", message: "Loại báo cáo không hợp lệ." }, { status: 400 });
    }

    const data = await getGiaPhuDashboardData({
      organizationId,
      activeProjectCode: readActiveProjectCode(request),
    });
    return NextResponse.json({ status: "success", data });
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

    switch (body.action) {
      case "verifyProjectPin": {
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
          const itemPayload = {
            ...sanitizeActionPayload(item.payload ?? {}),
            organizationId: session.orgId,
          };
          await runGiaPhuMutation(item.action, itemPayload);
        }
        break;
      }
      case "saveProject":
        await saveProject(payload);
        break;
      case "deleteProject":
        await deleteProject(payload);
        break;
      case "saveContract":
        await saveContract(payload);
        break;
      case "deleteContract":
        await deleteContract(payload);
        break;
      case "savePayment":
        await savePayment(payload);
        break;
      case "deletePayment":
        await deletePayment(payload);
        break;
      case "manageCatalog":
        await manageCatalog(payload);
        break;
      case "deleteCatalog":
        await deleteCatalog(payload);
        break;
      case "manageStaff":
        await manageStaff(payload);
        break;
      case "deleteStaff":
        await deleteStaff(payload);
        break;
      case "saveMaterial":
        await saveMaterial(payload);
        break;
      case "saveZaloMaterialBreakdown":
        await saveZaloMaterialBreakdown(payload);
        break;
      case "deleteMaterial":
        await deleteMaterial(payload);
        break;
      case "updateMaterialPrice":
        await updateMaterialPrice(payload);
        break;
      case "markMaterialPaid":
        await markMaterialPaid(payload);
        break;
      case "saveWeeklyAttendance": {
        const rows = await saveWeeklyAttendance(payload);
        return NextResponse.json({ status: "success", patch: { attendanceUpsert: rows } });
      }
      case "saveStaffWeeklyAttendance": {
        const { savedRows, deletedIds } = await saveStaffWeeklyAttendance(payload);
        return NextResponse.json({
          status: "success",
          patch: { attendanceUpsert: savedRows, attendanceDeleteIds: deletedIds },
        });
      }
      case "deleteAttendanceRow": {
        const ids = await deleteAttendanceRow(payload);
        return NextResponse.json({ status: "success", patch: { attendanceDeleteIds: ids } });
      }
      case "closeAttendance":
        await closeAttendance(payload);
        break;
      case "reopenAttendance":
        await reopenAttendance(payload);
        break;
      case "saveSubcontractor":
        await saveSubcontractor(payload);
        break;
      case "deleteSubcontractor":
        await deleteSubcontractor(payload);
        break;
      case "saveSubcontractorContract":
        await saveSubcontractorContract(payload);
        break;
      case "deleteSubcontractorContract":
        await deleteSubcontractorContract(payload);
        break;
      case "approveSubcontractorContract":
        await approveSubcontractorContract(payload);
        break;
      case "saveOperation":
        await saveOperation(payload);
        break;
      case "deleteOperation":
        await deleteOperation(payload);
        break;
      case "saveLaborNorm":
        await saveLaborNorm(payload);
        break;
      case "deleteLaborNorm":
        await deleteLaborNorm(payload);
        break;
      case "saveProgress":
        await saveProgress(payload);
        break;
      case "deleteProgress":
        await deleteProgress(payload);
        break;
      case "saveDocument":
        await saveDocument(payload);
        break;
      case "deleteDocument":
        await deleteDocument(payload);
        break;
      case "queryDocuments": {
        const rows = await queryDocuments(payload);
        return NextResponse.json({ status: "success", rows });
      }
      default:
        return NextResponse.json({ status: "error", message: "Unknown GiaPhu ERP action." }, { status: 400 });
    }

    if (!shouldReturnData) {
      return NextResponse.json({ status: "success", refresh: false });
    }

    const data = await getGiaPhuDashboardData({
      organizationId: session.orgId,
      activeProjectCode: readActiveProjectCode(request, payload),
    });
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
