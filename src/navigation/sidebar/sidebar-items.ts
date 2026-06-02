import {
  BookOpen,
  Building2,
  ChartBar,
  CircleDollarSign,
  FileText,
  Hammer,
  HardHat,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  PackagePlus,
  Printer,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { ERP_PERMISSIONS, type ErpPermissionKey } from "@/lib/clerk/erp-rbac-shared";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  permission?: ErpPermissionKey;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  permission?: ErpPermissionKey;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Tổng quan",
    items: [
      {
        title: "Tổng quan",
        url: "/dashboard/giaphu-erp/overview",
        icon: LayoutDashboard,
        permission: ERP_PERMISSIONS.overviewRead,
      },
      {
        title: "Báo cáo",
        url: "/dashboard/giaphu-erp/reports",
        icon: Printer,
        permission: ERP_PERMISSIONS.reportsRead,
      },
    ],
  },
  {
    id: 2,
    label: "Công trình",
    items: [
      {
        title: "CRM công trình",
        url: "/dashboard/giaphu-erp/crm",
        icon: ChartBar,
        subItems: [
          {
            title: "Công trình",
            url: "/dashboard/giaphu-erp/crm/projects",
            icon: ChartBar,
            permission: ERP_PERMISSIONS.crmRead,
          },
          {
            title: "Hợp đồng",
            url: "/dashboard/giaphu-erp/crm/contracts",
            icon: BookOpen,
            permission: ERP_PERMISSIONS.crmRead,
          },
          {
            title: "Thu tiền",
            url: "/dashboard/giaphu-erp/crm/payments",
            icon: Printer,
            permission: ERP_PERMISSIONS.crmRead,
          },
        ],
      },
      {
        title: "Vật tư",
        url: "/dashboard/giaphu-erp/materials/vat-tu-chinh",
        icon: PackagePlus,
        subItems: [
          {
            title: "Vật tư chính",
            url: "/dashboard/giaphu-erp/materials/vat-tu-chinh",
            icon: PackagePlus,
            permission: ERP_PERMISSIONS.materialsManage,
          },
          {
            title: "Vật tư phụ",
            url: "/dashboard/giaphu-erp/materials/vat-tu-phu",
            icon: PackagePlus,
            permission: ERP_PERMISSIONS.materialsManage,
          },
          {
            title: "Công nợ vật tư",
            url: "/dashboard/giaphu-erp/materials/debt",
            icon: CircleDollarSign,
            permission: ERP_PERMISSIONS.materialsRead,
          },
        ],
      },
      {
        title: "Nhân công",
        url: "/dashboard/giaphu-erp/workforce",
        icon: HardHat,
        subItems: [
          {
            title: "Chấm công",
            url: "/dashboard/giaphu-erp/workforce/attendance",
            icon: HardHat,
            permission: ERP_PERMISSIONS.workforceRead,
          },
          {
            title: "Nhân sự",
            url: "/dashboard/giaphu-erp/workforce/staff",
            icon: UsersRound,
            permission: ERP_PERMISSIONS.workforceRead,
          },
          {
            title: "Định mức",
            url: "/dashboard/giaphu-erp/workforce/labor-norms",
            icon: ListTree,
            permission: ERP_PERMISSIONS.workforceRead,
          },
          {
            title: "Tiến độ",
            url: "/dashboard/giaphu-erp/workforce/progress",
            icon: Printer,
            permission: ERP_PERMISSIONS.workforceRead,
          },
        ],
      },
      {
        title: "Thầu phụ",
        url: "/dashboard/giaphu-erp/subcontractors",
        icon: Hammer,
        subItems: [
          {
            title: "Tạm ứng",
            url: "/dashboard/giaphu-erp/subcontractors/advances",
            icon: Hammer,
            permission: ERP_PERMISSIONS.subcontractorsRead,
          },
          {
            title: "Hợp đồng",
            url: "/dashboard/giaphu-erp/subcontractors/contracts",
            icon: BookOpen,
            permission: ERP_PERMISSIONS.subcontractorsRead,
          },
          {
            title: "Vận hành",
            url: "/dashboard/giaphu-erp/subcontractors/operations",
            icon: Truck,
            permission: ERP_PERMISSIONS.subcontractorsRead,
          },
        ],
      },
      {
        title: "Hồ sơ",
        url: "/dashboard/giaphu-erp/documents",
        icon: FileText,
        permission: ERP_PERMISSIONS.documentsRead,
      },
    ],
  },
  {
    id: 3,
    label: "Thiết lập",
    items: [
      {
        title: "Danh mục",
        url: "/dashboard/giaphu-erp/catalogs",
        icon: BookOpen,
        subItems: [
          {
            title: "Hạng mục",
            url: "/dashboard/giaphu-erp/catalogs/hang-muc",
            icon: ListTree,
            permission: ERP_PERMISSIONS.catalogsRead,
          },
          {
            title: "Vật tư",
            url: "/dashboard/giaphu-erp/catalogs/vat-tu",
            icon: PackagePlus,
            permission: ERP_PERMISSIONS.catalogsRead,
          },
          {
            title: "Vật tư phụ",
            url: "/dashboard/giaphu-erp/catalogs/vat-tu-phu",
            icon: PackagePlus,
            permission: ERP_PERMISSIONS.catalogsRead,
          },
          {
            title: "Thầu phụ",
            url: "/dashboard/giaphu-erp/catalogs/thau-phu",
            icon: UsersRound,
            permission: ERP_PERMISSIONS.catalogsRead,
          },
          {
            title: "Nhà cung cấp",
            url: "/dashboard/giaphu-erp/catalogs/nha-cung-cap",
            icon: Truck,
            permission: ERP_PERMISSIONS.catalogsRead,
          },
        ],
      },
    ],
  },
  {
    id: 4,
    label: "Tài khoản",
    items: [
      {
        title: "Hồ sơ",
        url: "/dashboard/profile",
        icon: UserRound,
      },
      {
        title: "Tổ chức & thành viên",
        url: "/dashboard/workspaces",
        icon: Building2,
        permission: ERP_PERMISSIONS.organizationsManage,
        subItems: [
          {
            title: "Tổ chức",
            url: "/dashboard/workspaces",
            icon: Building2,
            permission: ERP_PERMISSIONS.organizationsManage,
          },
          {
            title: "Thành viên",
            url: "/dashboard/workspaces/team",
            icon: ShieldCheck,
            permission: ERP_PERMISSIONS.rolesManage,
          },
          {
            title: "Vai trò & quyền",
            url: "/dashboard/workspaces/roles",
            icon: ShieldCheck,
            permission: ERP_PERMISSIONS.rolesManage,
          },
        ],
      },
      {
        title: "Danh sách công trình",
        url: "/dashboard/giaphu-erp/crm/projects",
        icon: ChartBar,
      },
    ],
  },
];
