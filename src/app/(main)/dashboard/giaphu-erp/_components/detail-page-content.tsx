import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, CalendarDays, ExternalLink, FileText, type WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";
import { getDocumentDetail, getGiaPhuDashboardData, getStaffDetailData } from "@/lib/giaphu-erp/db";
import { ACTIVE_PROJECT_COOKIE_NAME } from "@/lib/giaphu-erp/project-context";
import { decodeProjectRouteSegment, erpPathForProject } from "@/lib/giaphu-erp/project-routes";
import type { AttendanceRow, PayrollAdjustmentRow, StaffRow, StaffSkillEvaluationRow } from "@/lib/giaphu-erp/types";

import { DashboardLink } from "../../_components/dashboard-link";
import { formatDate, formatMeasurement, formatMoney } from "../_lib/formatters";
import { StaffDetailManager } from "./staff-detail-manager";

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

type StaffPayrollLine = {
  key: string;
  week: string;
  category: string;
  rows: number;
  workdays: number;
  baseSalary: number;
  allowance: number;
  overtimeHours: number;
  overtimeAmount: number;
  adjustment: number;
  total: number;
};

type StaffDetailInsights = {
  staff: StaffRow;
  projectName: string;
  attendanceRows: AttendanceRow[];
  payrollLines: StaffPayrollLine[];
  totals: {
    workdays: number;
    rows: number;
    baseSalary: number;
    allowance: number;
    overtimeHours: number;
    overtimeAmount: number;
    adjustment: number;
    total: number;
  };
  categoryCount: number;
  weekCount: number;
  skillEvaluations: StaffSkillEvaluationRow[];
};

type StaffDetailData = NonNullable<Awaited<ReturnType<typeof getStaffDetailData>>>;

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

export async function DetailPageContent({
  type,
  id,
  routeProjectId,
}: {
  type: string;
  id: string;
  routeProjectId?: string;
}) {
  if (!isDetailType(type)) notFound();

  await enforceErpRoutePermission(detailPermissions[type]);
  const session = await auth();
  const organizationId = session.orgId ?? "";

  const cookieStore = await cookies();
  const activeProjectCode = decodeProjectRouteSegment(
    routeProjectId ?? cookieStore.get(ACTIVE_PROJECT_COOKIE_NAME)?.value ?? "",
  );
  const decodedId = decodeURIComponent(id);
  const data = await getGiaPhuDashboardData({ activeProjectCode, organizationId });
  const activeProject = data.projects.find(
    (project) =>
      project.id === activeProjectCode || project.code === activeProjectCode || project.name === activeProjectCode,
  );
  const effectiveProjectCode = activeProject?.code ?? data.projects[0]?.code ?? activeProjectCode;
  const record =
    type === "documents"
      ? await getDocumentRecord(decodedId, organizationId)
      : getDashboardRecord(type, decodedId, data);

  if (!record) notFound();

  const backHref = activeProject ? erpPathForProject(activeProject.id, record.backHref) : record.backHref;
  const staffDetailData =
    type === "staff"
      ? await getStaffDetailData({ activeProjectCode: effectiveProjectCode, organizationId, staffId: decodedId })
      : null;
  const staffInsights =
    staffDetailData && type === "staff"
      ? buildStaffDetailInsights(staffDetailData, activeProject?.name || activeProject?.code || effectiveProjectCode)
      : null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button asChild variant="outline" size="sm">
            <DashboardLink href={backHref}>
              <ArrowLeft />
              {record.backLabel}
            </DashboardLink>
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
              <DashboardLink href={record.externalHref} rel="noreferrer" target="_blank">
                <ExternalLink />
                {record.externalLabel ?? "Mở"}
              </DashboardLink>
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

      {staffInsights ? (
        <>
          <StaffDetailManager staff={staffInsights.staff} skillEvaluations={staffInsights.skillEvaluations} />
          <StaffDetailSections insights={staffInsights} />
        </>
      ) : null}
    </div>
  );
}

function payrollKey(week: string, category: string, staffName: string) {
  return [week, category, staffName].join("::");
}

function buildStaffDetailInsights(detailData: StaffDetailData, projectName: string): StaffDetailInsights | null {
  const staff = detailData.staff;

  const attendanceRows = detailData.attendance
    .filter((row) => row.staffName === staff.name)
    .sort((first, second) => {
      const dateCompare = second.date.localeCompare(first.date);
      if (dateCompare !== 0) return dateCompare;
      return second.id - first.id;
    });
  const adjustmentMap = new Map(
    detailData.payrollAdjustments
      .filter((row) => row.staffName === staff.name)
      .map((row) => [payrollKey(row.week, row.category, row.staffName), row]),
  );
  const payrollMap = new Map<string, StaffPayrollLine>();

  for (const row of attendanceRows) {
    const key = payrollKey(row.week, row.category, row.staffName);
    const current = payrollMap.get(key) ?? {
      key,
      week: row.week,
      category: row.category,
      rows: 0,
      workdays: 0,
      baseSalary: 0,
      allowance: 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      adjustment: 0,
      total: 0,
    };
    const baseSalary = Math.max(
      0,
      Number(row.total || 0) - Number(row.allowance || 0) - Number(row.overtimeAmount || 0),
    );

    current.rows += 1;
    current.workdays += Number(row.coefficient || 0);
    current.baseSalary += baseSalary;
    current.allowance += Number(row.allowance || 0);
    current.overtimeHours += Number(row.overtimeHours || 0);
    current.overtimeAmount += Number(row.overtimeAmount || 0);
    current.total += Number(row.total || 0);
    payrollMap.set(key, current);
  }

  const payrollLines = Array.from(payrollMap.values())
    .map((line) => {
      const adjustment = adjustmentMap.get(payrollKey(line.week, line.category, staff.name))?.adjustment ?? 0;

      return {
        ...line,
        adjustment,
        total: line.total + adjustment,
      };
    })
    .sort((first, second) => {
      const weekCompare = second.week.localeCompare(first.week, "vi");
      if (weekCompare !== 0) return weekCompare;
      return first.category.localeCompare(second.category, "vi");
    });
  const totals = payrollLines.reduce(
    (sum, line) => ({
      workdays: sum.workdays + line.workdays,
      rows: sum.rows + line.rows,
      baseSalary: sum.baseSalary + line.baseSalary,
      allowance: sum.allowance + line.allowance,
      overtimeHours: sum.overtimeHours + line.overtimeHours,
      overtimeAmount: sum.overtimeAmount + line.overtimeAmount,
      adjustment: sum.adjustment + line.adjustment,
      total: sum.total + line.total,
    }),
    {
      workdays: 0,
      rows: 0,
      baseSalary: 0,
      allowance: 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      adjustment: 0,
      total: 0,
    },
  );

  return {
    staff,
    projectName,
    attendanceRows,
    payrollLines,
    totals,
    categoryCount: new Set(attendanceRows.map((row) => row.category).filter(Boolean)).size,
    weekCount: new Set(attendanceRows.map((row) => row.week).filter(Boolean)).size,
    skillEvaluations: detailData.skillEvaluations,
  };
}

function StaffDetailSections({ insights }: { insights: StaffDetailInsights }) {
  const recentAttendance = insights.attendanceRows.slice(0, 20);

  return (
    <>
      {/* Tạm ẩn theo yêu cầu
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StaffMetricCard
          title="Tổng thực nhận"
          value={formatMoney(insights.totals.total)}
          detail={insights.projectName}
          icon={WalletCards}
        />
        <StaffMetricCard
          title="Tổng công"
          value={`${formatDetailValue(insights.totals.workdays)} công`}
          detail={`${insights.totals.rows} dòng chấm công`}
          icon={CalendarDays}
        />
        <StaffMetricCard
          title="Phụ cấp + OT"
          value={formatMoney(insights.totals.allowance + insights.totals.overtimeAmount)}
          detail={`${formatDetailValue(insights.totals.overtimeHours)} giờ OT`}
          icon={FileText}
        />
        <StaffMetricCard
          title="Tuần / hạng mục"
          value={`${insights.weekCount} tuần`}
          detail={`${insights.categoryCount} hạng mục`}
          icon={CalendarDays}
        />
      </div>
      */}

      {/* Tạm ẩn theo yêu cầu
      <Card>
        <CardHeader>
          <CardTitle>Bảng lương theo tuần và hạng mục</CardTitle>
        </CardHeader>
        <CardContent>
          {insights.payrollLines.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tuần</TableHead>
                    <TableHead>Hạng mục</TableHead>
                    <TableHead className="text-right">Công</TableHead>
                    <TableHead className="text-right">Lương công</TableHead>
                    <TableHead className="text-right">Phụ cấp</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Điều chỉnh</TableHead>
                    <TableHead className="text-right">Thực nhận</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insights.payrollLines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell className="font-medium">{line.week}</TableCell>
                      <TableCell className="max-w-md truncate">{line.category || "-"}</TableCell>
                      <TableCell className="text-right">{formatDetailValue(line.workdays)}</TableCell>
                      <TableCell className="text-right">{formatMoney(line.baseSalary)}</TableCell>
                      <TableCell className="text-right">{formatMoney(line.allowance)}</TableCell>
                      <TableCell className="text-right">{formatMoney(line.overtimeAmount)}</TableCell>
                      <TableCell className="text-right">{formatMoney(line.adjustment)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatMoney(line.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold text-right">
                      Tổng cộng
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatDetailValue(insights.totals.workdays)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(insights.totals.baseSalary)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(insights.totals.allowance)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(insights.totals.overtimeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(insights.totals.adjustment)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(insights.totals.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              Chưa có dữ liệu chấm công cho nhân sự này trong công trình đang mở.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử chấm công gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAttendance.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Tuần</TableHead>
                    <TableHead>Ca</TableHead>
                    <TableHead>Hạng mục</TableHead>
                    <TableHead className="text-right">Hệ số</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAttendance.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                      <TableCell>{row.week}</TableCell>
                      <TableCell>{row.shift || row.status || "-"}</TableCell>
                      <TableCell className="max-w-md truncate">{row.category || "-"}</TableCell>
                      <TableCell className="text-right">{formatDetailValue(row.coefficient)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              Chưa có lịch sử chấm công.
            </div>
          )}
        </CardContent>
      </Card>
      */}
    </>
  );
}

function StaffMetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof WalletCards;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <div className="text-muted-foreground text-sm">{title}</div>
          <div className="mt-2 font-semibold text-2xl">{value}</div>
          <div className="mt-1 text-muted-foreground text-xs">{detail}</div>
        </div>
        <div className="rounded-full bg-muted p-2 text-muted-foreground">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

async function getDocumentRecord(id: string, organizationId: string): Promise<DetailRecord | null> {
  const row = await getDocumentDetail({ id, organizationId });
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
      const row = data.projects.find((item) => item.id === id || item.code === id || item.name === id);
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
          field("startDate", "Ngày bắt đầu", formatDate(row.startDate)),
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
        externalHref: row.hasFile ? `/api/giaphu-erp/documents/${row.fileId}/file` : undefined,
        externalLabel: "Mở hồ sơ",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("contractNo", "Số hợp đồng", row.contractNo),
          field("value", "Giá trị", formatMoney(row.value)),
          field("signedDate", "Ngày ký", formatDate(row.signedDate)),
          field("fileName", "Hồ sơ đính kèm", row.hasFile ? row.fileName : "-"),
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
        externalHref: row.hasFile ? `/api/giaphu-erp/documents/${row.fileId}/file` : undefined,
        externalLabel: "Mở chứng từ",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày thu", formatDate(row.date)),
          field("amount", "Số tiền", formatMoney(row.amount)),
          field("fileName", "Chứng từ đính kèm", row.hasFile ? row.fileName : "-"),
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
          field("date", "Ngày", formatDate(row.date)),
          field("week", "Tuần", row.week),
          field("shift", "Ca", row.shift),
          field("category", "Hạng mục", row.category),
          field("materialCode", "Mã vật tư", row.materialCode),
          field("materialName", "Tên vật tư", row.materialName),
          field("quantity", "Khối lượng", formatMeasurement(row.quantity, row.unit)),
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
          field("offDate", "Thời gian nghỉ", formatDate(row.offDate)),
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
          field("date", "Ngày", formatDate(row.date)),
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
          field("startDate", "Ngày bắt đầu", formatDate(row.startDate)),
          field("durationDays", "Số ngày", row.durationDays),
          field("workdays", "Số công", row.workdays),
          field("planEndDate", "Ngày HT dự kiến", formatDate(row.planEndDate)),
          field("confirmedEndDate", "Ngày HT xác nhận", formatDate(row.confirmedEndDate)),
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
          field("date", "Ngày", formatDate(row.date)),
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
        backHref: "/dashboard/giaphu-erp/operations",
        backLabel: "Quay lại vận hành",
        fields: [
          field("projectCode", "Công trình", row.projectCode),
          field("date", "Ngày", formatDate(row.date)),
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
        backHref: "/dashboard/giaphu-erp/catalogs",
        backLabel: "Quay lại danh mục",
        fields: [
          field("kind", "Loại danh mục", row.kind),
          field("code", "Mã", row.code),
          field("name", "Tên", row.name),
          field("unit", "Đơn vị", row.unit),
          field("supplier", "NCC", row.supplier),
          field("contact", "Liên hệ", row.contact),
          field("note", "Ghi chú", row.note, true),
        ],
      };
    }
    default:
      return null;
  }
}
