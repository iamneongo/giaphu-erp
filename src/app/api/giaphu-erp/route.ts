import { NextResponse } from "next/server";

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
  saveSubcontractor,
  saveSubcontractorContract,
  saveWeeklyAttendance,
  saveZaloMaterialBreakdown,
  updateMaterialPrice,
} from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
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

function readActiveProjectCode(request: Request, payload?: Record<string, unknown>) {
  const projectCode =
    typeof payload?.projectCode === "string"
      ? payload.projectCode
      : typeof payload?.code === "string"
        ? payload.code
        : undefined;
  if (projectCode) return projectCode;

  const cookieValue = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTIVE_PROJECT_COOKIE_NAME}=`))
    ?.split("=")[1];

  return cookieValue ? decodeURIComponent(cookieValue) : undefined;
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

export async function GET(request: Request) {
  try {
    await createGiaPhuSchema();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("view") === "projects") {
      const projects = await getGiaPhuProjectList();
      return NextResponse.json({ status: "success", projects });
    }

    if (searchParams.get("view") === "rows") {
      const dataset = searchParams.get("dataset");
      if (!isPagedDataset(dataset)) {
        return NextResponse.json({ status: "error", message: "Dataset không hợp lệ." }, { status: 400 });
      }

      const result = await getGiaPhuPagedRows({
        dataset,
        activeProjectCode: searchParams.get("projectCode") || readActiveProjectCode(request),
        pageIndex: Number(searchParams.get("pageIndex") ?? 0),
        pageSize: Number(searchParams.get("pageSize") ?? 20),
        search: searchParams.get("search") ?? "",
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
        activeProjectCode: searchParams.get("projectCode") || readActiveProjectCode(request),
        filters: parseFilters(searchParams),
      });

      return NextResponse.json({ status: "success", filterOptions });
    }

    if (searchParams.get("view") === "insights") {
      const type = searchParams.get("type");
      const activeProjectCode = searchParams.get("projectCode") || readActiveProjectCode(request);

      if (type === "overview") {
        const insights = await getGiaPhuOverviewInsights({ activeProjectCode });
        return NextResponse.json({ status: "success", insights });
      }

      if (type === "reports") {
        const insights = await getGiaPhuReportsInsights({ activeProjectCode });
        return NextResponse.json({ status: "success", insights });
      }

      return NextResponse.json({ status: "error", message: "Loại báo cáo không hợp lệ." }, { status: 400 });
    }

    const data = await getGiaPhuDashboardData({
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
    const body = (await request.json()) as ActionBody;
    const payload = body.payload ?? {};

    switch (body.action) {
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

    const data = await getGiaPhuDashboardData({
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
