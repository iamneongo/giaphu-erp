export const ERP_PERMISSIONS = {
  overviewRead: "org:erp_overview:read",
  reportsRead: "org:erp_reports:read",
  crmRead: "org:erp_crm:read",
  crmManage: "org:erp_crm:manage",
  materialsRead: "org:erp_materials:read",
  materialsManage: "org:erp_materials:manage",
  workforceRead: "org:erp_workforce:read",
  workforceManage: "org:erp_workforce:manage",
  subcontractorsRead: "org:erp_subcontractors:read",
  subcontractorsManage: "org:erp_subcontractors:manage",
  documentsRead: "org:erp_documents:read",
  documentsManage: "org:erp_documents:manage",
  catalogsRead: "org:erp_catalogs:read",
  catalogsManage: "org:erp_catalogs:manage",
  organizationsManage: "org:erp_organizations:manage",
  rolesManage: "org:erp_roles:manage",
} as const;

export type ErpPermissionKey = (typeof ERP_PERMISSIONS)[keyof typeof ERP_PERMISSIONS];

export type PermissionCatalogItem = {
  key: ErpPermissionKey;
  name: string;
  description: string;
  group: string;
};

export const ERP_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    key: ERP_PERMISSIONS.overviewRead,
    name: "Xem tổng quan",
    description: "Cho phép truy cập màn tổng quan công trình.",
    group: "Tổng quan",
  },
  {
    key: ERP_PERMISSIONS.reportsRead,
    name: "Xem báo cáo",
    description: "Cho phép truy cập báo cáo và biểu đồ tài chính.",
    group: "Tổng quan",
  },
  {
    key: ERP_PERMISSIONS.crmRead,
    name: "Xem CRM công trình",
    description: "Cho phép xem danh sách công trình, hợp đồng và thu tiền.",
    group: "CRM công trình",
  },
  {
    key: ERP_PERMISSIONS.crmManage,
    name: "Quản lý CRM công trình",
    description: "Cho phép thêm và cập nhật công trình, hợp đồng và thu tiền.",
    group: "CRM công trình",
  },
  {
    key: ERP_PERMISSIONS.materialsRead,
    name: "Xem vật tư",
    description: "Cho phép xem phát sinh vật tư và định mức vật tư.",
    group: "Vật tư",
  },
  {
    key: ERP_PERMISSIONS.materialsManage,
    name: "Quản lý vật tư",
    description: "Cho phép nhập vật tư, cập nhật giá và quản lý định mức.",
    group: "Vật tư",
  },
  {
    key: ERP_PERMISSIONS.workforceRead,
    name: "Xem nhân công",
    description: "Cho phép xem chấm công, nhân sự, định mức và tiến độ.",
    group: "Nhân công",
  },
  {
    key: ERP_PERMISSIONS.workforceManage,
    name: "Quản lý nhân công",
    description: "Cho phép chấm công, kết sổ, quản lý nhân sự và tiến độ.",
    group: "Nhân công",
  },
  {
    key: ERP_PERMISSIONS.subcontractorsRead,
    name: "Xem thầu phụ",
    description: "Cho phép xem tạm ứng, hợp đồng thầu phụ và vận hành.",
    group: "Thầu phụ",
  },
  {
    key: ERP_PERMISSIONS.subcontractorsManage,
    name: "Quản lý thầu phụ",
    description: "Cho phép tạo tạm ứng, hợp đồng thầu phụ và chi phí vận hành.",
    group: "Thầu phụ",
  },
  {
    key: ERP_PERMISSIONS.documentsRead,
    name: "Xem hồ sơ",
    description: "Cho phép tìm kiếm và xem metadata hồ sơ công trình.",
    group: "Hồ sơ",
  },
  {
    key: ERP_PERMISSIONS.documentsManage,
    name: "Quản lý hồ sơ",
    description: "Cho phép thêm hồ sơ công trình mới.",
    group: "Hồ sơ",
  },
  {
    key: ERP_PERMISSIONS.catalogsRead,
    name: "Xem danh mục",
    description: "Cho phép xem hạng mục, vật tư, thầu phụ và nhà cung cấp.",
    group: "Thiết lập",
  },
  {
    key: ERP_PERMISSIONS.catalogsManage,
    name: "Quản lý danh mục",
    description: "Cho phép thêm và chỉnh dữ liệu danh mục ERP.",
    group: "Thiết lập",
  },
  {
    key: ERP_PERMISSIONS.organizationsManage,
    name: "Quản lý tổ chức",
    description: "Cho phép quản lý workspace tổ chức trong Clerk.",
    group: "Tổ chức",
  },
  {
    key: ERP_PERMISSIONS.rolesManage,
    name: "Quản lý vai trò và quyền",
    description: "Cho phép tạo role động, sync permission ERP và phân quyền.",
    group: "Tổ chức",
  },
];

export type RoleAccessContext = {
  orgRole?: string | null;
  hasRole?: ((role: string) => boolean) | null;
  hasPermission?: ((permission: string) => boolean) | null;
};

const LEGACY_MEMBER_FULL_ACCESS = new Set<ErpPermissionKey>([
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
]);

export function canAccessClerkPermission(
  context: RoleAccessContext,
  permission: ErpPermissionKey,
  options?: { allowLegacyMember?: boolean },
) {
  if (!context.orgRole) {
    return permission !== ERP_PERMISSIONS.rolesManage;
  }

  if (context.hasRole?.("org:admin")) {
    return true;
  }

  if (context.hasPermission?.(permission)) {
    return true;
  }

  if (options?.allowLegacyMember !== false && context.orgRole === "org:member") {
    return LEGACY_MEMBER_FULL_ACCESS.has(permission);
  }

  return false;
}

export function getPermissionCatalogGroups() {
  const groups = new Map<string, PermissionCatalogItem[]>();

  for (const item of ERP_PERMISSION_CATALOG) {
    const entries = groups.get(item.group) ?? [];
    entries.push(item);
    groups.set(item.group, entries);
  }

  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}
