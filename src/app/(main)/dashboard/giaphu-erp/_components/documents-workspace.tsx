"use client";

import * as React from "react";

import { useAuth } from "@clerk/nextjs";
import { FileText, Search, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { uniqueOptions } from "../_lib/form-options";
import { ActionDialog, collectFormPayload } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

export function DocumentsWorkspace() {
  const { activeProjectCode, isSwitchingProject, runAction, searchDocuments } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [lastKeyword, setLastKeyword] = React.useState("");
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.documentsManage,
  );

  async function submitSearch(form: HTMLFormElement) {
    const payload = collectFormPayload(form);
    setLastKeyword(String(payload.keyword ?? ""));
    setRows(await searchDocuments(payload));
  }

  async function runDocumentAction(action: string, payload: Record<string, unknown>) {
    await runAction(action, payload);
    setRows(
      await searchDocuments({
        projectCode: activeProjectCode,
        keyword: lastKeyword,
      }),
    );
  }

  React.useEffect(() => {
    setRows([]);
    setLastKeyword("");
  }, [activeProjectCode]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title="Hồ sơ công trình"
        description="Lưu metadata tài liệu và trích yếu để tìm kiếm nhanh trong web app."
        icon={FileText}
        actions={canManage ? (
          <ActionDialog
            title="Hồ sơ công trình"
            button="Hồ sơ"
            icon={Upload}
            action="saveDocument"
            onAction={runDocumentAction}
            fields={[
              { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
              { name: "docType", label: "Loại hồ sơ", value: "Hợp đồng" },
              { name: "fileName", label: "Tên file", required: true },
              { name: "note", label: "Ghi chú", type: "textarea" },
              { name: "previewText", label: "Nội dung trích yếu", type: "textarea" },
            ]}
          />
        ) : undefined}
      />

      <SectionBlock title="Tìm kiếm hồ sơ">
        <div className="space-y-4">
          <Form
            className="flex flex-col gap-2 md:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void submitSearch(event.currentTarget);
            }}
          >
            <Input type="hidden" name="projectCode" value={activeProjectCode} />
            <Input name="keyword" placeholder="Nhập từ khóa hồ sơ..." />
            <Button type="submit" variant="outline">
              <Search />
              Tìm
            </Button>
          </Form>

          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "doc_type", label: "Loại", accessor: (row) => row.doc_type, render: (row) => String(row.doc_type ?? "-") },
              { key: "file_name", label: "Tên file", accessor: (row) => row.file_name, render: (row) => String(row.file_name ?? "-") },
              { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => String(row.note ?? "-") },
              {
                key: "preview_text",
                label: "Trích yếu",
                accessor: (row) => row.preview_text,
                render: (row) => String(row.preview_text ?? "-").slice(0, 160),
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: Record<string, unknown>) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa hồ sơ công trình",
                              action: "saveDocument",
                              onAction: runDocumentAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: String(row.id ?? "") },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                { name: "docType", label: "Loại hồ sơ", value: String(row.doc_type ?? "") },
                                { name: "fileName", label: "Tên file", required: true, value: String(row.file_name ?? "") },
                                { name: "note", label: "Ghi chú", type: "textarea", value: String(row.note ?? "") },
                                { name: "previewText", label: "Nội dung trích yếu", type: "textarea", value: String(row.preview_text ?? "") },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa hồ sơ "${String(row.file_name ?? "tài liệu")}"?`)) {
                                    void runDocumentAction("deleteDocument", { id: row.id, projectCode: activeProjectCode });
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
            rows={rows}
            getRowId={(row) => String(row.id ?? `${row.file_name ?? "file"}-${row.file_url ?? "url"}`)}
            empty="Nhập từ khóa rồi bấm tìm để xem hồ sơ."
            selectable
            exportFileName="ho-so-cong-trinh"
            searchPlaceholder="Lọc nhanh trong kết quả hồ sơ..."
            filters={[
              { key: "doc_type", label: "Loại", options: uniqueOptions(rows.map((row) => row.doc_type as string)) },
            ]}
          />
        </div>
      </SectionBlock>
    </div>
  );
}
