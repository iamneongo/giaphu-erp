"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const segmentLabels: Record<string, string> = {
  dashboard: "Bảng điều khiển",
  "giaphu-erp": "Công trình",
  overview: "Tổng quan",
  crm: "CRM công trình",
  materials: "Vật tư",
  workforce: "Nhân công",
  subcontractors: "Thầu phụ",
  catalogs: "Danh mục",
  documents: "Hồ sơ",
  reports: "Báo cáo",
  profile: "Hồ sơ tài khoản",
  workspaces: "Tổ chức",
  team: "Phân quyền",
  roles: "Vai trò & quyền",
  create: "Tạo vai trò",
  edit: "Sửa vai trò",
  billing: "Thanh toán tổ chức",
  projects: "Công trình",
  contracts: "Hợp đồng",
  payments: "Thu tiền",
  entries: "Phát sinh",
  norms: "Định mức",
  attendance: "Chấm công",
  staff: "Nhân sự",
  "labor-norms": "Định mức nhân công",
  progress: "Tiến độ",
  advances: "Tạm ứng",
  operations: "Vận hành",
  "hang-muc": "Hạng mục",
  "vat-tu": "Vật tư",
  "vat-tu-phu": "Vật tư phụ",
  "nha-cung-cap": "Nhà cung cấp",
  "thau-phu": "Thầu phụ",
};

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const visibleSegments = segments
    .map((segment, index) => ({
      href: `/${segments.slice(0, index + 1).join("/")}`,
      segment,
    }))
    .filter((item) => item.segment !== "dashboard");

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard/giaphu-erp/overview">Bảng điều khiển</BreadcrumbLink>
        </BreadcrumbItem>
        {visibleSegments.map(({ href, segment }, index) => {
          const isLast = index === visibleSegments.length - 1;

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.startsWith("role_") ? "Chi tiết vai trò" : (segmentLabels[segment] ?? segment)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{segment.startsWith("role_") ? "Chi tiết vai trò" : (segmentLabels[segment] ?? segment)}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
