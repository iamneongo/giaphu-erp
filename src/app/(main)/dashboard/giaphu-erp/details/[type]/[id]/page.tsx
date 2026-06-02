import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";
import { getDocumentDetail, getGiaPhuDashboardData } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { erpPathForProject } from "@/lib/giaphu-erp/project-routes";

import { formatMoney } from "../../../_lib/formatters";

type DetailField = {
  key: string;
  label: string;
  value: unknown;
  wide?: boolean;
};

type DetailRecord = {
  title: string;
  subtitle: string;
  badge?: string;
  backHref: string;
  backLabel: string;
  fields: DetailField[];
  externalHref?: string;
  externalLabel?: string;
};

const detailPermissions = {
  projects: ERP_PERMISSIONS.crmRead,
  contracts: ERP_PERMISSIONS.crmRead,
  payments: ERP_PERMISSIONS.crmRead,
  materials: ERP_PERMISSIONS.materialsRead,
  staff: ERP_PERMISSIONS.workforceRead,
  attendance: ERP_PERMISSIONS.workforceRead,
  "labor-norms": ERP_PERMISSIONS.workforceRead,
  progress: ERP_PERMISSIONS.workforceRead,
  subcontractors: ERP_PERMISSIONS.subcontractorsRead,
  "subcontractor-contracts": ERP_PERMISSIONS.subcontractorsRead,
  operations: ERP_PERMISSIONS.subcontractorsRead,
  documents: ERP_PERMISSIONS.documentsRead,
  catalogs: ERP_PERMISSIONS.catalogsRead,
} as const;

type DetailType = keyof typeof detailPermissions;

function isDetailType(value: string): value is DetailType {
  return value in detailPermissions;
}

function numberId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function field(key: string, label: string, value: unknown, wide = false): DetailField {
  return { key, label, value, wide };
}

function formatDetailValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  return String(value);
}

export default async function DetailPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;

  if (!isDetailType(type)) notFound();

  await enforceErpRoutePermission(detailPermissions[type]);

  const cookieStore = await cookies();
  const activeProjectCode = cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value ?? "";
  const decodedId = decodeURIComponent(id);
  const data = await getGiaPhuDashboardData({ activeProjectCode });
  const record = type === "documents" ? await getDocumentRecord(decodedId) : getDashboardRecord(type, decodedId, data);

  if (!record) notFound();

  const backHref = activeProjectCode ? erpPathForProject(activeProjectCode, record.backHref) : record.backHref;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>
              <ArrowLeft />
              {record.backLabel}
            </Link>
          </Button>
          <div>
            <h1 className="font-semibold text-3xl tracking-tight">{record.title}</h1>
            <p className="text-muted-foreground text-sm">{record.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {record.badge ? <Badge variant="secondary">{record.badge}</Badge> : null}
          {record.externalHref ? (
            <Button asChild size="sm">
              <Link href={record.externalHref} rel="noreferrer" target="_blank">
                <ExternalLink />
                {record.externalLabel ?? "Mở"}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin chi tiết</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {record.fields.map((item) => (
              <div key={item.key} className={item.wide ? "md:col-span-2" : undefined}>
                <div className="text-muted-foreground text-xs">{item.label}</div>
                <div className="mt-1 whitespace-pre-wrap break-words font-medium text-sm">
                  {formatDetailValue(item.value)}
                </div>
                <Separator className="mt-3" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function getDocumentRecord(id: string): Promise<DetailRecord | null> {
  const row = await getDocumentDetail({ id });
  if (!row) return null;

  const fileName = String(row.file_name ?? "Hồ sơ");

  return {
    title: fileName,
    subtitle: "Hồ sơ công trình",
    badge: String(row.doc_type ?? "Hồ sơ"),
    backHref: "/dashboard/giaphu-erp/documents",
    backLabel: "Quay lại hồ sơ",
    externalHref: `/api/giaphu-erp/documents/${row.id}/file`,
    externalLabel: "Xem tệp",
    fields: [
      field("project_code", "Công trình", row.project_code),
      field("doc_type", "Loại hồ sơ", row.doc_type),
      field("file_name", "Tên file", row.file_name),
      field("mime_type", "Định dạng", row.mime_type),
      field("file_size", "Dung lượng", row.file_size),
      field("has_file", "Tệp đính kèm", row.has_file),
      field("created_at", "Ngày tạo", row.created_at),
      field("note", "Ghi chú", row.note, true),
      field("preview_text", "Trích yếu", row.preview_text, true),
    ],
  };
}

function getDashboardRecord(
  type: Exclude<DetailType, "documents">,
  id: string,
  data: Awaited<ReturnType<typeof getGiaPhuDashboardData>>,
): DetailRecord | null {
  switch (type) {
    case "projects": {
      const row = data.projects.find((item) => item.code === id);
      if (!row) return null;

      return {
        title: row.name || row.code,
        subtitle: "Công trình",
        badge: row.status,
        backHref: "/dashboard/giaphu-erp/crm/projects",
        backLabel: "Quay lại công trình",
        fields: [
          field("code", "Mã CT", row.code),
          field("name", "Tên công trình", row.name),
          field("owner", "Chủ đầu tư", row.owner),
          field("contact", "Liên hệ", row.contact),
          field("referrer", "Người giới thiệu", row.referrer),
          field("startDate", "Ngày bắt đầu", row.startDate),
          field("status", "Trạng thái", row.status),
          field("failureReason", "Lý do thất bại", row.failureReason, true),
        ],
      };
    }
    case "contracts": {
      const row = data.contracts.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.contractNo || `Hợp đồng #${row.id}`,
        subtitle: "Hợp đồng công trình",
        badge: formatMoney(row.value),
        backHref: "/dashboard/giaphu-erp/crm/contracts",
        backLabel: "Quay lại hợp đồng",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("contractNo", "Số hợp đồng", row.contractNo),
          field("value", "Giá trị", formatMoney(row.value)),
          field("signedDate", "Ngày ký", row.signedDate),
          field("note", "Ghi chú", row.note, true),
        ],
      };
    }
    case "payments": {
      const row = data.payments.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: `Phiếu thu #${row.id}`,
        subtitle: "Thu tiền công trình",
        badge: formatMoney(row.amount),
        backHref: "/dashboard/giaphu-erp/crm/payments",
        backLabel: "Quay lại thu tiền",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày thu", row.date),
          field("amount", "Số tiền", formatMoney(row.amount)),
          field("note", "Ghi chú", row.note, true),
        ],
      };
    }
    case "materials": {
      const row = data.materials.find((item) => item.id === numberId(id));
      if (!row) return null;
      const backHref =
        row.materialType === "VT Phụ" || row.materialType === "VT MEP-HVAC"
          ? "/dashboard/giaphu-erp/materials/vat-tu-phu"
          : "/dashboard/giaphu-erp/materials/vat-tu-chinh";

      return {
        title: row.materialName || `Vật tư #${row.id}`,
        subtitle: "Dòng nhập vật tư",
        badge: row.materialType,
        backHref,
        backLabel: "Quay lại phân rã Zalo",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày", row.date),
          field("week", "Tuần", row.week),
          field("shift", "Ca", row.shift),
          field("category", "Hạng mục", row.category),
          field("materialCode", "Mã vật tư", row.materialCode),
          field("materialName", "Tên vật tư", row.materialName),
          field("quantity", "Khối lượng", row.quantity),
          field("unit", "Đơn vị", row.unit),
          field("price", "Đơn giá", formatMoney(row.price)),
          field("total", "Thành tiền", formatMoney(row.quantity * row.price)),
          field("supplier", "Nhà cung cấp", row.supplier),
          field("paymentStatus", "TT thanh toán", row.paymentStatus),
          field("paymentInfo", "Thông tin TT", row.paymentInfo, true),
          field("debt", "Công nợ", row.debt),
          field("status", "Trạng thái", row.status),
        ],
      };
    }
    case "staff": {
      const row = data.staff.find((item) => item.id === id);
      if (!row) return null;

      return {
        title: row.name || row.id,
        subtitle: "Nhân sự",
        badge: row.resigned ? "Đã nghỉ việc" : "Đang làm",
        backHref: "/dashboard/giaphu-erp/workforce/staff",
        backLabel: "Quay lại nhân sự",
        fields: [
          field("id", "Mã NS", row.id),
          field("name", "Họ tên", row.name),
          field("team", "Đội", row.team),
          field("position", "Chức vụ", row.position),
          field("salaryDay", "Lương/ngày", formatMoney(row.salaryDay)),
          field("resigned", "Đã nghỉ việc", row.resigned),
          field("offDate", "Thời gian nghỉ", row.offDate),
        ],
      };
    }
    case "attendance": {
      const row = data.attendance.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.staffName || `Chấm công #${row.id}`,
        subtitle: "Chấm công nhân công",
        badge: row.week,
        backHref: "/dashboard/giaphu-erp/workforce/attendance",
        backLabel: "Quay lại chấm công",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày", row.date),
          field("week", "Tuần", row.week),
          field("shift", "Ca", row.shift),
          field("category", "Hạng mục", row.category),
          field("staffName", "Nhân sự", row.staffName),
          field("position", "Chức vụ", row.position),
          field("halfDaySalary", "Lương 1/2 ngày", formatMoney(row.halfDaySalary)),
          field("allowance", "Phụ cấp", formatMoney(row.allowance)),
          field("overtimeHours", "OT giờ", row.overtimeHours),
          field("overtimeAmount", "OT tiền", formatMoney(row.overtimeAmount)),
          field("coefficient", "Hệ số", row.coefficient),
          field("total", "Thành tiền", formatMoney(row.total)),
          field("status", "Trạng thái", row.status),
        ],
      };
    }
    case "labor-norms": {
      const row = data.laborNorms.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.category,
        subtitle: "Định mức nhân công",
        badge: formatMoney(row.cost),
        backHref: "/dashboard/giaphu-erp/workforce/labor-norms",
        backLabel: "Quay lại định mức nhân công",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("category", "Hạng mục", row.category),
          field("workdays", "Số công định mức", row.workdays),
          field("cost", "Chi phí định mức", formatMoney(row.cost)),
        ],
      };
    }
    case "progress": {
      const row = data.progress.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.category,
        subtitle: "Tiến độ hạng mục",
        badge: row.evaluation,
        backHref: "/dashboard/giaphu-erp/workforce/progress",
        backLabel: "Quay lại tiến độ",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("category", "Hạng mục", row.category),
          field("startDate", "Ngày bắt đầu", row.startDate),
          field("durationDays", "Số ngày", row.durationDays),
          field("workdays", "Số công", row.workdays),
          field("planEndDate", "Ngày HT dự kiến", row.planEndDate),
          field("confirmedEndDate", "Ngày HT xác nhận", row.confirmedEndDate),
          field("evaluation", "Đánh giá", row.evaluation, true),
        ],
      };
    }
    case "subcontractors": {
      const row = data.subcontractors.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.contractorName,
        subtitle: "Tạm ứng thầu phụ",
        badge: row.status,
        backHref: "/dashboard/giaphu-erp/subcontractors/advances",
        backLabel: "Quay lại tạm ứng",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày", row.date),
          field("week", "Tuần", row.week),
          field("category", "Hạng mục", row.category),
          field("contractorName", "Thầu phụ", row.contractorName),
          field("advance", "Tạm ứng", formatMoney(row.advance)),
          field("cumulative", "Lũy kế", formatMoney(row.cumulative)),
          field("status", "Trạng thái", row.status),
          field("note", "Ghi chú", row.note, true),
        ],
      };
    }
    case "subcontractor-contracts": {
      const row = data.subcontractorContracts.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.contractorName,
        subtitle: "Hợp đồng thầu phụ",
        badge: row.status,
        backHref: "/dashboard/giaphu-erp/subcontractors/contracts",
        backLabel: "Quay lại hợp đồng thầu phụ",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("contractorName", "Thầu phụ", row.contractorName),
          field("approvedCost", "Tổng chi phí dự kiến", formatMoney(row.approvedCost)),
          field("status", "Trạng thái", row.status),
          field("approvedBy", "Người duyệt", row.approvedBy),
          field("approvedAt", "Thời gian duyệt", row.approvedAt),
          field("note", "Ghi chú", row.note, true),
        ],
      };
    }
    case "operations": {
      const row = data.operations.find((item) => item.id === numberId(id));
      if (!row) return null;

      return {
        title: row.description || `Chi phí vận hành #${row.id}`,
        subtitle: "Chi phí vận hành",
        badge: formatMoney(row.amount),
        backHref: "/dashboard/giaphu-erp/subcontractors/operations",
        backLabel: "Quay lại vận hành",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày", row.date),
          field("week", "Tuần", row.week),
          field("description", "Nội dung", row.description, true),
          field("amount", "Số tiền", formatMoney(row.amount)),
        ],
      };
    }
    case "catalogs": {
      const row = Object.values(data.catalogs)
        .flat()
        .find((item) => item.id === id);
      if (!row) return null;

      return {
        title: row.name || row.code,
        subtitle: "Danh mục",
        badge: row.kind,
        backHref: `/dashboard/giaphu-erp/catalogs`,
        backLabel: "Quay lại danh mục",
        fields: [
          field("kind", "Loại danh mục", row.kind),
          field("code", "Mã", row.code),
          field("name", "Tên", row.name),
          field("unit", "Đơn vị", row.unit),
          field("contact", "Liên hệ", row.contact),
          field("note", "Ghi chú", row.note, true),
        ],
      };
    }
    default:
      return null;
  }
}
