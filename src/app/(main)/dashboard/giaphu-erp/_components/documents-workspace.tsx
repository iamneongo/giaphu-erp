"use client";

import * as React from "react";

import Link from "next/link";

import { FileText, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { ActionDialog, collectFormPayload } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";

export function DocumentsWorkspace() {
  const { activeProjectCode, runAction, searchDocuments } = useGiaPhuErp();
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);

  async function submitSearch(form: HTMLFormElement) {
    setRows(await searchDocuments(collectFormPayload(form)));
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Hồ sơ công trình"
        description="Lưu metadata tài liệu, link Drive và trích yếu để tìm kiếm nhanh trong web app."
        icon={FileText}
        actions={
          <ActionDialog
            title="Hồ sơ công trình"
            button="Hồ sơ"
            icon={Upload}
            action="saveDocument"
            onAction={runAction}
            fields={[
              { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
              { name: "docType", label: "Loại hồ sơ", value: "Hợp đồng" },
              { name: "fileName", label: "Tên file", required: true },
              { name: "fileUrl", label: "Link file / Drive" },
              { name: "note", label: "Ghi chú", type: "textarea" },
              { name: "previewText", label: "Nội dung trích yếu", type: "textarea" },
            ]}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Tìm kiếm hồ sơ</CardTitle>
          <CardDescription>Tìm theo tên file, loại hồ sơ, ghi chú hoặc nội dung trích yếu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            columns={[
              { key: "type", label: "Loại", render: (row) => String(row.doc_type ?? "-") },
              { key: "name", label: "Tên file", render: (row) => String(row.file_name ?? "-") },
              {
                key: "url",
                label: "Link",
                render: (row) =>
                  row.file_url ? (
                    <Button variant="link" asChild className="px-0">
                      <Link href={String(row.file_url)} target="_blank" rel="noreferrer">
                        Mở
                      </Link>
                    </Button>
                  ) : (
                    "-"
                  ),
              },
              { key: "note", label: "Ghi chú", render: (row) => String(row.note ?? "-") },
              { key: "preview", label: "Trích yếu", render: (row) => String(row.preview_text ?? "-").slice(0, 160) },
            ]}
            rows={rows}
            getRowId={(row) => String(row.id ?? `${row.file_name ?? "file"}-${row.file_url ?? "url"}`)}
            empty="Nhập từ khóa rồi bấm tìm để xem hồ sơ."
          />
        </CardContent>
      </Card>
    </div>
  );
}
