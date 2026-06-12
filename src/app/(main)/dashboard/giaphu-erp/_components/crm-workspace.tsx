"use client";

import * as React from "react";

import { Banknote, BriefcaseBusiness, FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { ContractRow, PaymentRow, ProjectRow } from "@/lib/giaphu-erp/types";

import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { todayIso } from "../_lib/date-utils";
import { uniqueOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ExcelImportDialog } from "./excel-import-dialog";
import { ModuleHeader } from "./module-header";
import { ProjectPinUnlockDialog } from "./project-pin-unlock";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type CrmSection = "projects" | "contracts" | "payments";

function validateNonNegativeAmount(value: string, label = "Số tiền") {
  const raw = value.trim();

  if (!raw) return `Thiếu ${label.toLowerCase()}.`;
  if (raw.startsWith("-")) return `${label} không được âm.`;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return `${label} phải là số hợp lệ.`;

  return undefined;
}

export function CrmWorkspace({ section = "projects" }: { section?: CrmSection }) {
  const { data, activeProjectCode, isSwitchingProject, setActiveProjectCode, runAction, scoped } = useGiaPhuErp();
  const paginatedProjects = usePaginatedErpRows<ProjectRow>({
    dataset: "projects",
    projectCode: "",
    initialRows: data.projects,
    enabled: section === "projects",
  });
  const paginatedContracts = usePaginatedErpRows<ContractRow>({
    dataset: "contracts",
    projectCode: activeProjectCode,
    initialRows: scoped.contracts,
    enabled: section === "contracts",
  });
  const paginatedPayments = usePaginatedErpRows<PaymentRow>({
    dataset: "payments",
    projectCode: activeProjectCode,
    initialRows: scoped.payments,
    enabled: section === "payments",
  });
  const projectStatusOptions = uniqueOptions(data.projects.map((project) => project.status));
  const projectOwnerOptions = uniqueOptions(data.projects.map((project) => project.owner));
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.crmManage);
  const canManageProjects = canManage;
  const [pinProject, setPinProject] = React.useState<ProjectRow | null>(null);

  if (!data.projects.length) {
    return null;
  }

  async function runContractAction(action: string, payload: Record<string, unknown>) {
    const result = await runAction(action, { ...payload, __returnData: false });
    if (result) paginatedContracts.refresh();
    return result;
  }

  async function runPaymentAction(action: string, payload: Record<string, unknown>) {
    const result = await runAction(action, { ...payload, __returnData: false });
    if (result) paginatedPayments.refresh();
    return result;
  }

  function validateContractNo(value: string, payload: Record<string, unknown>) {
    const contractNo = value.trim();
    const editingId = String(payload.id ?? "");

    if (!contractNo) return "Thiếu số hợp đồng.";

    const duplicated = scoped.contracts.some(
      (contract) =>
        contract.contractNo.trim().toLowerCase() === contractNo.toLowerCase() && String(contract.id) !== editingId,
    );

    if (duplicated) return `Số hợp đồng "${contractNo}" đã tồn tại. Vui lòng nhập số khác.`;

    return undefined;
  }

  function switchProject(project: ProjectRow) {
    if (project.code === activeProjectCode) return;
    if (project.hasPin) {
      setPinProject(project);
      return;
    }
    setActiveProjectCode(project.code);
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
      description: "Danh sách công trình và công trình đang làm việc.",
      actions: null,
      content: (
        <SectionBlock title="Danh sách công trình">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              {
                key: "code",
                label: "Mã CT",
                accessor: (project) => project.code,
                render: (project) => (
                  <Button variant="link" className="px-0" onClick={() => switchProject(project)}>
                    {project.code}
                  </Button>
                ),
              },
              {
                key: "name",
                label: "Tên công trình",
                accessor: (project) => project.name,
                render: (project) => project.name,
              },
              {
                key: "owner",
                label: "Chủ đầu tư",
                accessor: (project) => project.owner,
                render: (project) => project.owner || "-",
              },
              {
                key: "contact",
                label: "Liên hệ",
                accessor: (project) => project.contact,
                render: (project) => project.contact || "-",
              },
              {
                key: "startDate",
                label: "Ngày bắt đầu",
                accessor: (project) => project.startDate,
                render: (project) => project.startDate || "-",
              },
              {
                key: "status",
                label: "Trạng thái",
                accessor: (project) => project.status,
                render: (project) => <Badge variant="outline">{project.status || "-"}</Badge>,
              },
              ...(canManageProjects
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (project: (typeof data.projects)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa công trình",
                              action: "saveProject",
                              onAction: runAction,
                              fields: [
                                {
                                  name: "originalCode",
                                  label: "Mã gốc",
                                  type: "hidden",
                                  value: project.code,
                                },
                                {
                                  name: "code",
                                  label: "Mã công trình",
                                  value: project.code,
                                  required: true,
                                  readOnly: true,
                                },
                                { name: "name", label: "Tên công trình", value: project.name, required: true },
                                { name: "owner", label: "Chủ đầu tư", value: project.owner },
                                { name: "contact", label: "Liên hệ", value: project.contact },
                                { name: "referrer", label: "Người giới thiệu", value: project.referrer },
                                {
                                  name: "pin",
                                  label: project.hasPin ? "Mã PIN mới" : "Mã PIN công trình",
                                  type: "password",
                                  inputMode: "numeric",
                                  helperText: project.hasPin
                                    ? "Để trống nếu không đổi PIN."
                                    : "Dùng khi chuyển đổi công trình.",
                                },
                                {
                                  name: "startDate",
                                  label: "Ngày bắt đầu",
                                  type: "date",
                                  value: project.startDate || todayIso(),
                                },
                                { name: "status", label: "Trạng thái", value: project.status || "Đang thi công" },
                                {
                                  name: "failureReason",
                                  label: "Lý do thất bại",
                                  type: "textarea",
                                  value: project.failureReason,
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (
                                    window.confirm(
                                      `Xóa công trình "${project.name}"? Toàn bộ dữ liệu liên quan sẽ bị xóa.`,
                                    )
                                  ) {
                                    return runAction("deleteProject", { code: project.code });
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
            rows={paginatedProjects.rows}
            getRowId={(project) => project.code}
            serverSide={paginatedProjects.serverSide}
            detailType="projects"
            selectable
            bulkDeleteAction={
              canManageProjects
                ? {
                    confirmMessage: (rows) =>
                      `Xóa ${rows.length.toLocaleString("vi-VN")} công trình đã chọn? Toàn bộ dữ liệu liên quan sẽ bị xóa.`,
                    onDelete: async (rows) => {
                      for (const project of rows) {
                        await runAction("deleteProject", { code: project.code });
                      }
                      paginatedProjects.refresh();
                    },
                  }
                : undefined
            }
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
      description: "Hợp đồng, giá trị ký và ghi chú.",
      actions: (
        <>
          <ExcelImportDialog
            title="Import hợp đồng từ Excel"
            action="saveContract"
            onAction={runAction}
            onImported={paginatedContracts.refresh}
            fields={[
              { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
              {
                key: "contractNo",
                label: "Số hợp đồng",
                aliases: ["So HD", "Số HĐ"],
                required: true,
                validate: (value, payload) => validateContractNo(String(value ?? ""), payload),
              },
              {
                key: "value",
                label: "Giá trị",
                aliases: ["Gia tri", "Giá trị HĐ"],
                type: "number",
                required: true,
                validate: (value) => validateNonNegativeAmount(String(value ?? ""), "Giá trị"),
              },
              { key: "signedDate", label: "Ngày ký", aliases: ["Ngay ky"], type: "date", defaultValue: todayIso() },
              { key: "note", label: "Ghi chú", aliases: ["Ghi chu", "Diễn giải"] },
            ]}
          />
          <ActionDialog
            title="Hợp đồng"
            button="Hợp đồng"
            icon={FileText}
            action="saveContract"
            onAction={runContractAction}
            fields={[
              { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
              {
                name: "contractNo",
                label: "Số hợp đồng",
                required: true,
                validate: (value, payload) => validateContractNo(value, payload),
              },
              {
                name: "value",
                label: "Giá trị",
                type: "number",
                required: true,
                validate: (value) => validateNonNegativeAmount(value, "Giá trị"),
              },
              { name: "signedDate", label: "Ngày ký", type: "date", value: todayIso() },
              { name: "note", label: "Ghi chú", type: "textarea" },
            ]}
          />
        </>
      ),
      content: (
        <SectionBlock title="Hợp đồng">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              {
                key: "contractNo",
                label: "Số HĐ",
                accessor: (row) => row.contractNo,
                render: (row) => row.contractNo || "-",
              },
              {
                key: "signedDate",
                label: "Ngày ký",
                accessor: (row) => row.signedDate,
                render: (row) => row.signedDate || "-",
              },
              {
                key: "value",
                label: "Giá trị",
                accessor: (row) => row.value,
                exportValue: (row) => formatMoney(row.value),
                render: (row) => formatMoney(row.value),
              },
              { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.contracts)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa hợp đồng",
                              action: "saveContract",
                              onAction: runContractAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "contractNo",
                                  label: "Số hợp đồng",
                                  required: true,
                                  value: row.contractNo,
                                  validate: (value, payload) => validateContractNo(value, payload),
                                },
                                {
                                  name: "value",
                                  label: "Giá trị",
                                  type: "number",
                                  value: row.value,
                                  required: true,
                                  validate: (value) => validateNonNegativeAmount(value, "Giá trị"),
                                },
                                {
                                  name: "signedDate",
                                  label: "Ngày ký",
                                  type: "date",
                                  value: row.signedDate || todayIso(),
                                },
                                { name: "note", label: "Ghi chú", type: "textarea", value: row.note },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa hợp đồng "${row.contractNo || row.id}"?`)) {
                                    return runContractAction("deleteContract", { id: row.id });
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
            rows={paginatedContracts.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedContracts.serverSide}
            detailType="contracts"
            selectable
            bulkDeleteAction={
              canManage
                ? {
                    confirmMessage: (rows) => `Xóa ${rows.length.toLocaleString("vi-VN")} hợp đồng đã chọn?`,
                    onDelete: async (rows) => {
                      for (const row of rows) {
                        await runContractAction("deleteContract", { id: row.id });
                      }
                      paginatedContracts.refresh();
                    },
                  }
                : undefined
            }
            exportFileName="crm-hop-dong"
            searchPlaceholder="Tìm hợp đồng, ghi chú..."
            initialSorting={[{ id: "signedDate", desc: true }]}
          />
        </SectionBlock>
      ),
    },
    payments: {
      title: "Thu tiền công trình",
      description: "Đợt thanh toán, ngày thu và ghi chú đối chiếu.",
      actions: (
        <>
          <ExcelImportDialog
            title="Import thu tiền từ Excel"
            action="savePayment"
            onAction={runAction}
            onImported={paginatedPayments.refresh}
            fields={[
              { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
              {
                key: "date",
                label: "Ngày thu",
                aliases: ["Ngày", "Ngay thu", "Ngay"],
                type: "date",
                defaultValue: todayIso(),
              },
              {
                key: "amount",
                label: "Số tiền",
                aliases: ["So tien", "Đã thu", "Da thu"],
                type: "number",
                required: true,
                validate: (value) => validateNonNegativeAmount(String(value ?? "")),
              },
              { key: "note", label: "Ghi chú", aliases: ["Ghi chu", "Diễn giải"] },
            ]}
          />
          <ActionDialog
            title="Thu tiền"
            button="Thu tiền"
            icon={Banknote}
            action="savePayment"
            onAction={runPaymentAction}
            fields={[
              { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
              { name: "date", label: "Ngày thu", type: "date", value: todayIso() },
              {
                name: "amount",
                label: "Số tiền",
                type: "number",
                required: true,
                validate: (value) => validateNonNegativeAmount(value),
              },
              { name: "note", label: "Ghi chú", type: "textarea" },
            ]}
          />
        </>
      ),
      content: (
        <SectionBlock title="Thu tiền">
          <DataTable
            loading={isSwitchingProject}
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
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.payments)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa thu tiền",
                              action: "savePayment",
                              onAction: runPaymentAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                { name: "date", label: "Ngày thu", type: "date", value: row.date || todayIso() },
                                {
                                  name: "amount",
                                  label: "Số tiền",
                                  type: "number",
                                  value: row.amount,
                                  required: true,
                                  validate: (value) => validateNonNegativeAmount(value),
                                },
                                { name: "note", label: "Ghi chú", type: "textarea", value: row.note },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm("Xóa phiếu thu này?")) {
                                    return runPaymentAction("deletePayment", { id: row.id });
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
            rows={paginatedPayments.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedPayments.serverSide}
            detailType="payments"
            selectable
            bulkDeleteAction={
              canManage
                ? {
                    confirmMessage: (rows) => `Xóa ${rows.length.toLocaleString("vi-VN")} phiếu thu đã chọn?`,
                    onDelete: async (rows) => {
                      for (const row of rows) {
                        await runPaymentAction("deletePayment", { id: row.id });
                      }
                      paginatedPayments.refresh();
                    },
                  }
                : undefined
            }
            exportFileName="crm-thu-tien"
            searchPlaceholder="Tìm ghi chú thanh toán..."
            initialSorting={[{ id: "date", desc: true }]}
          />
        </SectionBlock>
      ),
    },
  };

  const currentSection = headerBySection[section];
  const currentActions =
    section === "projects"
      ? canManageProjects
        ? currentSection.actions
        : undefined
      : canManage
        ? currentSection.actions
        : undefined;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={currentSection.title}
        description={currentSection.description}
        icon={BriefcaseBusiness}
        actions={currentActions}
      />
      {currentSection.content}
      <ProjectPinUnlockDialog
        project={pinProject}
        open={Boolean(pinProject)}
        onOpenChange={(open) => {
          if (!open) setPinProject(null);
        }}
        onUnlocked={(project) => {
          setPinProject(null);
          setActiveProjectCode(project.code);
        }}
      />
    </div>
  );
}
