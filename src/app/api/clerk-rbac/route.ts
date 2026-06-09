import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import {
  type ClerkOrganizationRole,
  type ClerkRoleSet,
  createOrganizationInvitation,
  createRoleWithPermissions,
  deleteOrganizationMembership,
  deleteOrganizationRole,
  ensureErpPermissionCatalog,
  getOrganizationRoleSet,
  listOrganizationInvitations,
  listOrganizationMemberships,
  listOrganizationPermissions,
  listOrganizationRoles,
  revokeOrganizationInvitation,
  updateOrganizationMembershipRole,
  updateRolePermissions,
} from "@/lib/clerk/clerk-bapi";
import { getEffectiveErpPermissions } from "@/lib/clerk/erp-rbac";
import {
  canAccessClerkPermission,
  ERP_PERMISSION_CATALOG,
  ERP_PERMISSIONS,
  type ErpPermissionKey,
} from "@/lib/clerk/erp-rbac-shared";
import { getAppOrigin } from "@/lib/site-url";

function formatClerkApiError(error: unknown) {
  const fallback = error instanceof Error ? error.message : String(error);

  try {
    const payload = JSON.parse(fallback) as {
      errors?: Array<{
        code?: string;
        message?: string;
        long_message?: string;
        meta?: { param_name?: string };
      }>;
    };

    const firstError = payload.errors?.[0];

    if (!firstError) {
      return fallback;
    }

    if (firstError.code === "form_identifier_exists" && firstError.meta?.param_name === "key") {
      return "Key role da ton tai. Hay nhap key khac.";
    }

    return firstError.long_message || firstError.message || fallback;
  } catch {
    return fallback;
  }
}

function getClerkApiErrorStatus(error: unknown) {
  const fallback = error instanceof Error ? error.message : String(error);

  try {
    const payload = JSON.parse(fallback) as {
      errors?: Array<{
        code?: string;
      }>;
    };
    const code = payload.errors?.[0]?.code;

    if (
      code === "form_identifier_exists" ||
      code === "identifier_exists" ||
      code === "resource_already_exists" ||
      code === "duplicate_record"
    ) {
      return 409;
    }

    if (code?.startsWith("form_")) {
      return 400;
    }
  } catch {
    return 500;
  }

  return 500;
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

async function canManageRoles(session: Awaited<ReturnType<typeof auth>>) {
  const permissionKeys = await getEffectiveErpPermissions(session);

  return canAccessClerkPermission(
    {
      orgRole: session.orgRole,
      hasRole: (role) => session.has({ role }),
      hasPermission: (permission) => session.has({ permission }),
      permissionKeys,
    },
    ERP_PERMISSIONS.rolesManage,
    { allowLegacyMember: false },
  );
}

function isAdminRole(role: string | null | undefined) {
  return role === "org:admin";
}

function getRoleSetKeys(roleSet: ClerkRoleSet) {
  return new Set(roleSet.roles.map((role) => role.key));
}

function filterRolesByRoleSet(roles: ClerkOrganizationRole[], roleSet: ClerkRoleSet) {
  const roleSetKeys = getRoleSetKeys(roleSet);
  return roles.filter((role) => roleSetKeys.has(role.key));
}

function findRoleInRoleSet(roles: ClerkOrganizationRole[], roleSet: ClerkRoleSet, roleId: string) {
  const roleSetKeys = getRoleSetKeys(roleSet);
  return roles.find((role) => role.id === roleId && roleSetKeys.has(role.key));
}

export async function GET() {
  const session = await auth();

  if (!session.userId) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  if (!session.orgId) {
    return NextResponse.json({ status: "error", message: "Không có tổ chức đang hoạt động." }, { status: 400 });
  }

  if (!(await canManageRoles(session))) {
    return NextResponse.json({ status: "error", message: "Bạn không có quyền quản lý vai trò." }, { status: 403 });
  }

  const [roleSet, roles, permissions, memberships, invitations] = await Promise.all([
    getOrganizationRoleSet(session.orgId),
    listOrganizationRoles(),
    listOrganizationPermissions(),
    listOrganizationMemberships(session.orgId),
    listOrganizationInvitations(session.orgId),
  ]);

  return NextResponse.json({
    status: "success",
    currentUserId: session.userId,
    roleSet,
    roles: filterRolesByRoleSet(roles, roleSet),
    permissions,
    memberships,
    invitations,
    permissionCatalog: ERP_PERMISSION_CATALOG,
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session.userId) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  if (!session.orgId) {
    return NextResponse.json({ status: "error", message: "Không có tổ chức đang hoạt động." }, { status: 400 });
  }

  if (!(await canManageRoles(session))) {
    return NextResponse.json({ status: "error", message: "Bạn không có quyền quản lý vai trò." }, { status: 403 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const action = String(payload.action ?? "");

  try {
    if (action === "syncPermissions") {
      const result = await ensureErpPermissionCatalog();
      return NextResponse.json({ status: "success", ...result });
    }

    if (action === "createRole") {
      const roleSet = await getOrganizationRoleSet(session.orgId);
      const role = await createRoleWithPermissions({
        name: String(payload.name ?? "").trim(),
        key: String(payload.key ?? "").trim(),
        description: String(payload.description ?? "").trim(),
        permissionKeys: Array.isArray(payload.permissionKeys) ? (payload.permissionKeys as ErpPermissionKey[]) : [],
        roleSetKey: roleSet.key,
      });

      return NextResponse.json({ status: "success", role });
    }

    if (action === "updateRolePermissions") {
      const [roleSet, roles] = await Promise.all([getOrganizationRoleSet(session.orgId), listOrganizationRoles()]);
      const roleId = String(payload.roleId ?? "");

      if (!findRoleInRoleSet(roles, roleSet, roleId)) {
        return NextResponse.json(
          { status: "error", message: "Vai trò này không thuộc workspace hiện tại." },
          { status: 403 },
        );
      }

      const role = await updateRolePermissions({
        roleId,
        permissionKeys: Array.isArray(payload.permissionKeys) ? (payload.permissionKeys as ErpPermissionKey[]) : [],
      });

      return NextResponse.json({ status: "success", role });
    }

    if (action === "deleteRole") {
      const [roleSet, roles] = await Promise.all([getOrganizationRoleSet(session.orgId), listOrganizationRoles()]);
      const roleId = String(payload.roleId ?? "");
      const role = findRoleInRoleSet(roles, roleSet, roleId);

      if (!role) {
        return NextResponse.json(
          { status: "error", message: "Vai trò này không thuộc workspace hiện tại." },
          { status: 403 },
        );
      }

      if (isAdminRole(role.key)) {
        return NextResponse.json({ status: "error", message: "Không thể xóa role admin hệ thống." }, { status: 400 });
      }

      await deleteOrganizationRole(roleId);
      return NextResponse.json({ status: "success" });
    }

    if (action === "updateMembershipRole") {
      const userId = String(payload.userId ?? "").trim();
      const role = String(payload.role ?? "").trim();

      if (!userId || !role) {
        return NextResponse.json({ status: "error", message: "Thiếu user hoặc role cần cập nhật." }, { status: 400 });
      }

      const memberships = await listOrganizationMemberships(session.orgId);
      const targetMembership = memberships.find((entry) => entry.publicUserData.userId === userId);

      if (!targetMembership) {
        return NextResponse.json(
          { status: "error", message: "Không tìm thấy thành viên cần cập nhật." },
          { status: 404 },
        );
      }

      const roleSet = await getOrganizationRoleSet(session.orgId);
      if (!getRoleSetKeys(roleSet).has(role)) {
        return NextResponse.json(
          { status: "error", message: "Vai trò này không thuộc workspace hiện tại." },
          { status: 400 },
        );
      }

      const adminMemberships = memberships.filter((entry) => isAdminRole(entry.role));
      const wouldRemoveLastAdmin =
        isAdminRole(targetMembership.role) && !isAdminRole(role) && adminMemberships.length <= 1;

      if (wouldRemoveLastAdmin) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Tổ chức phải luôn có ít nhất một admin. Hãy cấp quyền admin cho người khác trước khi hạ quyền này.",
          },
          { status: 400 },
        );
      }

      const membership = await updateOrganizationMembershipRole({
        organizationId: session.orgId,
        userId,
        role,
      });

      return NextResponse.json({ status: "success", membership });
    }

    if (action === "inviteMember") {
      const emailAddress = String(payload.emailAddress ?? "").trim();
      const role = String(payload.role ?? "").trim();

      if (!emailAddress || !role) {
        return NextResponse.json(
          { status: "error", message: "Thiếu email hoặc vai trò để gửi lời mời." },
          { status: 400 },
        );
      }

      const [roleSet, memberships, invitations] = await Promise.all([
        getOrganizationRoleSet(session.orgId),
        listOrganizationMemberships(session.orgId),
        listOrganizationInvitations(session.orgId),
      ]);
      const normalizedEmail = normalizeEmail(emailAddress);

      if (!roleSet.roles.some((entry) => entry.key === role)) {
        return NextResponse.json(
          { status: "error", message: "Vai trò này không còn khả dụng trong tổ chức. Hãy tải lại trang rồi chọn lại." },
          { status: 400 },
        );
      }

      if (memberships.some((membership) => normalizeEmail(membership.publicUserData.identifier) === normalizedEmail)) {
        return NextResponse.json(
          { status: "error", message: "Email này đã là thành viên của tổ chức, không cần gửi lời mời lại." },
          { status: 409 },
        );
      }

      if (invitations.some((invitation) => normalizeEmail(invitation.emailAddress) === normalizedEmail)) {
        return NextResponse.json(
          { status: "error", message: "Email này đã có lời mời đang chờ phản hồi." },
          { status: 409 },
        );
      }

      const invitation = await createOrganizationInvitation({
        organizationId: session.orgId,
        emailAddress,
        role,
        inviterUserId: session.userId,
        redirectUrl: `${getAppOrigin(request.headers, request.url)}/dashboard/workspaces/team`,
      });

      return NextResponse.json({ status: "success", invitation });
    }

    if (action === "revokeInvitation") {
      const invitationId = String(payload.invitationId ?? "").trim();

      if (!invitationId) {
        return NextResponse.json({ status: "error", message: "Thiếu lời mời cần thu hồi." }, { status: 400 });
      }

      const invitation = await revokeOrganizationInvitation({
        organizationId: session.orgId,
        invitationId,
        requestingUserId: session.userId,
      });

      return NextResponse.json({ status: "success", invitation });
    }

    if (action === "removeMembership") {
      const userId = String(payload.userId ?? "").trim();

      if (!userId) {
        return NextResponse.json({ status: "error", message: "Thiếu thành viên cần xóa." }, { status: 400 });
      }

      const memberships = await listOrganizationMemberships(session.orgId);
      const targetMembership = memberships.find((entry) => entry.publicUserData.userId === userId);

      if (!targetMembership) {
        return NextResponse.json({ status: "error", message: "Không tìm thấy thành viên cần xóa." }, { status: 404 });
      }

      const adminMemberships = memberships.filter((entry) => isAdminRole(entry.role));
      const wouldRemoveLastAdmin = isAdminRole(targetMembership.role) && adminMemberships.length <= 1;

      if (wouldRemoveLastAdmin) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Tổ chức phải luôn có ít nhất một admin. Hãy cấp quyền admin cho người khác trước khi xóa thành viên này.",
          },
          { status: 400 },
        );
      }

      if (userId === session.userId) {
        return NextResponse.json(
          { status: "error", message: "Không thể tự xóa chính bạn tại màn quản trị này." },
          { status: 400 },
        );
      }

      const membership = await deleteOrganizationMembership({
        organizationId: session.orgId,
        userId,
      });

      return NextResponse.json({ status: "success", membership });
    }

    return NextResponse.json({ status: "error", message: "Action không hợp lệ." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: formatClerkApiError(error),
      },
      { status: getClerkApiErrorStatus(error) },
    );
  }
}
