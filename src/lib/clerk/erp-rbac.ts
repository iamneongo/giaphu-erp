import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import { listOrganizationMemberships, listOrganizationRoles } from "./clerk-bapi";
import { canAccessClerkPermission, ERP_PERMISSIONS, type ErpPermissionKey } from "./erp-rbac-shared";

type ClerkAuthSession = Awaited<ReturnType<typeof auth>>;

function buildContext(session: ClerkAuthSession, permissionKeys?: Iterable<string>) {
  return {
    orgRole: session.orgRole,
    hasRole: (role: string) => session.has({ role }),
    hasPermission: (permission: string) => session.has({ permission }),
    permissionKeys,
  };
}

export async function getEffectiveErpPermissions(session?: ClerkAuthSession) {
  const currentSession = session ?? (await auth());

  if (!currentSession.userId || !currentSession.orgId) {
    return [] as ErpPermissionKey[];
  }

  const allPermissions = Object.values(ERP_PERMISSIONS);

  if (currentSession.has({ role: "org:admin" })) {
    return allPermissions;
  }

  const permissionKeys = new Set<ErpPermissionKey>();

  for (const permission of allPermissions) {
    if (currentSession.has({ permission })) {
      permissionKeys.add(permission);
    }
  }

  try {
    const [roles, memberships] = await Promise.all([
      listOrganizationRoles(),
      listOrganizationMemberships(currentSession.orgId),
    ]);
    const membership = memberships.find((entry) => entry.publicUserData.userId === currentSession.userId);
    const roleKey = currentSession.orgRole || membership?.role || "";

    if (roleKey === "org:admin") {
      return allPermissions;
    }

    for (const permissionKey of membership?.permissions ?? []) {
      if (allPermissions.includes(permissionKey as ErpPermissionKey)) {
        permissionKeys.add(permissionKey as ErpPermissionKey);
      }
    }

    const role = roles.find((entry) => entry.key === roleKey);

    for (const permission of role?.permissions ?? []) {
      if (allPermissions.includes(permission.key as ErpPermissionKey)) {
        permissionKeys.add(permission.key as ErpPermissionKey);
      }
    }
  } catch {
    // Session claims are still honored if Clerk Backend API is temporarily unavailable.
  }

  return Array.from(permissionKeys);
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

  const permissionKeys = await getEffectiveErpPermissions(session);

  if (
    !canAccessClerkPermission(buildContext(session, permissionKeys), permission, {
      allowLegacyMember: options?.allowLegacyMember,
    })
  ) {
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

  const permissionKeys = await getEffectiveErpPermissions(session);

  if (
    !canAccessClerkPermission(buildContext(session, permissionKeys), ERP_PERMISSIONS.rolesManage, {
      allowLegacyMember: false,
    })
  ) {
    redirect("/unauthorized");
  }

  return session;
}

export { ERP_PERMISSIONS };
