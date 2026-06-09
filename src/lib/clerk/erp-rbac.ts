import { redirect } from "next/navigation";

import { auth } from "@clerk/nextjs/server";

import type { GiaPhuDashboardData } from "../giaphu-erp/types";
import { getOrganizationRoleSet, listOrganizationMemberships, listOrganizationRoles } from "./clerk-bapi";
import {
  canAccessAnyClerkPermission,
  canAccessClerkPermission,
  ERP_PERMISSIONS,
  type ErpPermissionKey,
} from "./erp-rbac-shared";

type ClerkAuthSession = Awaited<ReturnType<typeof auth>>;

const useBackendPermissionLookup = process.env.CLERK_PERMISSION_SYNC_MODE !== "claims";

export const ERP_DATA_ACCESS_PERMISSIONS = [
  ERP_PERMISSIONS.overviewRead,
  ERP_PERMISSIONS.reportsRead,
  ERP_PERMISSIONS.crmRead,
  ERP_PERMISSIONS.crmManage,
  ERP_PERMISSIONS.materialsRead,
  ERP_PERMISSIONS.materialsManage,
  ERP_PERMISSIONS.workforceRead,
  ERP_PERMISSIONS.workforceManage,
  ERP_PERMISSIONS.subcontractorsRead,
  ERP_PERMISSIONS.subcontractorsManage,
  ERP_PERMISSIONS.documentsRead,
  ERP_PERMISSIONS.documentsManage,
  ERP_PERMISSIONS.catalogsRead,
  ERP_PERMISSIONS.catalogsManage,
] as const satisfies readonly ErpPermissionKey[];

function buildContext(session: ClerkAuthSession, permissionKeys?: Iterable<string>) {
  return {
    orgRole: session.orgRole,
    hasRole: (role: string) => session.has({ role }),
    hasPermission: (permission: string) => session.has({ permission }),
    permissionKeys,
  };
}

export function canAccessErpPermission(
  session: ClerkAuthSession,
  permission: ErpPermissionKey,
  permissionKeys?: Iterable<string>,
) {
  return canAccessClerkPermission(buildContext(session, permissionKeys), permission);
}

export function canAccessAnyErpPermission(
  session: ClerkAuthSession,
  permissions: readonly ErpPermissionKey[] = ERP_DATA_ACCESS_PERMISSIONS,
  permissionKeys?: Iterable<string>,
) {
  return canAccessAnyClerkPermission(buildContext(session, permissionKeys), permissions);
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

  if (!useBackendPermissionLookup) {
    return Array.from(permissionKeys);
  }

  try {
    const [roles, memberships, roleSet] = await Promise.all([
      listOrganizationRoles(),
      listOrganizationMemberships(currentSession.orgId),
      getOrganizationRoleSet(currentSession.orgId),
    ]);
    const membership = memberships.find((entry) => entry.publicUserData.userId === currentSession.userId);
    const roleKey = currentSession.orgRole || membership?.role || "";
    const roleBelongsToCurrentOrganization = roleSet.roles.some((entry) => entry.key === roleKey);

    if (roleKey === "org:admin") {
      return allPermissions;
    }

    if (!roleBelongsToCurrentOrganization) {
      return Array.from(permissionKeys);
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

export function filterGiaPhuDashboardDataByPermissions(
  data: GiaPhuDashboardData,
  session: ClerkAuthSession,
  permissionKeys: readonly ErpPermissionKey[],
): GiaPhuDashboardData {
  const canReadOverview = canAccessErpPermission(session, ERP_PERMISSIONS.overviewRead, permissionKeys);
  const canReadReports = canAccessErpPermission(session, ERP_PERMISSIONS.reportsRead, permissionKeys);
  const canReadCrm = canAccessErpPermission(session, ERP_PERMISSIONS.crmRead, permissionKeys);
  const canReadMaterials = canAccessErpPermission(session, ERP_PERMISSIONS.materialsRead, permissionKeys);
  const canReadWorkforce = canAccessErpPermission(session, ERP_PERMISSIONS.workforceRead, permissionKeys);
  const canReadSubcontractors = canAccessErpPermission(session, ERP_PERMISSIONS.subcontractorsRead, permissionKeys);
  const canReadCatalogs = canAccessErpPermission(session, ERP_PERMISSIONS.catalogsRead, permissionKeys);
  const canReadAnyErpData = canAccessAnyErpPermission(session, ERP_DATA_ACCESS_PERMISSIONS, permissionKeys);
  const canUseCatalogs = canReadCatalogs || canReadMaterials || canReadWorkforce || canReadSubcontractors;

  return {
    projects: canReadAnyErpData ? data.projects : [],
    catalogs: {
      hangMuc: canUseCatalogs ? data.catalogs.hangMuc : [],
      vatTu: canReadCatalogs || canReadMaterials ? data.catalogs.vatTu : [],
      vatTuPhu: canReadCatalogs || canReadMaterials ? data.catalogs.vatTuPhu : [],
      thauPhu: canReadCatalogs || canReadSubcontractors ? data.catalogs.thauPhu : [],
      nhaCungCap: canReadCatalogs || canReadMaterials ? data.catalogs.nhaCungCap : [],
    },
    staff: canReadWorkforce ? data.staff : [],
    materials: canReadMaterials ? data.materials : [],
    attendance: canReadWorkforce ? data.attendance : [],
    subcontractors: canReadSubcontractors ? data.subcontractors : [],
    subcontractorContracts: canReadSubcontractors ? data.subcontractorContracts : [],
    operations: canReadSubcontractors ? data.operations : [],
    laborNorms: canReadWorkforce ? data.laborNorms : [],
    progress: canReadWorkforce ? data.progress : [],
    payments: canReadCrm ? data.payments : [],
    contracts: canReadCrm ? data.contracts : [],
    attendanceLocks: canReadWorkforce ? data.attendanceLocks : [],
    summaries: canReadOverview || canReadReports ? data.summaries : {},
  };
}

export { ERP_PERMISSIONS };
