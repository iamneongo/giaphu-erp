import {
  BookOpen,
  Building2,
  ChartBar,
  CreditCard,
  FileText,
  Hammer,
  HardHat,
  LayoutDashboard,
  ListTree,
  type LucideIcon,
  PackagePlus,
  Printer,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
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
      },
      {
        title: "Báo cáo",
        url: "/dashboard/giaphu-erp/reports",
        icon: Printer,
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
      },
      {
        title: "Vật tư",
        url: "/dashboard/giaphu-erp/materials",
        icon: PackagePlus,
      },
      {
        title: "Nhân công",
        url: "/dashboard/giaphu-erp/workforce",
        icon: HardHat,
      },
      {
        title: "Thầu phụ",
        url: "/dashboard/giaphu-erp/subcontractors",
        icon: Hammer,
      },
      {
        title: "Hồ sơ",
        url: "/dashboard/giaphu-erp/documents",
        icon: FileText,
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
          },
          {
            title: "Vật tư",
            url: "/dashboard/giaphu-erp/catalogs/vat-tu",
            icon: PackagePlus,
          },
          {
            title: "Vật tư phụ",
            url: "/dashboard/giaphu-erp/catalogs/vat-tu-phu",
            icon: PackagePlus,
          },
          {
            title: "Thầu phụ",
            url: "/dashboard/giaphu-erp/catalogs/thau-phu",
            icon: UsersRound,
          },
          {
            title: "Nhà cung cấp",
            url: "/dashboard/giaphu-erp/catalogs/nha-cung-cap",
            icon: Truck,
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
        title: "Không gian làm việc",
        url: "/dashboard/workspaces",
        icon: Building2,
      },
      {
        title: "Đội nhóm",
        url: "/dashboard/workspaces/team",
        icon: UsersRound,
      },
      {
        title: "Thanh toán",
        url: "/dashboard/billing",
        icon: CreditCard,
      },
    ],
  },
];
