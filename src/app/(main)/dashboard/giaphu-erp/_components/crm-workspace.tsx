"use client";

import { useAuth } from "@clerk/nextjs";
import { Banknote, BriefcaseBusiness, FileText, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { todayIso } from "../_lib/date-utils";
import { uniqueOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";

type CrmSection = "projects" | "contracts" | "payments";

export function CrmWorkspace({ section = "projects" }: { section?: CrmSection }) {
  const { data, activeProject, activeProjectCode, setActiveProjectCode, runAction, scoped } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const projectStatusOptions = uniqueOptions(data.projects.map((project) => project.status));
  const projectOwnerOptions = uniqueOptions(data.projects.map((project) => project.owner));
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.crmManage,
  );

  if (!data.projects.length) {
    return null;
  }

  const headerBySection: Record<
    CrmSection,
    {
      title: string;
      description: string;
      actions: React.ReactNode;
      content: React.ReactNode;
    }
  > = {
    projects: {
      title: "CRM công trình",
      description: "Theo dõi danh sách công trình và chọn đúng công trình đang làm việc.",
      actions: (
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
            {
              name: "failureReason",
              label: "Lý do thất bại",
              type: "textarea",
              value: activeProject?.failureReason,
            },
          ]}
        />
      ),
      content: (
        <SectionBlock title="Danh sách công trình">
            <DataTable
              columns={[
                {
                  key: "code",
                  label: "Mã CT",
                  accessor: (project) => project.code,
                  render: (project) => (
                    <Button variant="link" className="px-0" onClick={() => setActiveProjectCode(project.code)}>
                      {project.code}
                    </Button>
                  ),
                },
                { key: "name", label: "Tên công trình", accessor: (project) => project.name, render: (project) => project.name },
                { key: "owner", label: "Chủ đầu tư", accessor: (project) => project.owner, render: (project) => project.owner || "-" },
                { key: "contact", label: "Liên hệ", accessor: (project) => project.contact, render: (project) => project.contact || "-" },
                { key: "startDate", label: "Ngày bắt đầu", accessor: (project) => project.startDate, render: (project) => project.startDate || "-" },
                {
                  key: "status",
                  label: "Trạng thái",
                  accessor: (project) => project.status,
                  render: (project) => <Badge variant="outline">{project.status || "-"}</Badge>,
                },
              ]}
              rows={data.projects}
              getRowId={(project) => project.code}
              selectable
              exportFileName="crm-cong-trinh"
              searchPlaceholder="Tìm theo mã, tên, chủ đầu tư..."
              filters={[
                { key: "status", label: "Trạng thái", options: projectStatusOptions },
                { key: "owner", label: "Chủ đầu tư", options: projectOwnerOptions },
              ]}
              initialSorting={[{ id: "startDate", desc: true }]}
            />
        </SectionBlock>
      ),
    },
    contracts: {
      title: "Hợp đồng công trình",
      description: "Quản lý hợp đồng theo công trình đang chọn, tập trung vào giá trị và ghi chú ký kết.",
      actions: (
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
      ),
      content: (
        <SectionBlock title="Hợp đồng">
            <DataTable
              columns={[
                { key: "contractNo", label: "Số HĐ", accessor: (row) => row.contractNo, render: (row) => row.contractNo || "-" },
                { key: "signedDate", label: "Ngày ký", accessor: (row) => row.signedDate, render: (row) => row.signedDate || "-" },
                {
                  key: "value",
                  label: "Giá trị",
                  accessor: (row) => row.value,
                  exportValue: (row) => formatMoney(row.value),
                  render: (row) => formatMoney(row.value),
                },
                { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
              ]}
              rows={scoped.contracts}
              getRowId={(row) => row.id}
              selectable
              exportFileName="crm-hop-dong"
              searchPlaceholder="Tìm hợp đồng, ghi chú..."
              initialSorting={[{ id: "signedDate", desc: true }]}
            />
        </SectionBlock>
      ),
    },
    payments: {
      title: "Thu tiền công trình",
      description: "Theo dõi các đợt thanh toán theo công trình, ngày thu và ghi chú đối chiếu.",
      actions: (
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
      ),
      content: (
        <SectionBlock title="Thu tiền">
            <DataTable
              columns={[
                { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                {
                  key: "amount",
                  label: "Số tiền",
                  accessor: (row) => row.amount,
                  exportValue: (row) => formatMoney(row.amount),
                  render: (row) => formatMoney(row.amount),
                },
                { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
              ]}
              rows={scoped.payments}
              getRowId={(row) => row.id}
              selectable
              exportFileName="crm-thu-tien"
              searchPlaceholder="Tìm ghi chú thanh toán..."
              initialSorting={[{ id: "date", desc: true }]}
            />
        </SectionBlock>
      ),
    },
  };

  const currentSection = headerBySection[section];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={currentSection.title}
        description={currentSection.description}
        icon={BriefcaseBusiness}
        actions={canManage ? currentSection.actions : undefined}
      />
      {currentSection.content}
    </div>
  );
}
