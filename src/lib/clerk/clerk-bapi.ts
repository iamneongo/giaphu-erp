import { clerkClient } from "@clerk/nextjs/server";

import { ERP_PERMISSION_CATALOG, type ErpPermissionKey } from "./erp-rbac-shared";

type ClerkListResponse<T> = {
  data: T[];
  total_count: number;
};

export type ClerkOrganizationPermission = {
  object: "permission";
  id: string;
  key: string;
  name: string;
  description: string;
  type: "system" | "user";
  created_at: number;
  updated_at: number;
};

export type ClerkOrganizationRole = {
  object: "role";
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: ClerkOrganizationPermission[];
  is_creator_eligible: boolean;
  created_at: number;
  updated_at: number;
};

export type ClerkRoleSet = {
  object: "role_set";
  id: string;
  key: string;
  name: string;
  description: string;
  roles: Array<{
    object: "role_set_item";
    id: string;
    key: string;
    name: string;
    description: string;
    has_members: boolean;
    created_at: number;
    updated_at: number;
  }>;
  default_role: {
    id: string;
    key: string;
    name: string;
  };
  creator_role: {
    id: string;
    key: string;
    name: string;
  };
  created_at: number;
  updated_at: number;
};

export type ClerkOrganizationMembership = {
  id: string;
  role: string;
  createdAt: number;
  updatedAt: number;
  permissions: string[];
  publicUserData: {
    userId: string;
    firstName?: string | null;
    lastName?: string | null;
    identifier?: string | null;
    imageUrl?: string | null;
  };
};

export type ClerkOrganizationInvitation = {
  id: string;
  emailAddress: string;
  role: string;
  roleName: string;
  organizationId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  url: string | null;
  status?: "pending" | "accepted" | "revoked" | "expired";
};

export const CLERK_COMPANY_MEMBER_LIMIT = 0;

const CLERK_BAPI_BASE = "https://api.clerk.com/v1";

function getClerkSecretKey() {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing CLERK_SECRET_KEY.");
  }

  return secretKey;
}

async function clerkBapi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CLERK_BAPI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getClerkSecretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Clerk API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listOrganizationPermissions() {
  const response = await clerkBapi<ClerkListResponse<ClerkOrganizationPermission>>(
    "/organization_permissions?limit=200",
  );
  return response.data;
}

export async function listOrganizationRoles() {
  const response = await clerkBapi<ClerkListResponse<ClerkOrganizationRole>>("/organization_roles?limit=200");
  return response.data;
}

export async function getDefaultRoleSet() {
  return clerkBapi<ClerkRoleSet>("/role_sets/role_set:default");
}

export async function getRoleSet(roleSetKey: string) {
  return clerkBapi<ClerkRoleSet>(`/role_sets/${roleSetKey}`);
}

export async function getOrganizationRoleSet(organizationId: string) {
  const client = await clerkClient();
  const organization = await client.organizations.getOrganization({ organizationId });
  const roleSetKey = organization.raw?.role_set_key ?? "role_set:default";

  return getRoleSet(roleSetKey);
}

export async function setOrganizationMembershipLimit(input: {
  organizationId: string;
  maxAllowedMemberships?: number;
}) {
  const client = await clerkClient();

  return client.organizations.updateOrganization(input.organizationId, {
    maxAllowedMemberships: input.maxAllowedMemberships ?? CLERK_COMPANY_MEMBER_LIMIT,
  });
}

export async function setDefaultOrganizationMembershipLimit(maxAllowedMemberships = CLERK_COMPANY_MEMBER_LIMIT) {
  const client = await clerkClient();

  return client.instance.updateOrganizationSettings({
    maxAllowedMemberships,
  });
}

export async function ensureCompanyMembershipLimit(organizationId: string) {
  const client = await clerkClient();
  const organization = await client.organizations.getOrganization({ organizationId });

  if (organization.maxAllowedMemberships === CLERK_COMPANY_MEMBER_LIMIT) {
    await setDefaultOrganizationMembershipLimit();
    return organization;
  }

  const [, nextOrganization] = await Promise.all([
    setDefaultOrganizationMembershipLimit(),
    setOrganizationMembershipLimit({ organizationId }),
  ]);

  return nextOrganization;
}

export async function createOrganizationPermission(input: { key: string; name: string; description: string }) {
  return clerkBapi<ClerkOrganizationPermission>("/organization_permissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createOrganizationRole(input: { key: string; name: string; description: string }) {
  return clerkBapi<ClerkOrganizationRole>("/organization_roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addPermissionToRole(roleId: string, permissionId: string) {
  return clerkBapi<ClerkOrganizationRole>(`/organization_roles/${roleId}/permissions/${permissionId}`, {
    method: "POST",
  });
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  return clerkBapi<void>(`/organization_roles/${roleId}/permissions/${permissionId}`, {
    method: "DELETE",
  });
}

export async function deleteOrganizationRole(roleId: string) {
  return clerkBapi<void>(`/organization_roles/${roleId}`, {
    method: "DELETE",
  });
}

export async function addRolesToRoleSet(roleSetKey: string, roleKeys: string[]) {
  return clerkBapi<ClerkRoleSet>(`/role_sets/${roleSetKey}/roles`, {
    method: "POST",
    body: JSON.stringify({ role_keys: roleKeys }),
  });
}

export async function ensureErpPermissionCatalog() {
  const existingPermissions = await listOrganizationPermissions();
  const existingKeys = new Set(existingPermissions.map((permission) => permission.key));
  const created: ClerkOrganizationPermission[] = [];

  for (const item of ERP_PERMISSION_CATALOG) {
    if (!existingKeys.has(item.key)) {
      created.push(
        await createOrganizationPermission({
          key: item.key,
          name: item.name,
          description: item.description,
        }),
      );
    }
  }

  const permissions = await listOrganizationPermissions();

  return {
    permissions,
    created,
  };
}

export async function createRoleWithPermissions(input: {
  name: string;
  key: string;
  description: string;
  permissionKeys: ErpPermissionKey[];
  roleSetKey?: string;
}) {
  await ensureErpPermissionCatalog();

  const permissions = await listOrganizationPermissions();
  const permissionMap = new Map(permissions.map((permission) => [permission.key, permission]));

  const role = await createOrganizationRole({
    name: input.name,
    key: input.key,
    description: input.description,
  });

  for (const permissionKey of input.permissionKeys) {
    const permission = permissionMap.get(permissionKey);

    if (permission) {
      await addPermissionToRole(role.id, permission.id);
    }
  }

  const roleSetKey = input.roleSetKey ?? "role_set:default";
  const roleSet = await getRoleSet(roleSetKey);

  if (!roleSet.roles.some((entry) => entry.key === input.key)) {
    await addRolesToRoleSet(roleSetKey, [input.key]);
  }

  const roles = await listOrganizationRoles();
  return roles.find((entry) => entry.id === role.id) ?? role;
}

export async function updateRolePermissions(input: { roleId: string; permissionKeys: ErpPermissionKey[] }) {
  await ensureErpPermissionCatalog();

  const [roles, permissions] = await Promise.all([listOrganizationRoles(), listOrganizationPermissions()]);
  const role = roles.find((entry) => entry.id === input.roleId);

  if (!role) {
    throw new Error("Role not found.");
  }

  const permissionByKey = new Map(permissions.map((permission) => [permission.key as ErpPermissionKey, permission]));
  const nextKeys = new Set(input.permissionKeys);
  const currentKeys = new Set(role.permissions.map((permission) => permission.key as ErpPermissionKey));

  for (const permissionKey of nextKeys) {
    if (!currentKeys.has(permissionKey)) {
      const permission = permissionByKey.get(permissionKey);
      if (permission) {
        await addPermissionToRole(role.id, permission.id);
      }
    }
  }

  for (const permissionKey of currentKeys) {
    if (!nextKeys.has(permissionKey)) {
      const permission = permissionByKey.get(permissionKey);
      if (permission) {
        await removePermissionFromRole(role.id, permission.id);
      }
    }
  }

  const nextRoles = await listOrganizationRoles();
  return nextRoles.find((entry) => entry.id === role.id) ?? role;
}

export async function listOrganizationMemberships(organizationId: string) {
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId,
    limit: 100,
  });

  return memberships.data as ClerkOrganizationMembership[];
}

export async function getOrganizationMembershipForUser(input: { organizationId: string; userId: string }) {
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: input.organizationId,
    userId: [input.userId],
    limit: 1,
  });

  return (memberships.data[0] as ClerkOrganizationMembership | undefined) ?? null;
}

export async function updateOrganizationMembershipRole(input: {
  organizationId: string;
  userId: string;
  role: string;
}) {
  const client = await clerkClient();

  return client.organizations.updateOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
  });
}

export async function deleteOrganizationMembership(input: { organizationId: string; userId: string }) {
  const client = await clerkClient();

  return client.organizations.deleteOrganizationMembership({
    organizationId: input.organizationId,
    userId: input.userId,
  });
}

export async function listOrganizationInvitations(organizationId: string) {
  const client = await clerkClient();
  const invitations = await client.organizations.getOrganizationInvitationList({
    organizationId,
    limit: 100,
    status: ["pending"],
  });

  return invitations.data as ClerkOrganizationInvitation[];
}

export async function createOrganizationInvitation(input: {
  organizationId: string;
  emailAddress: string;
  role: string;
  inviterUserId?: string;
  redirectUrl?: string;
}) {
  const client = await clerkClient();
  await ensureCompanyMembershipLimit(input.organizationId);

  return client.organizations.createOrganizationInvitation({
    organizationId: input.organizationId,
    emailAddress: input.emailAddress,
    role: input.role,
    inviterUserId: input.inviterUserId,
    redirectUrl: input.redirectUrl,
  });
}

export async function revokeOrganizationInvitation(input: {
  organizationId: string;
  invitationId: string;
  requestingUserId?: string;
}) {
  const client = await clerkClient();

  return client.organizations.revokeOrganizationInvitation({
    organizationId: input.organizationId,
    invitationId: input.invitationId,
    requestingUserId: input.requestingUserId,
  });
}
