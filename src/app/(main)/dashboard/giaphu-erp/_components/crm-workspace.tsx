"use client";

import { Banknote, BriefcaseBusiness, FileText, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { todayIso } from "../_lib/date-utils";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";

export function CrmWorkspace() {
  const { data, activeProject, activeProjectCode, setActiveProjectCode, runAction, scoped } = useGiaPhuErp();

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="CRM công trình"
        description="Quản lý danh sách công trình, hợp đồng và lịch sử thu tiền."
        icon={BriefcaseBusiness}
        actions={
          <>
            <ActionDialog
              title="Thông tin công trình"
              button="Công trình"
              icon={Plus}
              action="saveProject"
              onAction={runAction}
              fields={[
                { name: "code", label: "Mã công trình", value: activeProject?.code, required: true },
                { name: "name", label: "Tên công trình", value: activeProject?.name, required: true },
                { name: "owner", label: "Chủ đầu tư", value: activeProject?.owner },
                { name: "contact", label: "Liên hệ", value: activeProject?.contact },
                { name: "referrer", label: "Người giới thiệu", value: activeProject?.referrer },
                {
                  name: "startDate",
                  label: "Ngày bắt đầu",
                  type: "date",
                  value: activeProject?.startDate || todayIso(),
                },
                { name: "status", label: "Trạng thái", value: activeProject?.status || "Đang thi công" },
                { name: "driveUrl", label: "Link Drive", value: activeProject?.driveUrl },
                {
                  name: "failureReason",
                  label: "Lý do thất bại",
                  type: "textarea",
                  value: activeProject?.failureReason,
                },
              ]}
            />
            <ActionDialog
              title="Hợp đồng"
              button="Hợp đồng"
              icon={FileText}
              action="saveContract"
              onAction={runAction}
              fields={[
                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                { name: "contractNo", label: "Số hợp đồng", required: true },
                { name: "value", label: "Giá trị", type: "number" },
                { name: "signedDate", label: "Ngày ký", type: "date", value: todayIso() },
                { name: "note", label: "Ghi chú", type: "textarea" },
              ]}
            />
            <ActionDialog
              title="Thu tiền"
              button="Thu tiền"
              icon={Banknote}
              action="savePayment"
              onAction={runAction}
              fields={[
                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                { name: "date", label: "Ngày thu", type: "date", value: todayIso() },
                { name: "amount", label: "Số tiền", type: "number" },
                { name: "note", label: "Ghi chú", type: "textarea" },
              ]}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Danh sách công trình</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: "code",
                label: "Mã CT",
                render: (project) => (
                  <Button variant="link" className="px-0" onClick={() => setActiveProjectCode(project.code)}>
                    {project.code}
                  </Button>
                ),
              },
              { key: "name", label: "Tên công trình", render: (project) => project.name },
              { key: "owner", label: "Chủ đầu tư", render: (project) => project.owner || "-" },
              { key: "contact", label: "Liên hệ", render: (project) => project.contact || "-" },
              { key: "start", label: "Ngày bắt đầu", render: (project) => project.startDate || "-" },
              {
                key: "status",
                label: "Trạng thái",
                render: (project) => <Badge variant="outline">{project.status || "-"}</Badge>,
              },
            ]}
            rows={data.projects}
            getRowId={(project) => project.code}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hợp đồng</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "no", label: "Số HĐ", render: (row) => row.contractNo || "-" },
                { key: "signed", label: "Ngày ký", render: (row) => row.signedDate || "-" },
                { key: "value", label: "Giá trị", render: (row) => formatMoney(row.value) },
                { key: "note", label: "Ghi chú", render: (row) => row.note || "-" },
              ]}
              rows={scoped.contracts}
              getRowId={(row) => row.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thu tiền</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "date", label: "Ngày", render: (row) => row.date || "-" },
                { key: "amount", label: "Số tiền", render: (row) => formatMoney(row.amount) },
                { key: "note", label: "Ghi chú", render: (row) => row.note || "-" },
              ]}
              rows={scoped.payments}
              getRowId={(row) => row.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
