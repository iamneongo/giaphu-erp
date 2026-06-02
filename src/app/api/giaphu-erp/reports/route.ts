import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getEffectiveErpPermissions } from "@/lib/clerk/erp-rbac";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import { createGiaPhuSchema, getGiaPhuReportsData } from "@/lib/giaphu-erp/db";
import type { ReportTableState } from "@/lib/giaphu-erp/types";

function parseTableStates(value: string | null) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as {
      labor?: ReportTableState;
      materials?: ReportTableState;
      operations?: ReportTableState;
    };

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session.userId) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    if (!session.orgId) {
      return NextResponse.json({ status: "error", message: "Không có tổ chức đang hoạt động." }, { status: 400 });
    }

    const permissionKeys = await getEffectiveErpPermissions(session);
    const canReadReports = canAccessClerkPermission(
      {
        orgRole: session.orgRole,
        hasRole: (role) => session.has({ role }),
        hasPermission: (permission) => session.has({ permission }),
        permissionKeys,
      },
      ERP_PERMISSIONS.reportsRead,
    );

    if (!canReadReports) {
      return NextResponse.json({ status: "error", message: "Bạn không có quyền xem báo cáo." }, { status: 403 });
    }

    await createGiaPhuSchema();

    const { searchParams } = new URL(request.url);
    const data = await getGiaPhuReportsData({
      organizationId: session.orgId,
      activeProjectCode: searchParams.get("projectCode") ?? undefined,
      tables: parseTableStates(searchParams.get("tables")),
    });

    return NextResponse.json({ status: "success", data });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
