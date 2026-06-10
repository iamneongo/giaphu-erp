import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import {
  getOrganizationMembershipForUser,
  setDefaultOrganizationMembershipLimit,
  setOrganizationMembershipLimit,
} from "@/lib/clerk/clerk-bapi";

function isAdminRole(role: string | null | undefined) {
  return role === "org:admin";
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session.userId) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const action = String(payload.action ?? "");
  const organizationId = String(payload.organizationId ?? "").trim();

  if (action !== "setUnlimitedMemberships") {
    return NextResponse.json({ status: "error", message: "Action không hợp lệ." }, { status: 400 });
  }

  if (!organizationId) {
    return NextResponse.json({ status: "error", message: "Thiếu workspace cần cập nhật." }, { status: 400 });
  }

  try {
    const currentMembership = await getOrganizationMembershipForUser({
      organizationId,
      userId: session.userId,
    });

    if (!currentMembership) {
      return NextResponse.json({ status: "error", message: "Bạn không thuộc workspace này." }, { status: 403 });
    }

    if (!isAdminRole(currentMembership.role)) {
      return NextResponse.json(
        { status: "error", message: "Chỉ admin workspace mới được cập nhật giới hạn thành viên." },
        { status: 403 },
      );
    }

    const [organization] = await Promise.all([
      setOrganizationMembershipLimit({ organizationId }),
      setDefaultOrganizationMembershipLimit(),
    ]);

    return NextResponse.json({ status: "success", organization });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
