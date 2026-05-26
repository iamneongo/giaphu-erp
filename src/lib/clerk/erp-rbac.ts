import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { canAccessClerkPermission, type ErpPermissionKey, ERP_PERMISSIONS } from "./erp-rbac-shared";

function buildContext(session: Awaited<ReturnType<typeof auth>>) {
  return {
    orgRole: session.orgRole,
    hasRole: (role: string) => session.has({ role }),
    hasPermission: (permission: string) => session.has({ permission }),
  };
}

export async function enforceErpRoutePermission(
  permission: ErpPermissionKey,
  options?: { allowWithoutOrganization?: boolean; allowLegacyMember?: boolean },
) {
  const session = await auth();

  if (!session.userId) {
    return session.redirectToSignIn();
  }

  if (!session.orgId) {
    if (options?.allowWithoutOrganization ?? true) {
      return;
    }

    redirect("/dashboard/workspaces");
  }

  if (!canAccessClerkPermission(buildContext(session), permission, { allowLegacyMember: options?.allowLegacyMember })) {
    redirect("/unauthorized");
  }
}

export async function enforceOrganizationRoleManagement() {
  const session = await auth();

  if (!session.userId) {
    return session.redirectToSignIn();
  }

  if (!session.orgId) {
    redirect("/dashboard/workspaces");
  }

  if (!canAccessClerkPermission(buildContext(session), ERP_PERMISSIONS.rolesManage, { allowLegacyMember: false })) {
    redirect("/unauthorized");
  }

  return session;
}

export { ERP_PERMISSIONS };
