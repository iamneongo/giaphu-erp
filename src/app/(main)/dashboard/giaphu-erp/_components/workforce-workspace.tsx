"use client";

import { CalendarCheck, ClipboardList, HardHat, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, shiftOptions, staffOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";

export function WorkforceWorkspace() {
  const { data, activeProjectCode, runAction, scoped } = useGiaPhuErp();
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const workerOptions = staffOptions(data.staff);

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Nhân công"
        description="Quản lý nhân sự, chấm công theo tuần, khóa kết sổ và định mức tiến độ."
        icon={HardHat}
        actions={
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
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử chấm công</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "date", label: "Ngày", render: (row) => row.date || "-" },
              { key: "week", label: "Tuần", render: (row) => row.week || "-" },
              { key: "shift", label: "Ca", render: (row) => row.shift || "-" },
              { key: "category", label: "Hạng mục", render: (row) => row.category || "-" },
              {
                key: "staff",
                label: "Nhân sự",
                render: (row) => (
                  <div>
                    <div className="font-medium">{row.staffName || "-"}</div>
                    <div className="text-muted-foreground text-xs">{row.position || "-"}</div>
                  </div>
                ),
              },
              { key: "coefficient", label: "Hệ số", render: (row) => formatMoney(row.coefficient) },
              { key: "allowance", label: "Phụ cấp", render: (row) => formatMoney(row.allowance) },
              { key: "overtime", label: "OT", render: (row) => formatMoney(row.overtimeAmount) },
              { key: "total", label: "Thành tiền", render: (row) => formatMoney(row.total) },
            ]}
            rows={scoped.attendance}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Nhân sự
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "id", label: "Mã", render: (row) => row.id },
                { key: "name", label: "Họ tên", render: (row) => row.name },
                { key: "team", label: "Đội", render: (row) => row.team || "-" },
                { key: "position", label: "Chức vụ", render: (row) => row.position || "-" },
                { key: "salary", label: "Lương/ngày", render: (row) => formatMoney(row.salaryDay) },
                {
                  key: "actions",
                  label: "",
                  render: (row) => (
                    <Button size="icon-sm" variant="ghost" onClick={() => runAction("deleteStaff", { id: row.id })}>
                      <Trash2 />
                    </Button>
                  ),
                },
              ]}
              rows={data.staff}
              getRowId={(row) => row.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Định mức và tiến độ
              <div className="flex gap-2">
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
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable
              columns={[
                { key: "category", label: "Hạng mục", render: (row) => row.category },
                { key: "workdays", label: "Số công ĐM", render: (row) => formatMoney(row.workdays) },
                { key: "cost", label: "Chi phí ĐM", render: (row) => formatMoney(row.cost) },
              ]}
              rows={scoped.laborNorms}
              getRowId={(row) => row.id}
            />
            <DataTable
              columns={[
                { key: "category", label: "Hạng mục", render: (row) => row.category },
                { key: "start", label: "Bắt đầu", render: (row) => row.startDate || "-" },
                { key: "plan", label: "Dự kiến", render: (row) => row.planEndDate || "-" },
                { key: "done", label: "Xác nhận", render: (row) => row.confirmedEndDate || "-" },
                { key: "evaluation", label: "Đánh giá", render: (row) => row.evaluation || "-" },
              ]}
              rows={scoped.progress}
              getRowId={(row) => row.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
