"use client";

import * as React from "react";

import { useAuth } from "@clerk/nextjs";
import { Download, Eye, FileText, Pencil, RefreshCw, Save, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { uniqueOptions } from "../_lib/form-options";
import { uploadGiaPhuDocument } from "../_lib/giaphu-erp-api";
import { collectFormPayload } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type DocumentRow = {
  id: number | string;
  project_code?: string;
  doc_type?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number | string;
  note?: string;
  preview_text?: string;
  has_file?: boolean;
};

function getDocumentFileUrl(row: DocumentRow, download = false) {
  return `/api/giaphu-erp/documents/${row.id}/file${download ? "?download=1" : ""}`;
}

function formatFileSize(value: unknown) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isPreviewable(row: DocumentRow) {
  const mimeType = String(row.mime_type ?? "");
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

function DocumentEditorDialog({
  open,
  onOpenChange,
  projectCode,
  document,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string;
  document?: DocumentRow | null;
  onSaved: () => Promise<void>;
}) {
  const [pending, startTransition] = React.useTransition();
  const [docType, setDocType] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [previewText, setPreviewText] = React.useState("");
  const isEditing = Boolean(document?.id);

  React.useEffect(() => {
    if (!open) return;

    setDocType(String(document?.doc_type ?? "Hợp đồng"));
    setFileName(String(document?.file_name ?? ""));
    setNote(String(document?.note ?? ""));
    setPreviewText(String(document?.preview_text ?? ""));
  }, [document, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;

    if (!projectCode) {
      toast.error("Thiếu công trình.");
      return;
    }

    if (!docType.trim()) {
      toast.error("Thiếu loại hồ sơ.");
      return;
    }

    if (!fileName.trim()) {
      toast.error("Thiếu tên file.");
      return;
    }

    if (!isEditing && !hasFile) {
      toast.error("Vui lòng chọn tệp hồ sơ.");
      return;
    }

    formData.set("projectCode", projectCode);
    formData.set("docType", docType.trim());
    formData.set("fileName", fileName.trim());
    formData.set("note", note.trim());
    formData.set("previewText", previewText.trim());

    if (isEditing) {
      formData.set("id", String(document?.id ?? ""));
    }

    startTransition(async () => {
      try {
        await uploadGiaPhuDocument(formData);
        toast.success("Đã lưu hồ sơ.");
        await onSaved();
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Sửa hồ sơ công trình" : "Tải hồ sơ công trình"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Chỉnh thông tin hồ sơ hoặc chọn tệp mới để thay thế."
              : "Chọn tệp từ máy và lưu trực tiếp vào hệ thống."}
          </DialogDescription>
        </DialogHeader>
        <Form onSubmit={submit} noValidate className="space-y-4">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="docType">Loại hồ sơ</FieldLabel>
              <Input id="docType" name="docType" value={docType} onChange={(event) => setDocType(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="fileName">Tên file</FieldLabel>
              <Input
                id="fileName"
                name="fileName"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="file">{isEditing ? "Tệp thay thế" : "Tệp hồ sơ"}</FieldLabel>
              <Input
                id="file"
                name="file"
                type="file"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0];
                  if (nextFile && !fileName.trim()) {
                    setFileName(nextFile.name);
                  }
                }}
              />
              {isEditing && document?.has_file ? (
                <p className="text-muted-foreground text-xs">
                  Để trống nếu chỉ chỉnh thông tin, không thay tệp hiện tại.
                </p>
              ) : null}
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="note">Ghi chú</FieldLabel>
              <Textarea id="note" name="note" value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="previewText">Nội dung trích yếu</FieldLabel>
              <Textarea
                id="previewText"
                name="previewText"
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <RefreshCw className="animate-spin" /> : <Save />}
              Lưu
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentPreviewDialog({
  document,
  onOpenChange,
}: {
  document?: DocumentRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = Boolean(document);
  const fileUrl = document ? getDocumentFileUrl(document) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{String(document?.file_name ?? "Hồ sơ")}</DialogTitle>
          <DialogDescription>{String(document?.doc_type ?? "Hồ sơ công trình")}</DialogDescription>
        </DialogHeader>
        {document?.has_file ? (
          isPreviewable(document) ? (
            <iframe className="h-[70svh] w-full rounded-md border bg-background" src={fileUrl} title="Xem hồ sơ" />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-md border bg-muted/30 p-6 text-center">
              <FileText className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Định dạng này không xem trực tiếp trong trình duyệt.</p>
                <p className="text-muted-foreground text-sm">Bạn vẫn có thể tải tệp gốc từ hệ thống.</p>
              </div>
              <Button asChild variant="outline">
                <a href={getDocumentFileUrl(document, true)} rel="noreferrer" target="_blank">
                  <Download />
                  Tải xuống
                </a>
              </Button>
            </div>
          )
        ) : (
          <div className="rounded-md border bg-muted/30 p-6 text-muted-foreground text-sm">
            Hồ sơ này chưa có tệp đính kèm. Vui lòng mở phần sửa hồ sơ để tải tệp lên lại.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsWorkspace() {
  const { activeProjectCode, isSwitchingProject, runAction, searchDocuments } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const [rows, setRows] = React.useState<DocumentRow[]>([]);
  const [lastKeyword, setLastKeyword] = React.useState("");
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingDocument, setEditingDocument] = React.useState<DocumentRow | null>(null);
  const [previewDocument, setPreviewDocument] = React.useState<DocumentRow | null>(null);
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.documentsManage,
  );

  const loadDocuments = React.useCallback(
    async (keyword = lastKeyword) => {
      if (!activeProjectCode) {
        setRows([]);
        return;
      }

      const nextRows = await searchDocuments({
        projectCode: activeProjectCode,
        keyword,
      });
      setRows(nextRows as DocumentRow[]);
    },
    [activeProjectCode, lastKeyword, searchDocuments],
  );

  async function submitSearch(form: HTMLFormElement) {
    const payload = collectFormPayload(form);
    const keyword = String(payload.keyword ?? "");
    setLastKeyword(keyword);
    await loadDocuments(keyword);
  }

  async function runDocumentAction(action: string, payload: Record<string, unknown>) {
    const saved = await runAction(action, payload);
    if (!saved) return false;

    await loadDocuments();
    return true;
  }

  React.useEffect(() => {
    setLastKeyword("");
    if (!activeProjectCode) {
      setRows([]);
      return;
    }

    void searchDocuments({ projectCode: activeProjectCode, keyword: "" }).then((nextRows) => {
      setRows(nextRows as DocumentRow[]);
    });
  }, [activeProjectCode, searchDocuments]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title="Hồ sơ công trình"
        description="Tải lên, xem, chỉnh sửa và tìm kiếm hồ sơ trực tiếp trong web app."
        icon={FileText}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingDocument(null);
                setEditorOpen(true);
              }}
            >
              <Upload />
              Hồ sơ
            </Button>
          ) : undefined
        }
      />

      <SectionBlock title="Danh sách hồ sơ" meta={<Badge variant="outline">{rows.length} hồ sơ</Badge>}>
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
              {
                key: "doc_type",
                label: "Loại",
                accessor: (row) => row.doc_type,
                render: (row) => String(row.doc_type ?? "-"),
              },
              {
                key: "file_name",
                label: "Tên file",
                accessor: (row) => row.file_name,
                render: (row) => (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{String(row.file_name ?? "-")}</span>
                    <span className="text-muted-foreground text-xs">{formatFileSize(row.file_size)}</span>
                  </div>
                ),
              },
              {
                key: "has_file",
                label: "Tệp",
                accessor: (row) => (row.has_file ? "Đã tải" : "Thiếu tệp"),
                render: (row) => (
                  <Badge variant={row.has_file ? "secondary" : "outline"}>
                    {row.has_file ? "Đã tải" : "Thiếu tệp"}
                  </Badge>
                ),
              },
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
                      render: (row: DocumentRow) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            actions={[
                              {
                                label: "Xem",
                                icon: Eye,
                                disabled: !row.has_file,
                                onSelect: () => {
                                  setPreviewDocument(row);
                                  return undefined;
                                },
                              },
                              {
                                label: "Tải xuống",
                                icon: Download,
                                disabled: !row.has_file,
                                onSelect: () => {
                                  window.open(getDocumentFileUrl(row, true), "_blank", "noopener,noreferrer");
                                  return undefined;
                                },
                              },
                              {
                                label: "Sửa",
                                icon: Pencil,
                                onSelect: () => {
                                  setEditingDocument(row);
                                  setEditorOpen(true);
                                  return undefined;
                                },
                              },
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa hồ sơ "${String(row.file_name ?? "tài liệu")}"?`)) {
                                    return runDocumentAction("deleteDocument", {
                                      id: row.id,
                                      projectCode: activeProjectCode,
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
            rows={rows}
            getRowId={(row) => String(row.id)}
            empty="Chưa có hồ sơ cho công trình hiện tại."
            selectable
            exportFileName="ho-so-cong-trinh"
            searchPlaceholder="Lọc nhanh trong kết quả hồ sơ..."
            filters={[
              { key: "doc_type", label: "Loại", options: uniqueOptions(rows.map((row) => row.doc_type as string)) },
              {
                key: "has_file",
                label: "Tệp",
                accessor: (row) => (row.has_file ? "Đã tải" : "Thiếu tệp"),
                options: uniqueOptions(rows.map((row) => (row.has_file ? "Đã tải" : "Thiếu tệp"))),
              },
            ]}
          />
        </div>
      </SectionBlock>

      <DocumentEditorDialog
        document={editingDocument}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingDocument(null);
        }}
        onSaved={() => loadDocuments()}
        open={editorOpen}
        projectCode={activeProjectCode}
      />
      <DocumentPreviewDialog document={previewDocument} onOpenChange={(open) => !open && setPreviewDocument(null)} />
    </div>
  );
}
