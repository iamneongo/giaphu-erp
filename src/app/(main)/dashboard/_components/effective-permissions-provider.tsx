"use client";

import * as React from "react";

import { useAuth } from "@clerk/nextjs";

import { canAccessClerkPermission, type ErpPermissionKey } from "@/lib/clerk/erp-rbac-shared";

const EffectivePermissionsContext = React.createContext<readonly ErpPermissionKey[]>([]);

export function EffectivePermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly ErpPermissionKey[];
  children: React.ReactNode;
}) {
  return <EffectivePermissionsContext.Provider value={permissions}>{children}</EffectivePermissionsContext.Provider>;
}

export function useEffectiveErpPermissions() {
  return React.useContext(EffectivePermissionsContext);
}

export function useCanAccessErpPermission(permission: ErpPermissionKey) {
  const { has, orgRole } = useAuth();
  const permissionKeys = useEffectiveErpPermissions();

  return canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (key) => has?.({ permission: key }) ?? false,
      permissionKeys,
    },
    permission,
  );
}
