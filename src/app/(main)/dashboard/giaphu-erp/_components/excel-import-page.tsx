"use client";

import { FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isValidPhoneNumber } from "@/lib/giaphu-erp/phone";
import { erpPathForProject } from "@/lib/giaphu-erp/project-routes";
import type { MaterialType } from "@/lib/giaphu-erp/types";

import { DashboardLink } from "../../_components/dashboard-link";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { type CatalogKind, getCatalogSectionByKind } from "../_lib/catalog-config";
import { currentIsoWeek, isoWeekFromDate, todayIso } from "../_lib/date-utils";
import { type ExcelImportField, ExcelImportPanel } from "./excel-import-dialog";

type ImportTarget =
  | "catalogs"
  | "contracts"
  | "labor-norms"
  | "materials"
  | "operations"
  | "payments"
  | "progress"
  | "projects"
  | "staff"
  | "subcontractor-contracts"
  | "subcontractors";

type ImportPageConfig = {
  title: string;
  description?: string;
  action: string;
  fields: ExcelImportField[];
  backHref: string;
};

const materialBackHref: Record<MaterialType, string> = {
  "VT Chính": "/dashboard/giaphu-erp/materials/vat-tu-chinh",
  "VT MEP": "/dashboard/giaphu-erp/materials/vat-tu-mep-hvac",
  "VT MEP-HVAC": "/dashboard/giaphu-erp/materials/vat-tu-mep-hvac",
  "VT Phụ": "/dashboard/giaphu-erp/materials/vat-tu-phu",
};

function normalizeBooleanForImport(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "co", "có", "x", "da", "đã"].includes(text);
}

function dateTimeFromInput(value: unknown) {
  const dateText = String(value ?? "").slice(0, 10);
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function validateProgressStartDate(value: unknown, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(value);
  const planEndDate = dateTimeFromInput(payload.planEndDate);
  const confirmedEndDate = dateTimeFromInput(payload.confirmedEndDate);

  if (!startDate) return "Ngày bắt đầu không hợp lệ.";
  if (planEndDate && planEndDate < startDate) return "Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.";
  if (confirmedEndDate && confirmedEndDate < startDate) return "Ngày HT xác nhận không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateProgressPlanEndDate(value: unknown, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(payload.startDate);
  const planEndDate = dateTimeFromInput(value);

  if (!planEndDate) return "Ngày HT dự kiến không hợp lệ.";
  if (startDate && planEndDate < startDate) return "Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateProgressConfirmedEndDate(value: unknown, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(payload.startDate);
  const planEndDate = dateTimeFromInput(payload.planEndDate);
  const confirmedEndDate = dateTimeFromInput(value);

  if (!confirmedEndDate) return "Ngày HT xác nhận không hợp lệ.";
  if (planEndDate && confirmedEndDate < planEndDate) {
    return "Ngày HT xác nhận không được nhỏ hơn ngày HT dự kiến.";
  }
  if (startDate && confirmedEndDate < startDate) return "Ngày HT xác nhận không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function buildImportConfig(target: ImportTarget, query: Record<string, string>, activeProjectCode: string) {
  if (target === "projects") {
    return {
      title: "Import công trình từ Excel",
      action: "saveProject",
      backHref: "/dashboard/giaphu-erp/crm/projects",
      fields: [
        { key: "code", label: "Mã công trình", aliases: ["Mã CT", "Ma CT", "Code"], required: true },
        { key: "name", label: "Tên công trình", aliases: ["Tên CT", "Ten CT"], required: true },
        { key: "owner", label: "Chủ đầu tư", aliases: ["Chu dau tu", "Khách hàng"] },
        { key: "contact", label: "Liên hệ", aliases: ["Lien he", "SĐT", "Phone"] },
        { key: "referrer", label: "Người giới thiệu", aliases: ["Nguoi gioi thieu", "Nguồn"] },
        { key: "startDate", label: "Ngày bắt đầu", aliases: ["Ngay bat dau"], type: "date" },
        { key: "status", label: "Trạng thái", aliases: ["Trang thai"], defaultValue: "Đang thi công" },
        { key: "failureReason", label: "Lý do thất bại", aliases: ["Ly do that bai", "Ghi chú"] },
        { key: "pin", label: "Mã PIN", aliases: ["PIN", "Ma PIN", "Project PIN"] },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "contracts") {
    return {
      title: "Import hợp đồng từ Excel",
      action: "saveContract",
      backHref: "/dashboard/giaphu-erp/crm/contracts",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "contractNo", label: "Số hợp đồng", aliases: ["So HD", "Số HĐ"], required: true },
        { key: "value", label: "Giá trị", aliases: ["Gia tri", "Giá trị HĐ"], type: "number" },
        { key: "signedDate", label: "Ngày ký", aliases: ["Ngay ky"], type: "date", defaultValue: todayIso() },
        { key: "note", label: "Ghi chú", aliases: ["Ghi chu", "Diễn giải"] },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "payments") {
    return {
      title: "Import thu tiền từ Excel",
      action: "savePayment",
      backHref: "/dashboard/giaphu-erp/crm/payments",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        {
          key: "date",
          label: "Ngày thu",
          aliases: ["Ngày", "Ngay thu", "Ngay"],
          type: "date",
          defaultValue: todayIso(),
        },
        { key: "amount", label: "Số tiền", aliases: ["So tien", "Đã thu", "Da thu"], type: "number", required: true },
        { key: "note", label: "Ghi chú", aliases: ["Ghi chu", "Diễn giải"] },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "catalogs") {
    const kind = (query.kind || "hangMuc") as CatalogKind;
    const section = getCatalogSectionByKind(kind);
    const fields: ExcelImportField[] = [
      { key: "kind", label: "Loại", hidden: true, defaultValue: section.kind },
      ...(kind === "hangMuc"
        ? [{ key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode }]
        : []),
      { key: "code", label: section.codeLabel, aliases: ["Mã", "Ma", "Code"] },
      { key: "name", label: section.nameLabel, aliases: ["Tên", "Ten", "Name"], required: true },
    ];

    if (section.showUnit) {
      fields.push({ key: "unit", label: "Đơn vị", aliases: ["Don vi", "ĐV"], required: true });
    }

    if (section.showSupplier) {
      fields.push({
        key: "supplier",
        label: "NCC",
        aliases: ["Nhà CC", "Nhà cung cấp", "Nha cung cap"],
        required: true,
      });
    }

    if (section.showContact) {
      fields.push({
        key: "contact",
        label: "Liên hệ",
        aliases: ["Lien he", "SĐT", "Phone"],
        required: true,
        validate: (value) => {
          const contact = String(value ?? "").trim();
          return !contact || isValidPhoneNumber(contact) ? undefined : "Liên hệ phải là số điện thoại hợp lệ.";
        },
      });
    }

    fields.push({ key: "note", label: section.noteLabel, aliases: ["Ghi chú", "Ghi chu"] });

    return {
      title: `Import ${section.navigationTitle.toLowerCase()} từ Excel`,
      action: "manageCatalog",
      backHref: `/dashboard/giaphu-erp/catalogs/${section.slug}`,
      fields,
    } satisfies ImportPageConfig;
  }

  if (target === "materials") {
    const materialType = (query.materialType || "VT Chính") as MaterialType;
    return {
      title: `Import ${materialType} từ Excel`,
      action: "saveMaterial",
      backHref: materialBackHref[materialType] ?? "/dashboard/giaphu-erp/materials/vat-tu-chinh",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "materialType", label: "Loại", hidden: true, defaultValue: materialType },
        { key: "status", label: "Trạng thái", hidden: true, defaultValue: "Import Excel" },
        { key: "date", label: "Ngày", aliases: ["Ngay"], type: "date", defaultValue: todayIso() },
        {
          key: "week",
          label: "Tuần",
          aliases: ["Tuan"],
          defaultValue: (payload: Record<string, unknown>) =>
            isoWeekFromDate(String(payload.date ?? "")) || currentIsoWeek(),
        },
        { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
        { key: "materialName", label: "Vật tư", aliases: ["Vat tu", "Tên vật tư", "Ten vat tu"], required: true },
        { key: "supplier", label: "NCC", aliases: ["Nhà CC", "Nhà cung cấp", "Nha cung cap"] },
        { key: "quantity", label: "SL", aliases: ["Số lượng", "So luong"], type: "number", required: true },
        { key: "unit", label: "ĐV", aliases: ["Đơn vị", "Don vi"], required: true },
        { key: "price", label: "Đơn giá", aliases: ["Don gia"], type: "number", defaultValue: 0 },
        {
          key: "debt",
          label: "Nợ?",
          aliases: ["Nợ", "No", "Công nợ"],
          defaultValue: "Không",
          transform: (value) => (normalizeBooleanForImport(value) ? "Có" : String(value || "Không")),
        },
        {
          key: "paymentStatus",
          label: "TT",
          aliases: ["Thanh toán", "Thanh toan"],
          defaultValue: (payload: Record<string, unknown>) => (payload.debt === "Có" ? "Chưa TT" : "Đã TT"),
        },
        { key: "paymentInfo", label: "Ghi chú thanh toán", aliases: ["Ghi chú", "Ghi chu"] },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "staff") {
    return {
      title: "Import nhân sự từ Excel",
      action: "manageStaff",
      backHref: "/dashboard/giaphu-erp/workforce/staff",
      fields: [
        { key: "id", label: "Mã NS", aliases: ["Ma NS", "Mã", "Code"] },
        { key: "name", label: "Họ tên", aliases: ["Ho ten", "Tên nhân sự", "Tên"], required: true },
        { key: "team", label: "Đội", aliases: ["Doi", "Tổ đội"] },
        { key: "position", label: "Chức vụ", aliases: ["Chuc vu", "Vai trò"] },
        { key: "salaryDay", label: "Lương/ngày", aliases: ["Luong ngay", "Lương"], type: "number" },
        { key: "resigned", label: "Đã nghỉ việc", aliases: ["Nghỉ việc", "Da nghi viec"], type: "boolean" },
        { key: "offDate", label: "Thời gian nghỉ", aliases: ["Ngay nghỉ", "Ngay nghi"], type: "date" },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "labor-norms") {
    return {
      title: "Import định mức nhân công từ Excel",
      action: "saveLaborNorm",
      backHref: "/dashboard/giaphu-erp/workforce/labor-norms",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
        {
          key: "workdays",
          label: "Số công định mức",
          aliases: ["Số công ĐM", "So cong"],
          type: "number",
          required: true,
        },
        { key: "cost", label: "Chi phí định mức", aliases: ["Chi phí ĐM", "Chi phi"], type: "number", required: true },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "progress") {
    return {
      title: "Import tiến độ hạng mục từ Excel",
      action: "saveProgress",
      backHref: "/dashboard/giaphu-erp/workforce/progress",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
        {
          key: "startDate",
          label: "Ngày bắt đầu",
          aliases: ["Ngay bat dau"],
          type: "date",
          required: true,
          validate: validateProgressStartDate,
        },
        { key: "durationDays", label: "Số ngày", aliases: ["So ngay"], type: "number", required: true },
        { key: "workdays", label: "Số công", aliases: ["So cong"], type: "number", required: true },
        {
          key: "planEndDate",
          label: "Ngày HT dự kiến",
          aliases: ["HT dự kiến"],
          type: "date",
          required: true,
          validate: validateProgressPlanEndDate,
        },
        {
          key: "confirmedEndDate",
          label: "Ngày HT xác nhận",
          aliases: ["HT xác nhận"],
          type: "date",
          required: true,
          validate: validateProgressConfirmedEndDate,
        },
        { key: "evaluation", label: "Đánh giá", aliases: ["Danh gia"], defaultValue: "Đang theo dõi" },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "subcontractors") {
    return {
      title: "Import tạm ứng thầu phụ từ Excel",
      action: "saveSubcontractor",
      backHref: "/dashboard/giaphu-erp/subcontractors/advances",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "date", label: "Ngày", aliases: ["Ngay"], type: "date", defaultValue: todayIso() },
        { key: "week", label: "Tuần", aliases: ["Tuan"], defaultValue: currentIsoWeek() },
        { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
        { key: "contractorName", label: "Thầu phụ", aliases: ["Thau phu", "Nhà thầu"], required: true },
        { key: "advance", label: "Tạm ứng", aliases: ["Tam ung", "Số tiền"], type: "number", required: true },
        { key: "note", label: "Diễn giải", aliases: ["Ghi chú", "Ghi chu"] },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "subcontractor-contracts") {
    return {
      title: "Import hợp đồng thầu phụ từ Excel",
      action: "saveSubcontractorContract",
      backHref: "/dashboard/giaphu-erp/subcontractors/contracts",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "contractorName", label: "Thầu phụ", aliases: ["Thau phu", "Nhà thầu"], required: true },
        {
          key: "approvedCost",
          label: "Tổng chi phí dự kiến",
          aliases: ["Chi phí", "Chi phi", "Dự kiến"],
          type: "number",
        },
        { key: "status", label: "Trạng thái", aliases: ["Trang thai"], defaultValue: "Chờ duyệt" },
        { key: "note", label: "Ghi chú", aliases: ["Ghi chu"] },
      ],
    } satisfies ImportPageConfig;
  }

  if (target === "operations") {
    return {
      title: "Import chi phí vận hành từ Excel",
      action: "saveOperation",
      backHref: "/dashboard/giaphu-erp/operations",
      fields: [
        { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
        { key: "date", label: "Ngày", aliases: ["Ngay"], type: "date", defaultValue: todayIso() },
        { key: "week", label: "Tuần", aliases: ["Tuan"], defaultValue: currentIsoWeek() },
        { key: "description", label: "Diễn giải", aliases: ["Ghi chú", "Ghi chu", "Nội dung"], required: true },
        { key: "amount", label: "Số tiền", aliases: ["So tien", "Chi phí", "Chi phi"], type: "number", required: true },
      ],
    } satisfies ImportPageConfig;
  }

  return null;
}

export function ExcelImportPage({
  target,
  query,
  routeProjectId,
}: {
  target: string;
  query: Record<string, string>;
  routeProjectId?: string;
}) {
  const { activeProjectCode, runAction } = useGiaPhuErp();
  const config = buildImportConfig(target as ImportTarget, query, activeProjectCode);

  if (!config) {
    return (
      <div className="flex min-h-[48vh] flex-col items-center justify-center gap-4 text-center">
        <FileSpreadsheet className="size-8 text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">Không tìm thấy loại import</h1>
          <p className="text-muted-foreground text-sm">Trang import này không tồn tại hoặc đã được di chuyển.</p>
        </div>
        <Button asChild>
          <DashboardLink href="/dashboard/giaphu-erp/overview">Quay về tổng quan</DashboardLink>
        </Button>
      </div>
    );
  }

  const scopedConfig = routeProjectId
    ? { ...config, backHref: erpPathForProject(routeProjectId, config.backHref) }
    : config;

  return <ExcelImportPanel {...scopedConfig} onAction={runAction} />;
}
