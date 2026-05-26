import { NextResponse } from "next/server";

import {
  approveSubcontractorContract,
  closeAttendance,
  createGiaPhuSchema,
  deleteStaff,
  getGiaPhuDashboardData,
  getGiaPhuProjectList,
  manageCatalog,
  manageStaff,
  markMaterialPaid,
  queryDocuments,
  reopenAttendance,
  saveContract,
  saveDocument,
  saveLaborNorm,
  saveMaterial,
  saveMaterialNorm,
  saveOperation,
  savePayment,
  saveProgress,
  saveProject,
  saveSubcontractor,
  saveSubcontractorContract,
  saveWeeklyAttendance,
  updateMaterialPrice,
} from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  try {
    await createGiaPhuSchema();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("view") === "projects") {
      const projects = await getGiaPhuProjectList();
      return NextResponse.json({ status: "success", projects });
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
      case "saveContract":
        await saveContract(payload);
        break;
      case "savePayment":
        await savePayment(payload);
        break;
      case "manageCatalog":
        await manageCatalog(payload);
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
      case "updateMaterialPrice":
        await updateMaterialPrice(payload);
        break;
      case "markMaterialPaid":
        await markMaterialPaid(payload);
        break;
      case "saveWeeklyAttendance":
        await saveWeeklyAttendance(payload);
        break;
      case "closeAttendance":
        await closeAttendance(payload);
        break;
      case "reopenAttendance":
        await reopenAttendance(payload);
        break;
      case "saveSubcontractor":
        await saveSubcontractor(payload);
        break;
      case "saveSubcontractorContract":
        await saveSubcontractorContract(payload);
        break;
      case "approveSubcontractorContract":
        await approveSubcontractorContract(payload);
        break;
      case "saveOperation":
        await saveOperation(payload);
        break;
      case "saveMaterialNorm":
        await saveMaterialNorm(payload);
        break;
      case "saveLaborNorm":
        await saveLaborNorm(payload);
        break;
      case "saveProgress":
        await saveProgress(payload);
        break;
      case "saveDocument":
        await saveDocument(payload);
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
