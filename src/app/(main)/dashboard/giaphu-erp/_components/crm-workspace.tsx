"use client";

import * as React from "react";

import { Banknote, BriefcaseBusiness, Eye, FileText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import { ATTACHMENT_DOCUMENT_PROJECT_CODE } from "@/lib/giaphu-erp/document-scope";
import type { ContractRow, DocumentRow, PaymentRow, ProjectRow } from "@/lib/giaphu-erp/types";

import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { todayIso } from "../_lib/date-utils";
import { formatDate, formatMoney } from "../_lib/formatters";
import { runGiaPhuAction, uploadGiaPhuDocument } from "../_lib/giaphu-erp-api";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { DocumentPreviewDialog } from "./documents-workspace";
import { ExcelImportDialog } from "./excel-import-dialog";
import { ModuleHeader } from "./module-header";
import { ProjectPinUnlockDialog } from "./project-pin-unlock";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type CrmSection = "projects" | "contracts" | "payments";

type CrmAttachmentRow = ContractRow | PaymentRow;

const attachmentAccept = ".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.txt,image/*";

function documentFromCrmAttachment(row: CrmAttachmentRow, docType: string): DocumentRow | null {
  const documentId = Number(row.fileId || 0);
  if (!documentId || !row.hasFile) return null;

  return {
    id: documentId,
    project_code: row.projectCode,
    doc_type: docType,
    file_name: row.fileName || "Hồ sơ đính kèm",
    mime_type: row.mimeType || "application/octet-stream",
    file_size: row.fileSize || 0,
    note: row.note,
    preview_text: "",
    has_file: true,
  };
}

function exportAttachmentUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (typeof window === "undefined") return fileUrl;
  return new URL(fileUrl, window.location.origin).toString();
}

function validateNonNegativeAmount(value: string, label = "Số tiền") {
  const raw = value.trim();

  if (!raw) return `Thiếu ${label.toLowerCase()}.`;
  if (raw.startsWith("-")) return `${label} không được âm.`;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return `${label} phải là số hợp lệ.`;

  return undefined;
}

export function CrmWorkspace({ section = "projects" }: { section?: CrmSection }) {
  const { data, activeProjectCode, isSwitchingProject, setActiveProjectCode, runAction, scoped } = useGiaPhuErp();
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
  const activeProjectRows = React.useMemo(
    () => data.projects.filter((project) => project.code === activeProjectCode),
    [activeProjectCode, data.projects],
  );
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.crmManage);
  const canManageProjects = canManage;
  const [pinProject, setPinProject] = React.useState<ProjectRow | null>(null);
  const [previewDocument, setPreviewDocument] = React.useState<DocumentRow | null>(null);

  if (!data.projects.length) {
    return null;
  }

  async function buildPayloadWithAttachment({
    payload,
    docType,
    previewParts,
  }: {
    payload: Record<string, unknown>;
    docType: string;
    previewParts: Array<unknown>;
  }) {
    const attachment = payload.attachment;
    const nextPayload = { ...payload };
    delete nextPayload.attachment;

    nextPayload.fileId = String(payload.fileId ?? "");
    nextPayload.fileUrl = String(payload.fileUrl ?? "");

    if (attachment instanceof File && attachment.size > 0) {
      const formData = new FormData();

      formData.set("projectCode", ATTACHMENT_DOCUMENT_PROJECT_CODE);
      formData.set("docType", docType);
      formData.set("fileName", attachment.name);
      formData.set("note", String(payload.note ?? ""));
      formData.set("previewText", [docType, ...previewParts].filter(Boolean).join(" · "));
      formData.set("file", attachment);

      const uploaded = await uploadGiaPhuDocument(formData);
      const documentId = Number(uploaded.documentId ?? 0);
      if (documentId > 0) {
        nextPayload.fileId = String(documentId);
        nextPayload.fileUrl = `/api/giaphu-erp/documents/${documentId}/file`;
      }
    }

    return nextPayload;
  }

  async function runContractAction(action: string, payload: Record<string, unknown>) {
    const nextPayload =
      action === "saveContract"
        ? await buildPayloadWithAttachment({
            payload,
            docType: "Hợp đồng công trình",
            previewParts: [payload.contractNo, formatDate(String(payload.signedDate ?? ""))],
          })
        : payload;
    const result = await runAction(action, { ...nextPayload, __returnData: false });
    if (result) paginatedContracts.refresh();
    return result;
  }

  async function runPaymentAction(action: string, payload: Record<string, unknown>) {
    const nextPayload =
      action === "savePayment"
        ? await buildPayloadWithAttachment({
            payload,
            docType: "Phiếu thu / chứng từ thu tiền",
            previewParts: [formatDate(String(payload.date ?? "")), formatMoney(Number(payload.amount ?? 0))],
          })
        : payload;
    const result = await runAction(action, { ...nextPayload, __returnData: false });
    if (result) paginatedPayments.refresh();
    return result;
  }

  async function removeDocumentIfPossible(fileId: string) {
    const documentId = Number(fileId || 0);
    if (documentId > 0) {
      await runGiaPhuAction("deleteDocument", { id: documentId, __returnData: false }).catch(() => undefined);
    }
  }

  async function clearContractAttachment(row: ContractRow) {
    const result = await runContractAction("saveContract", {
      id: row.id,
      projectCode: activeProjectCode,
      contractNo: row.contractNo,
      value: row.value,
      signedDate: row.signedDate,
      note: row.note,
      fileId: "",
      fileUrl: "",
    });

    if (result) await removeDocumentIfPossible(row.fileId);
    return result;
  }

  async function clearPaymentAttachment(row: PaymentRow) {
    const result = await runPaymentAction("savePayment", {
      id: row.id,
      projectCode: activeProjectCode,
      date: row.date,
      amount: row.amount,
      note: row.note,
      fileId: "",
      fileUrl: "",
    });

    if (result) await removeDocumentIfPossible(row.fileId);
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
                exportValue: (project) => formatDate(project.startDate),
                render: (project) => formatDate(project.startDate),
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
            rows={activeProjectRows}
            getRowId={(project) => project.code}
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
                    },
                  }
                : undefined
            }
            exportFileName="crm-cong-trinh"
            searchPlaceholder="Tìm theo mã, tên, chủ đầu tư..."
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
              {
                name: "attachment",
                label: "Hồ sơ đính kèm",
                type: "file",
                accept: attachmentAccept,
                helperText: "Hỗ trợ PDF, Word, Excel, CSV, TXT và hình ảnh.",
              },
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
                exportValue: (row) => formatDate(row.signedDate),
                render: (row) => formatDate(row.signedDate),
              },
              {
                key: "value",
                label: "Giá trị",
                accessor: (row) => row.value,
                exportValue: (row) => formatMoney(row.value),
                render: (row) => formatMoney(row.value),
              },
              { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
              {
                key: "fileUrl",
                label: "Hồ sơ",
                accessor: (row) => (row.hasFile ? row.fileName || "Có hồ sơ" : "Không"),
                exportValue: (row) => exportAttachmentUrl(row.fileUrl),
                sortable: false,
                render: (row) => {
                  const document = documentFromCrmAttachment(row, "Hợp đồng công trình");

                  return document ? (
                    <Button size="sm" variant="outline" onClick={() => setPreviewDocument(document)}>
                      <Eye />
                      Xem nhanh
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  );
                },
              },
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
                                { name: "fileId", label: "File ID", type: "hidden", value: row.fileId },
                                { name: "fileUrl", label: "File URL", type: "hidden", value: row.fileUrl },
                                {
                                  name: "attachment",
                                  label: row.hasFile ? "Hồ sơ đính kèm mới" : "Hồ sơ đính kèm",
                                  type: "file",
                                  accept: attachmentAccept,
                                  helperText: row.hasFile
                                    ? "Để trống nếu muốn giữ hồ sơ hiện tại."
                                    : "Hỗ trợ PDF, Word, Excel, CSV, TXT và hình ảnh.",
                                },
                              ],
                            }}
                            actions={[
                              ...(row.hasFile
                                ? [
                                    {
                                      label: "Xóa tệp",
                                      icon: Trash2,
                                      destructive: true,
                                      onSelect: () => {
                                        if (window.confirm(`Xóa tệp đính kèm của hợp đồng "${row.contractNo}"?`)) {
                                          return clearContractAttachment(row);
                                        }
                                      },
                                    },
                                  ]
                                : []),
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
              {
                name: "attachment",
                label: "Chứng từ đính kèm",
                type: "file",
                accept: attachmentAccept,
                helperText: "Hỗ trợ PDF, Word, Excel, CSV, TXT và hình ảnh.",
              },
            ]}
          />
        </>
      ),
      content: (
        <SectionBlock title="Thu tiền">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              {
                key: "date",
                label: "Ngày",
                accessor: (row) => row.date,
                exportValue: (row) => formatDate(row.date),
                render: (row) => formatDate(row.date),
              },
              {
                key: "amount",
                label: "Số tiền",
                accessor: (row) => row.amount,
                exportValue: (row) => formatMoney(row.amount),
                render: (row) => formatMoney(row.amount),
              },
              { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
              {
                key: "fileUrl",
                label: "Hồ sơ",
                accessor: (row) => (row.hasFile ? row.fileName || "Có hồ sơ" : "Không"),
                exportValue: (row) => exportAttachmentUrl(row.fileUrl),
                sortable: false,
                render: (row) => {
                  const document = documentFromCrmAttachment(row, "Phiếu thu / chứng từ thu tiền");

                  return document ? (
                    <Button size="sm" variant="outline" onClick={() => setPreviewDocument(document)}>
                      <Eye />
                      Xem nhanh
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  );
                },
              },
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
                                { name: "fileId", label: "File ID", type: "hidden", value: row.fileId },
                                { name: "fileUrl", label: "File URL", type: "hidden", value: row.fileUrl },
                                {
                                  name: "attachment",
                                  label: row.hasFile ? "Chứng từ đính kèm mới" : "Chứng từ đính kèm",
                                  type: "file",
                                  accept: attachmentAccept,
                                  helperText: row.hasFile
                                    ? "Để trống nếu muốn giữ chứng từ hiện tại."
                                    : "Hỗ trợ PDF, Word, Excel, CSV, TXT và hình ảnh.",
                                },
                              ],
                            }}
                            actions={[
                              ...(row.hasFile
                                ? [
                                    {
                                      label: "Xóa tệp",
                                      icon: Trash2,
                                      destructive: true,
                                      onSelect: () => {
                                        if (window.confirm("Xóa chứng từ đính kèm của phiếu thu này?")) {
                                          return clearPaymentAttachment(row);
                                        }
                                      },
                                    },
                                  ]
                                : []),
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
      <DocumentPreviewDialog document={previewDocument} onOpenChange={(open) => !open && setPreviewDocument(null)} />
    </div>
  );
}
