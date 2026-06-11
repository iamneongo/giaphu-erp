"use client";

import * as React from "react";

import { Banknote, Download, FileText, Hammer, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { OperationRow, SubcontractorContractRow, SubcontractorRow } from "@/lib/giaphu-erp/types";

import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, uniqueOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { runGiaPhuAction, uploadGiaPhuDocument } from "../_lib/giaphu-erp-api";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ExcelImportDialog } from "./excel-import-dialog";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type SubcontractorsSection = "advances" | "contracts" | "operations";

function validateNonNegativeAmount(value: string, label = "Số tiền") {
  const raw = value.trim();

  if (!raw) return `Thiếu ${label.toLowerCase()}.`;
  if (raw.startsWith("-")) return `${label} không được âm.`;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return `${label} phải là số hợp lệ.`;

  return undefined;
}

function exportDocumentUrl(fileUrl: string) {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  if (typeof window === "undefined") return fileUrl;
  return new URL(fileUrl, window.location.origin).toString();
}

export function SubcontractorsWorkspace({ section = "advances" }: { section?: SubcontractorsSection }) {
  const { data, activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const paginatedSubcontractors = usePaginatedErpRows<SubcontractorRow>({
    dataset: "subcontractors",
    projectCode: activeProjectCode,
    initialRows: scoped.subcontractors,
    enabled: section === "advances",
  });
  const paginatedOperations = usePaginatedErpRows<OperationRow>({
    dataset: "operations",
    projectCode: activeProjectCode,
    initialRows: scoped.operations,
    enabled: section === "operations",
  });
  const paginatedSubcontractorContracts = usePaginatedErpRows<SubcontractorContractRow>({
    dataset: "subcontractorContracts",
    projectCode: activeProjectCode,
    initialRows: scoped.subcontractorContracts,
    enabled: section === "contracts",
  });
  const categoryOptions = React.useMemo(() => catalogOptions(data.catalogs.hangMuc), [data.catalogs.hangMuc]);
  const contractorOptions = React.useMemo(() => catalogOptions(data.catalogs.thauPhu), [data.catalogs.thauPhu]);
  const subcontractorWeekOptions = React.useMemo(
    () => uniqueOptions(scoped.subcontractors.map((row) => row.week)),
    [scoped.subcontractors],
  );
  const subcontractorCategoryOptions = React.useMemo(
    () => uniqueOptions(scoped.subcontractors.map((row) => row.category)),
    [scoped.subcontractors],
  );
  const subcontractorNameOptions = React.useMemo(
    () => uniqueOptions(scoped.subcontractors.map((row) => row.contractorName)),
    [scoped.subcontractors],
  );
  const subcontractorStatusOptions = React.useMemo(
    () => uniqueOptions(scoped.subcontractorContracts.map((row) => row.status)),
    [scoped.subcontractorContracts],
  );
  const operationWeekOptions = React.useMemo(
    () => uniqueOptions(scoped.operations.map((row) => row.week)),
    [scoped.operations],
  );
  const subcontractorFilters = React.useMemo(
    () => [
      { key: "week", label: "Tuần", options: subcontractorWeekOptions },
      { key: "category", label: "Hạng mục", options: subcontractorCategoryOptions },
      { key: "contractorName", label: "Thầu phụ", options: subcontractorNameOptions },
    ],
    [subcontractorCategoryOptions, subcontractorNameOptions, subcontractorWeekOptions],
  );
  const subcontractorContractFilters = React.useMemo(
    () => [{ key: "status", label: "Trạng thái", options: subcontractorStatusOptions }],
    [subcontractorStatusOptions],
  );
  const operationFilters = React.useMemo(
    () => [{ key: "week", label: "Tuần", options: operationWeekOptions }],
    [operationWeekOptions],
  );
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.subcontractorsManage);

  async function saveSubcontractorWithAttachment(
    action: string,
    payload: Record<string, unknown>,
    existingRow?: SubcontractorRow,
  ) {
    const attachment = payload.attachment instanceof File && payload.attachment.size > 0 ? payload.attachment : null;
    const nextPayload = { ...payload };
    let uploadedDocumentId = 0;
    delete nextPayload.attachment;

    nextPayload.__returnData = false;
    nextPayload.fileUrl = existingRow?.fileUrl ?? "";
    nextPayload.fileId = existingRow?.fileId ?? "";

    if (attachment) {
      const formData = new FormData();
      const projectCode = String(payload.projectCode || activeProjectCode);
      const contractorName = String(payload.contractorName ?? "").trim();
      const category = String(payload.category ?? "").trim();
      const date = String(payload.date ?? "").trim();

      formData.set("projectCode", projectCode);
      formData.set("docType", "Tạm ứng thầu phụ");
      formData.set("fileName", attachment.name);
      formData.set("note", String(payload.note ?? "").trim());
      formData.set("previewText", [`Tạm ứng thầu phụ`, contractorName, category, date].filter(Boolean).join(" · "));
      formData.set("file", attachment);

      const uploaded = await uploadGiaPhuDocument(formData);
      const documentId = Number(uploaded.documentId ?? 0);

      if (documentId > 0) {
        uploadedDocumentId = documentId;
        nextPayload.fileId = String(documentId);
        nextPayload.fileUrl = `/api/giaphu-erp/documents/${documentId}/file`;
      }
    }

    const result = await runAction(action, nextPayload);
    if (!result && uploadedDocumentId > 0) {
      await runGiaPhuAction("deleteDocument", { id: uploadedDocumentId, __returnData: false }).catch(() => undefined);
    }
    paginatedSubcontractors.refresh();
    return result;
  }

  async function saveOperationWithAttachment(
    action: string,
    payload: Record<string, unknown>,
    existingRow?: OperationRow,
  ) {
    const attachment = payload.attachment instanceof File && payload.attachment.size > 0 ? payload.attachment : null;
    const nextPayload = { ...payload };
    let uploadedDocumentId = 0;
    delete nextPayload.attachment;

    nextPayload.__returnData = false;
    nextPayload.fileUrl = existingRow?.fileUrl ?? "";
    nextPayload.fileId = existingRow?.fileId ?? "";

    if (attachment) {
      const formData = new FormData();
      const projectCode = String(payload.projectCode || activeProjectCode);
      const description = String(payload.description ?? "").trim();
      const date = String(payload.date ?? "").trim();

      formData.set("projectCode", projectCode);
      formData.set("docType", "Chi phí vận hành");
      formData.set("fileName", attachment.name);
      formData.set("note", description);
      formData.set("previewText", ["Chi phí vận hành", description, date].filter(Boolean).join(" · "));
      formData.set("file", attachment);

      const uploaded = await uploadGiaPhuDocument(formData);
      const documentId = Number(uploaded.documentId ?? 0);

      if (documentId > 0) {
        uploadedDocumentId = documentId;
        nextPayload.fileId = String(documentId);
        nextPayload.fileUrl = `/api/giaphu-erp/documents/${documentId}/file`;
      }
    }

    const result = await runAction(action, nextPayload);
    if (!result && uploadedDocumentId > 0) {
      await runGiaPhuAction("deleteDocument", { id: uploadedDocumentId, __returnData: false }).catch(() => undefined);
    }
    paginatedOperations.refresh();
    return result;
  }

  async function runSubcontractorContractAction(action: string, payload: Record<string, unknown>) {
    const result = await runAction(action, { ...payload, __returnData: false });
    if (result) paginatedSubcontractorContracts.refresh();
    return result;
  }

  const actions = {
    advances: (
      <>
        <ExcelImportDialog
          title="Import tạm ứng thầu phụ từ Excel"
          action="saveSubcontractor"
          onAction={runAction}
          onImported={paginatedSubcontractors.refresh}
          fields={[
            { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
            { key: "date", label: "Ngày", aliases: ["Ngay"], type: "date", defaultValue: todayIso() },
            { key: "week", label: "Tuần", aliases: ["Tuan"], defaultValue: currentIsoWeek() },
            { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
            { key: "contractorName", label: "Thầu phụ", aliases: ["Thau phu", "Nhà thầu"], required: true },
            {
              key: "advance",
              label: "Tạm ứng",
              aliases: ["Tam ung", "Số tiền"],
              type: "number",
              required: true,
              validate: (value) => validateNonNegativeAmount(String(value ?? ""), "Tạm ứng"),
            },
            { key: "note", label: "Diễn giải", aliases: ["Ghi chú", "Ghi chu"] },
          ]}
        />
        <ActionDialog
          title="Tạm ứng thầu phụ"
          button="Tạm ứng"
          icon={Hammer}
          action="saveSubcontractor"
          onAction={saveSubcontractorWithAttachment}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "date", label: "Ngày", type: "date", value: todayIso() },
            { name: "week", label: "Tuần", value: currentIsoWeek() },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "contractorName", label: "Thầu phụ", type: "select", options: contractorOptions, required: true },
            {
              name: "advance",
              label: "Tạm ứng",
              type: "number",
              required: true,
              validate: (value) => validateNonNegativeAmount(value, "Tạm ứng"),
            },
            { name: "note", label: "Diễn giải", type: "textarea" },
            {
              name: "attachment",
              label: "Hồ sơ / hình ảnh",
              type: "file",
              accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*",
            },
          ]}
        />
      </>
    ),
    contracts: (
      <>
        <ExcelImportDialog
          title="Import hợp đồng thầu phụ từ Excel"
          action="saveSubcontractorContract"
          onAction={runAction}
          onImported={paginatedSubcontractorContracts.refresh}
          fields={[
            { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
            { key: "contractorName", label: "Thầu phụ", aliases: ["Thau phu", "Nhà thầu"], required: true },
            {
              key: "approvedCost",
              label: "Tổng chi phí dự kiến",
              aliases: ["Chi phí", "Chi phi", "Dự kiến"],
              type: "number",
              required: true,
              validate: (value) => validateNonNegativeAmount(String(value ?? ""), "Tổng chi phí dự kiến"),
            },
            { key: "status", label: "Trạng thái", aliases: ["Trang thai"], defaultValue: "Chờ duyệt" },
            { key: "note", label: "Ghi chú", aliases: ["Ghi chu"] },
          ]}
        />
        <ActionDialog
          title="Hợp đồng thầu phụ"
          button="HĐ thầu phụ"
          icon={FileText}
          action="saveSubcontractorContract"
          onAction={runSubcontractorContractAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "contractorName", label: "Thầu phụ", type: "select", options: contractorOptions, required: true },
            {
              name: "approvedCost",
              label: "Tổng chi phí dự kiến",
              type: "number",
              required: true,
              validate: (value) => validateNonNegativeAmount(value, "Tổng chi phí dự kiến"),
            },
            { name: "status", label: "Trạng thái", value: "Chờ duyệt" },
            { name: "note", label: "Ghi chú", type: "textarea" },
          ]}
        />
      </>
    ),
    operations: (
      <>
        <ExcelImportDialog
          title="Import chi phí vận hành từ Excel"
          action="saveOperation"
          onAction={runAction}
          onImported={paginatedOperations.refresh}
          fields={[
            { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
            { key: "date", label: "Ngày", aliases: ["Ngay"], type: "date", defaultValue: todayIso() },
            { key: "week", label: "Tuần", aliases: ["Tuan"], defaultValue: currentIsoWeek() },
            { key: "description", label: "Diễn giải", aliases: ["Ghi chú", "Ghi chu", "Nội dung"], required: true },
            {
              key: "amount",
              label: "Số tiền",
              aliases: ["So tien", "Chi phí", "Chi phi"],
              type: "number",
              required: true,
            },
          ]}
        />
        <ActionDialog
          title="Chi phí vận hành"
          button="Vận hành"
          icon={Banknote}
          action="saveOperation"
          onAction={saveOperationWithAttachment}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "date", label: "Ngày", type: "date", value: todayIso() },
            { name: "week", label: "Tuần", value: currentIsoWeek() },
            { name: "description", label: "Diễn giải", required: true },
            {
              name: "amount",
              label: "Số tiền",
              type: "number",
              required: true,
              validate: (value) => validateNonNegativeAmount(value),
            },
            {
              name: "attachment",
              label: "Hồ sơ / hình ảnh",
              type: "file",
              accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*",
            },
          ]}
        />
      </>
    ),
  } satisfies Record<SubcontractorsSection, React.ReactNode>;

  const sections = {
    advances: {
      title: "Tạm ứng thầu phụ",
      description: "Tạm ứng theo tuần, hạng mục và đội thầu phụ.",
      content: (
        <SectionBlock title="Tạm ứng thầu phụ">
          <DataTable
            key={`subcontractors-${activeProjectCode}`}
            loading={isSwitchingProject}
            columns={[
              { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
              { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
              {
                key: "category",
                label: "Hạng mục",
                accessor: (row) => row.category,
                render: (row) => row.category || "-",
              },
              {
                key: "contractorName",
                label: "Thầu phụ",
                accessor: (row) => row.contractorName,
                render: (row) => row.contractorName || "-",
              },
              {
                key: "advance",
                label: "Tạm ứng",
                accessor: (row) => row.advance,
                render: (row) => formatMoney(row.advance),
              },
              {
                key: "cumulative",
                label: "Lũy kế",
                accessor: (row) => row.cumulative,
                render: (row) => formatMoney(row.cumulative),
              },
              { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
              {
                key: "fileUrl",
                label: "Hồ sơ",
                accessor: (row) => (row.fileUrl ? "Có hồ sơ" : "Không"),
                searchable: false,
                sortable: false,
                render: (row) =>
                  row.fileUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(row.fileUrl, "_blank", "noopener,noreferrer")}
                    >
                      <Download />
                      Xem tệp
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
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
                      render: (row: SubcontractorRow) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa tạm ứng thầu phụ",
                              action: "saveSubcontractor",
                              onAction: (action, payload) => saveSubcontractorWithAttachment(action, payload, row),
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                { name: "date", label: "Ngày", type: "date", value: row.date || todayIso() },
                                { name: "week", label: "Tuần", value: row.week || currentIsoWeek() },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: categoryOptions,
                                  required: true,
                                  value: row.category,
                                },
                                {
                                  name: "contractorName",
                                  label: "Thầu phụ",
                                  type: "select",
                                  options: contractorOptions,
                                  required: true,
                                  value: row.contractorName,
                                },
                                {
                                  name: "advance",
                                  label: "Tạm ứng",
                                  type: "number",
                                  required: true,
                                  value: row.advance,
                                  validate: (value) => validateNonNegativeAmount(value, "Tạm ứng"),
                                },
                                { name: "note", label: "Diễn giải", type: "textarea", value: row.note },
                                {
                                  name: "attachment",
                                  label: row.fileUrl ? "Hồ sơ / hình ảnh mới" : "Hồ sơ / hình ảnh",
                                  type: "file",
                                  accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*",
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: async () => {
                                  if (window.confirm(`Xóa tạm ứng của "${row.contractorName}"?`)) {
                                    const result = await runAction("deleteSubcontractor", {
                                      id: row.id,
                                      __returnData: false,
                                    });
                                    paginatedSubcontractors.refresh();
                                    return result;
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
            rows={paginatedSubcontractors.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedSubcontractors.serverSide}
            detailType="subcontractors"
            selectable
            exportFileName="thau-phu-tam-ung"
            searchPlaceholder="Tìm thầu phụ, hạng mục..."
            filters={subcontractorFilters}
            initialSorting={[{ id: "date", desc: true }]}
          />
        </SectionBlock>
      ),
    },
    contracts: {
      title: "Hợp đồng thầu phụ",
      description: "Chi phí dự kiến, phê duyệt và hợp đồng thầu phụ.",
      content: (
        <SectionBlock title="Hợp đồng thầu phụ">
          <DataTable
            key={`operations-${activeProjectCode}`}
            loading={isSwitchingProject}
            columns={[
              {
                key: "contractorName",
                label: "Thầu phụ",
                accessor: (row) => row.contractorName,
                render: (row) => row.contractorName,
              },
              {
                key: "approvedCost",
                label: "Dự kiến",
                accessor: (row) => row.approvedCost,
                render: (row) => formatMoney(row.approvedCost),
              },
              {
                key: "status",
                label: "Trạng thái",
                accessor: (row) => row.status,
                render: (row) => <Badge>{row.status}</Badge>,
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.subcontractorContracts)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa hợp đồng thầu phụ",
                              action: "saveSubcontractorContract",
                              onAction: runSubcontractorContractAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "contractorName",
                                  label: "Thầu phụ",
                                  type: "select",
                                  options: contractorOptions,
                                  required: true,
                                  value: row.contractorName,
                                },
                                {
                                  name: "approvedCost",
                                  label: "Tổng chi phí dự kiến",
                                  type: "number",
                                  required: true,
                                  value: row.approvedCost,
                                  validate: (value) => validateNonNegativeAmount(value, "Tổng chi phí dự kiến"),
                                },
                                { name: "status", label: "Trạng thái", value: row.status },
                                { name: "note", label: "Ghi chú", type: "textarea", value: row.note },
                              ],
                            }}
                            actions={[
                              {
                                label: "Duyệt hợp đồng",
                                icon: ShieldCheck,
                                onSelect: () => {
                                  return runSubcontractorContractAction("approveSubcontractorContract", {
                                    projectCode: activeProjectCode,
                                    contractorName: row.contractorName,
                                    by: "Admin",
                                  });
                                },
                              },
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa hợp đồng của "${row.contractorName}"?`)) {
                                    return runSubcontractorContractAction("deleteSubcontractorContract", {
                                      id: row.id,
                                    });
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
            rows={paginatedSubcontractorContracts.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedSubcontractorContracts.serverSide}
            detailType="subcontractor-contracts"
            selectable
            exportFileName="hop-dong-thau-phu"
            filters={subcontractorContractFilters}
          />
        </SectionBlock>
      ),
    },
    operations: {
      title: "Chi phí vận hành",
      description: "Khoản vận hành phát sinh theo ngày và tuần.",
      content: (
        <SectionBlock title="Chi phí vận hành">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
              { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
              {
                key: "description",
                label: "Diễn giải",
                accessor: (row) => row.description,
                render: (row) => row.description || "-",
              },
              {
                key: "amount",
                label: "Số tiền",
                accessor: (row) => row.amount,
                render: (row) => formatMoney(row.amount),
              },
              {
                key: "fileUrl",
                label: "Hồ sơ",
                accessor: (row) => (row.fileUrl ? "Có hồ sơ" : "Không"),
                exportValue: (row) => exportDocumentUrl(row.fileUrl),
                searchable: false,
                sortable: false,
                render: (row) =>
                  row.fileUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(row.fileUrl, "_blank", "noopener,noreferrer")}
                    >
                      <Download />
                      Xem tệp
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
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
                      render: (row: OperationRow) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa chi phí vận hành",
                              action: "saveOperation",
                              onAction: (action, payload) => saveOperationWithAttachment(action, payload, row),
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                { name: "date", label: "Ngày", type: "date", value: row.date || todayIso() },
                                { name: "week", label: "Tuần", value: row.week || currentIsoWeek() },
                                { name: "description", label: "Diễn giải", required: true, value: row.description },
                                {
                                  name: "amount",
                                  label: "Số tiền",
                                  type: "number",
                                  required: true,
                                  value: row.amount,
                                  validate: (value) => validateNonNegativeAmount(value),
                                },
                                {
                                  name: "attachment",
                                  label: row.fileUrl ? "Hồ sơ / hình ảnh mới" : "Hồ sơ / hình ảnh",
                                  type: "file",
                                  accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*",
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: async () => {
                                  if (window.confirm(`Xóa chi phí vận hành "${row.description}"?`)) {
                                    const result = await runAction("deleteOperation", {
                                      id: row.id,
                                      __returnData: false,
                                    });
                                    paginatedOperations.refresh();
                                    return result;
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
            rows={paginatedOperations.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedOperations.serverSide}
            detailType="operations"
            selectable
            exportFileName="chi-phi-van-hanh"
            filters={operationFilters}
            initialSorting={[{ id: "date", desc: true }]}
          />
        </SectionBlock>
      ),
    },
  } satisfies Record<
    SubcontractorsSection,
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
        icon={Hammer}
        actions={canManage ? actions[section] : undefined}
      />
      {currentSection.content}
    </div>
  );
}
