"use client";

import { useAuth } from "@clerk/nextjs";
import { CalendarCheck, ClipboardList, HardHat, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, shiftOptions, staffOptions, uniqueOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";

type WorkforceSection = "attendance" | "staff" | "laborNorms" | "progress";

export function WorkforceWorkspace({ section = "attendance" }: { section?: WorkforceSection }) {
  const { data, activeProjectCode, runAction, scoped } = useGiaPhuErp();
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
            { name: "date", label: "Ngày", type: "date", value: todayIso() },
            { name: "week", label: "Tuần", value: currentIsoWeek(), required: true },
            { name: "shift", label: "Ca", type: "select", options: shiftOptions },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "staffName", label: "Nhân sự", type: "select", options: workerOptions },
            { name: "position", label: "Chức vụ" },
            { name: "halfDaySalary", label: "Lương 1/2 ngày", type: "number" },
            { name: "allowance", label: "Phụ cấp", type: "number" },
            { name: "overtimeHours", label: "OT giờ", type: "number" },
            { name: "overtimeAmount", label: "OT tiền", type: "number" },
            { name: "coefficient", label: "Hệ số", type: "number", value: 1 },
            { name: "status", label: "Trạng thái", value: "Đã ghi" },
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
          { name: "offDate", label: "Thời gian nghỉ", type: "date" },
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
          { name: "category", label: "Hạng mục", type: "select", options: categoryOptions },
          { name: "workdays", label: "Số công định mức", type: "number" },
          { name: "cost", label: "Chi phí định mức", type: "number" },
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
          { name: "category", label: "Hạng mục", type: "select", options: categoryOptions },
          { name: "startDate", label: "Ngày bắt đầu", type: "date", value: todayIso() },
          { name: "durationDays", label: "Số ngày", type: "number" },
          { name: "workdays", label: "Số công", type: "number" },
          { name: "planEndDate", label: "Ngày HT dự kiến", type: "date" },
          { name: "confirmedEndDate", label: "Ngày HT xác nhận", type: "date" },
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
              columns={[
                { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
                { key: "shift", label: "Ca", accessor: (row) => row.shift, render: (row) => row.shift || "-" },
                { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category || "-" },
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
                { key: "coefficient", label: "Hệ số", accessor: (row) => row.coefficient, render: (row) => formatMoney(row.coefficient) },
                { key: "allowance", label: "Phụ cấp", accessor: (row) => row.allowance, render: (row) => formatMoney(row.allowance) },
                { key: "overtimeAmount", label: "OT", accessor: (row) => row.overtimeAmount, render: (row) => formatMoney(row.overtimeAmount) },
                { key: "total", label: "Thành tiền", accessor: (row) => row.total, render: (row) => formatMoney(row.total) },
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
              columns={[
                { key: "id", label: "Mã", accessor: (row) => row.id, render: (row) => row.id },
                { key: "name", label: "Họ tên", accessor: (row) => row.name, render: (row) => row.name },
                { key: "team", label: "Đội", accessor: (row) => row.team, render: (row) => row.team || "-" },
                { key: "position", label: "Chức vụ", accessor: (row) => row.position, render: (row) => row.position || "-" },
                { key: "salaryDay", label: "Lương/ngày", accessor: (row) => row.salaryDay, render: (row) => formatMoney(row.salaryDay) },
                ...(canManage
                  ? [
                      {
                        key: "actions",
                        label: "",
                        hideable: false,
                        searchable: false,
                        sortable: false,
                        render: (row: (typeof data.staff)[number]) => (
                          <Button size="icon-sm" variant="ghost" onClick={() => runAction("deleteStaff", { id: row.id })}>
                            <Trash2 />
                          </Button>
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
              columns={[
                { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
                { key: "workdays", label: "Số công ĐM", accessor: (row) => row.workdays, render: (row) => formatMoney(row.workdays) },
                { key: "cost", label: "Chi phí ĐM", accessor: (row) => row.cost, render: (row) => formatMoney(row.cost) },
              ]}
              rows={scoped.laborNorms}
              getRowId={(row) => row.id}
              selectable
              exportFileName="dinh-muc-nhan-cong"
              filters={[
                { key: "category", label: "Hạng mục", options: laborNormCategoryOptions },
              ]}
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
              columns={[
                { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
                { key: "startDate", label: "Bắt đầu", accessor: (row) => row.startDate, render: (row) => row.startDate || "-" },
                { key: "planEndDate", label: "Dự kiến", accessor: (row) => row.planEndDate, render: (row) => row.planEndDate || "-" },
                { key: "confirmedEndDate", label: "Xác nhận", accessor: (row) => row.confirmedEndDate, render: (row) => row.confirmedEndDate || "-" },
                { key: "evaluation", label: "Đánh giá", accessor: (row) => row.evaluation, render: (row) => row.evaluation || "-" },
              ]}
              rows={scoped.progress}
              getRowId={(row) => row.id}
              selectable
              exportFileName="tien-do-hang-muc"
              filters={[
                { key: "category", label: "Hạng mục", options: progressCategoryOptions },
              ]}
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
