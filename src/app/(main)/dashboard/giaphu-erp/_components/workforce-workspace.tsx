"use client";

import { useAuth } from "@clerk/nextjs";
import { CalendarCheck, ClipboardList, HardHat, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, isoWeekFromDate, todayIso } from "../_lib/date-utils";
import { catalogOptions, shiftOptions, staffOptions, uniqueOptions } from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type WorkforceSection = "attendance" | "staff" | "laborNorms" | "progress";

function dateTimeFromInput(value: unknown) {
  const dateText = String(value ?? "").slice(0, 10);
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function validateProgressStartDate(value: string, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(value);
  const today = dateTimeFromInput(todayIso());
  const planEndDate = dateTimeFromInput(payload.planEndDate);
  const confirmedEndDate = dateTimeFromInput(payload.confirmedEndDate);

  if (!startDate) return "Ngày bắt đầu không hợp lệ.";
  if (today && startDate < today) return "Ngày bắt đầu không được nhỏ hơn ngày hiện tại.";
  if (planEndDate && planEndDate < startDate) return "Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.";
  if (confirmedEndDate && confirmedEndDate < startDate) return "Ngày HT xác nhận không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateProgressPlanEndDate(value: string, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(payload.startDate);
  const planEndDate = dateTimeFromInput(value);

  if (!planEndDate) return "Ngày HT dự kiến không hợp lệ.";
  if (startDate && planEndDate < startDate) return "Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateProgressConfirmedEndDate(value: string, payload: Record<string, unknown>) {
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

function validateAttendanceDate(value: string) {
  const attendanceDate = dateTimeFromInput(value);
  const today = dateTimeFromInput(todayIso());

  if (!attendanceDate) return "Ngày chấm công không hợp lệ.";
  if (today && attendanceDate < today) return "Ngày chấm công không được nhỏ hơn ngày hiện tại.";

  return undefined;
}

function deriveAttendanceWeek(payload: Record<string, unknown>) {
  return isoWeekFromDate(String(payload.date ?? ""));
}

function validateStaffOffDate(value: string, payload: Record<string, unknown>) {
  if (payload.resigned === true && !value) {
    return "Vui lòng chọn thời gian nghỉ khi đánh dấu nhân sự đã nghỉ việc.";
  }

  return undefined;
}

export function WorkforceWorkspace({ section = "attendance" }: { section?: WorkforceSection }) {
  const { data, activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const workerOptions = staffOptions(data.staff);
  const attendanceWeekOptions = uniqueOptions(scoped.attendance.map((row) => row.week));
  const attendanceCategoryOptions = uniqueOptions(scoped.attendance.map((row) => row.category));
  const attendanceShiftOptions = uniqueOptions(scoped.attendance.map((row) => row.shift));
  const attendanceStaffOptions = uniqueOptions(scoped.attendance.map((row) => row.staffName));
  const staffTeamOptions = uniqueOptions(data.staff.map((row) => row.team));
  const staffPositionOptions = uniqueOptions(data.staff.map((row) => row.position));
  const laborNormCategoryOptions = uniqueOptions(scoped.laborNorms.map((row) => row.category));
  const progressCategoryOptions = uniqueOptions(scoped.progress.map((row) => row.category));
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.workforceManage,
  );

  const actions = {
    attendance: (
      <>
        <ActionDialog
          title="Chấm công"
          button="Chấm công"
          icon={CalendarCheck}
          action="saveWeeklyAttendance"
          onAction={runAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            {
              name: "date",
              label: "Ngày",
              type: "date",
              value: todayIso(),
              required: true,
              validate: validateAttendanceDate,
            },
            {
              name: "week",
              label: "Tuần",
              value: currentIsoWeek(),
              required: true,
              readOnly: true,
              deriveValue: deriveAttendanceWeek,
            },
            { name: "shift", label: "Ca", type: "select", options: shiftOptions, required: true },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "staffName", label: "Nhân sự", type: "select", options: workerOptions, required: true },
            { name: "position", label: "Chức vụ", required: true },
            { name: "halfDaySalary", label: "Lương 1/2 ngày", type: "number", required: true },
            { name: "allowance", label: "Phụ cấp", type: "number", value: 0, required: true },
            { name: "overtimeHours", label: "OT giờ", type: "number", value: 0, required: true },
            { name: "overtimeAmount", label: "OT tiền", type: "number", value: 0, required: true },
            { name: "coefficient", label: "Hệ số", type: "number", value: 1, required: true },
            { name: "status", label: "Trạng thái", value: "Đã ghi", required: true },
          ]}
        />
        <ActionDialog
          title="Kết sổ chấm công"
          button="Kết sổ"
          icon={ShieldCheck}
          action="closeAttendance"
          onAction={runAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "week", label: "Tuần", value: currentIsoWeek(), required: true },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "by", label: "Người kết sổ", value: "Admin" },
            { name: "note", label: "Ghi chú", type: "textarea" },
          ]}
        />
        <ActionDialog
          title="Mở kết sổ"
          button="Mở khóa"
          icon={RefreshCw}
          action="reopenAttendance"
          onAction={runAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "week", label: "Tuần", value: currentIsoWeek(), required: true },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "by", label: "Người mở", value: "Admin" },
            { name: "note", label: "Ghi chú", type: "textarea" },
          ]}
        />
      </>
    ),
    staff: (
      <ActionDialog
        title="Nhân sự"
        button="Nhân sự"
        icon={Users}
        action="manageStaff"
        onAction={runAction}
        fields={[
          { name: "id", label: "Mã NS" },
          { name: "name", label: "Họ tên", required: true },
          { name: "team", label: "Đội" },
          { name: "position", label: "Chức vụ" },
          { name: "salaryDay", label: "Lương/ngày", type: "number" },
          { name: "offDate", label: "Thời gian nghỉ", type: "date", validate: validateStaffOffDate },
          { name: "resigned", label: "Đã nghỉ việc", type: "checkbox" },
        ]}
      />
    ),
    laborNorms: (
      <ActionDialog
        title="Định mức nhân công"
        button="Định mức"
        icon={ClipboardList}
        action="saveLaborNorm"
        onAction={runAction}
        fields={[
          { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
          { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
          { name: "workdays", label: "Số công định mức", type: "number", required: true },
          { name: "cost", label: "Chi phí định mức", type: "number", required: true },
        ]}
      />
    ),
    progress: (
      <ActionDialog
        title="Tiến độ hạng mục"
        button="Tiến độ"
        icon={CalendarCheck}
        action="saveProgress"
        onAction={runAction}
        fields={[
          { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
          { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
          {
            name: "startDate",
            label: "Ngày bắt đầu",
            type: "date",
            value: todayIso(),
            required: true,
            validate: validateProgressStartDate,
          },
          { name: "durationDays", label: "Số ngày", type: "number", required: true },
          { name: "workdays", label: "Số công", type: "number", required: true },
          {
            name: "planEndDate",
            label: "Ngày HT dự kiến",
            type: "date",
            required: true,
            validate: validateProgressPlanEndDate,
          },
          {
            name: "confirmedEndDate",
            label: "Ngày HT xác nhận",
            type: "date",
            required: true,
            validate: validateProgressConfirmedEndDate,
          },
          { name: "evaluation", label: "Đánh giá", value: "Đang theo dõi" },
        ]}
      />
    ),
  } satisfies Record<WorkforceSection, React.ReactNode>;

  const sections = {
    attendance: {
      title: "Chấm công nhân công",
      description: "Ghi nhận chấm công theo tuần, hạng mục và thực hiện khóa hoặc mở kết sổ khi cần.",
      content: (
        <SectionBlock title="Lịch sử chấm công">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
              { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
              { key: "shift", label: "Ca", accessor: (row) => row.shift, render: (row) => row.shift || "-" },
              {
                key: "category",
                label: "Hạng mục",
                accessor: (row) => row.category,
                render: (row) => row.category || "-",
              },
              {
                key: "staffName",
                label: "Nhân sự",
                accessor: (row) => row.staffName,
                render: (row) => (
                  <div>
                    <div className="font-medium">{row.staffName || "-"}</div>
                    <div className="text-muted-foreground text-xs">{row.position || "-"}</div>
                  </div>
                ),
              },
              {
                key: "coefficient",
                label: "Hệ số",
                accessor: (row) => row.coefficient,
                render: (row) => formatCount(row.coefficient),
              },
              {
                key: "allowance",
                label: "Phụ cấp",
                accessor: (row) => row.allowance,
                render: (row) => formatMoney(row.allowance),
              },
              {
                key: "overtimeAmount",
                label: "OT",
                accessor: (row) => row.overtimeAmount,
                render: (row) => formatMoney(row.overtimeAmount),
              },
              {
                key: "total",
                label: "Thành tiền",
                accessor: (row) => row.total,
                render: (row) => formatMoney(row.total),
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.attendance)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa chấm công",
                              action: "saveWeeklyAttendance",
                              onAction: runAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "date",
                                  label: "Ngày",
                                  type: "date",
                                  value: row.date || todayIso(),
                                  required: true,
                                  validate: validateAttendanceDate,
                                },
                                {
                                  name: "week",
                                  label: "Tuần",
                                  value: row.week,
                                  required: true,
                                  readOnly: true,
                                  deriveValue: deriveAttendanceWeek,
                                },
                                {
                                  name: "shift",
                                  label: "Ca",
                                  type: "select",
                                  options: shiftOptions,
                                  value: row.shift,
                                  required: true,
                                },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: categoryOptions,
                                  value: row.category,
                                  required: true,
                                },
                                {
                                  name: "staffName",
                                  label: "Nhân sự",
                                  type: "select",
                                  options: workerOptions,
                                  value: row.staffName,
                                  required: true,
                                },
                                { name: "position", label: "Chức vụ", value: row.position, required: true },
                                {
                                  name: "halfDaySalary",
                                  label: "Lương 1/2 ngày",
                                  type: "number",
                                  value: row.halfDaySalary,
                                  required: true,
                                },
                                {
                                  name: "allowance",
                                  label: "Phụ cấp",
                                  type: "number",
                                  value: row.allowance,
                                  required: true,
                                },
                                {
                                  name: "overtimeHours",
                                  label: "OT giờ",
                                  type: "number",
                                  value: row.overtimeHours,
                                  required: true,
                                },
                                {
                                  name: "overtimeAmount",
                                  label: "OT tiền",
                                  type: "number",
                                  value: row.overtimeAmount,
                                  required: true,
                                },
                                {
                                  name: "coefficient",
                                  label: "Hệ số",
                                  type: "number",
                                  value: row.coefficient,
                                  required: true,
                                },
                                { name: "status", label: "Trạng thái", value: row.status, required: true },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa chấm công của "${row.staffName}"?`)) {
                                    return runAction("deleteAttendanceRow", { id: row.id });
                                  }
                                },
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={scoped.attendance}
            getRowId={(row) => row.id}
            selectable
            exportFileName="nhan-cong-cham-cong"
            searchPlaceholder="Tìm nhân sự, hạng mục, ca..."
            filters={[
              { key: "week", label: "Tuần", options: attendanceWeekOptions },
              { key: "shift", label: "Ca", options: attendanceShiftOptions },
              { key: "category", label: "Hạng mục", options: attendanceCategoryOptions },
              { key: "staffName", label: "Nhân sự", options: attendanceStaffOptions },
            ]}
            initialSorting={[{ id: "date", desc: true }]}
          />
        </SectionBlock>
      ),
    },
    staff: {
      title: "Nhân sự",
      description: "Quản lý danh sách nhân sự dùng chung cho ERP, đội nhóm, mức lương và trạng thái nghỉ việc.",
      content: (
        <SectionBlock title="Danh sách nhân sự">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "id", label: "Mã", accessor: (row) => row.id, render: (row) => row.id },
              { key: "name", label: "Họ tên", accessor: (row) => row.name, render: (row) => row.name },
              { key: "team", label: "Đội", accessor: (row) => row.team, render: (row) => row.team || "-" },
              {
                key: "position",
                label: "Chức vụ",
                accessor: (row) => row.position,
                render: (row) => row.position || "-",
              },
              {
                key: "salaryDay",
                label: "Lương/ngày",
                accessor: (row) => row.salaryDay,
                render: (row) => formatMoney(row.salaryDay),
              },
              {
                key: "resigned",
                label: "Trạng thái",
                accessor: (row) => (row.resigned ? "Đã nghỉ việc" : "Đang làm"),
                render: (row) =>
                  row.resigned ? (
                    <Badge variant="secondary">Đã nghỉ việc{row.offDate ? ` · ${row.offDate}` : ""}</Badge>
                  ) : (
                    <Badge variant="outline">Đang làm</Badge>
                  ),
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof data.staff)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa nhân sự",
                              action: "manageStaff",
                              onAction: runAction,
                              fields: [
                                { name: "id", label: "Mã NS", value: row.id, readOnly: true },
                                { name: "name", label: "Họ tên", required: true, value: row.name },
                                { name: "team", label: "Đội", value: row.team },
                                { name: "position", label: "Chức vụ", value: row.position },
                                { name: "salaryDay", label: "Lương/ngày", type: "number", value: row.salaryDay },
                                {
                                  name: "offDate",
                                  label: "Thời gian nghỉ",
                                  type: "date",
                                  value: row.offDate,
                                  validate: validateStaffOffDate,
                                },
                                { name: "resigned", label: "Đã nghỉ việc", type: "checkbox", value: row.resigned },
                              ],
                            }}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={data.staff}
            getRowId={(row) => row.id}
            selectable
            exportFileName="nhan-su"
            searchPlaceholder="Tìm theo mã, tên, đội..."
            filters={[
              { key: "team", label: "Đội", options: staffTeamOptions },
              { key: "position", label: "Chức vụ", options: staffPositionOptions },
            ]}
          />
        </SectionBlock>
      ),
    },
    laborNorms: {
      title: "Định mức nhân công",
      description: "Thiết lập số công và chi phí định mức theo từng hạng mục của công trình đang chọn.",
      content: (
        <SectionBlock title="Định mức nhân công">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
              {
                key: "workdays",
                label: "Số công ĐM",
                accessor: (row) => row.workdays,
                render: (row) => formatCount(row.workdays),
              },
              { key: "cost", label: "Chi phí ĐM", accessor: (row) => row.cost, render: (row) => formatMoney(row.cost) },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.laborNorms)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa định mức nhân công",
                              action: "saveLaborNorm",
                              onAction: runAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: categoryOptions,
                                  value: row.category,
                                  required: true,
                                },
                                {
                                  name: "workdays",
                                  label: "Số công định mức",
                                  type: "number",
                                  value: row.workdays,
                                  required: true,
                                },
                                {
                                  name: "cost",
                                  label: "Chi phí định mức",
                                  type: "number",
                                  value: row.cost,
                                  required: true,
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa định mức nhân công của "${row.category}"?`)) {
                                    return runAction("deleteLaborNorm", { id: row.id });
                                  }
                                },
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={scoped.laborNorms}
            getRowId={(row) => row.id}
            selectable
            exportFileName="dinh-muc-nhan-cong"
            filters={[{ key: "category", label: "Hạng mục", options: laborNormCategoryOptions }]}
          />
        </SectionBlock>
      ),
    },
    progress: {
      title: "Tiến độ hạng mục",
      description: "Theo dõi kế hoạch và ngày hoàn thành xác nhận của từng hạng mục trong công trình.",
      content: (
        <SectionBlock title="Tiến độ">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
              {
                key: "startDate",
                label: "Bắt đầu",
                accessor: (row) => row.startDate,
                render: (row) => row.startDate || "-",
              },
              {
                key: "planEndDate",
                label: "Dự kiến",
                accessor: (row) => row.planEndDate,
                render: (row) => row.planEndDate || "-",
              },
              {
                key: "confirmedEndDate",
                label: "Xác nhận",
                accessor: (row) => row.confirmedEndDate,
                render: (row) => row.confirmedEndDate || "-",
              },
              {
                key: "evaluation",
                label: "Đánh giá",
                accessor: (row) => row.evaluation,
                render: (row) => row.evaluation || "-",
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.progress)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa tiến độ",
                              action: "saveProgress",
                              onAction: runAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: categoryOptions,
                                  value: row.category,
                                  required: true,
                                },
                                {
                                  name: "startDate",
                                  label: "Ngày bắt đầu",
                                  type: "date",
                                  value: row.startDate || todayIso(),
                                  required: true,
                                  validate: validateProgressStartDate,
                                },
                                {
                                  name: "durationDays",
                                  label: "Số ngày",
                                  type: "number",
                                  value: row.durationDays,
                                  required: true,
                                },
                                {
                                  name: "workdays",
                                  label: "Số công",
                                  type: "number",
                                  value: row.workdays,
                                  required: true,
                                },
                                {
                                  name: "planEndDate",
                                  label: "Ngày HT dự kiến",
                                  type: "date",
                                  value: row.planEndDate,
                                  required: true,
                                  validate: validateProgressPlanEndDate,
                                },
                                {
                                  name: "confirmedEndDate",
                                  label: "Ngày HT xác nhận",
                                  type: "date",
                                  value: row.confirmedEndDate,
                                  required: true,
                                  validate: validateProgressConfirmedEndDate,
                                },
                                { name: "evaluation", label: "Đánh giá", value: row.evaluation },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa tiến độ của "${row.category}"?`)) {
                                    return runAction("deleteProgress", { id: row.id });
                                  }
                                },
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={scoped.progress}
            getRowId={(row) => row.id}
            selectable
            exportFileName="tien-do-hang-muc"
            filters={[{ key: "category", label: "Hạng mục", options: progressCategoryOptions }]}
            initialSorting={[{ id: "startDate", desc: true }]}
          />
        </SectionBlock>
      ),
    },
  } satisfies Record<
    WorkforceSection,
    {
      title: string;
      description: string;
      content: React.ReactNode;
    }
  >;

  const currentSection = sections[section];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={currentSection.title}
        description={currentSection.description}
        icon={HardHat}
        actions={canManage ? actions[section] : undefined}
      />
      {currentSection.content}
    </div>
  );
}
