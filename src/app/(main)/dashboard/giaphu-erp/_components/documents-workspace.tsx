"use client";

import * as React from "react";

import Image from "next/image";

import { AlertCircle, Download, Eye, FileText, Loader2, Pencil, RefreshCw, Save, Trash2, Upload } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { DocumentRow } from "@/lib/giaphu-erp/types";

import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { uniqueOptions } from "../_lib/form-options";
import { uploadGiaPhuDocument } from "../_lib/giaphu-erp-api";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type ExcelCell = {
  id: string;
  value: string;
};

type ExcelRow = {
  id: string;
  cells: ExcelCell[];
};

type PreviewState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "excel"; sheetName: string; columns: ExcelCell[]; rows: ExcelRow[] }
  | { status: "word"; buffer: ArrayBuffer }
  | { status: "text"; text: string };

function getDocumentFileUrl(row: DocumentRow, download = false) {
  return `/api/giaphu-erp/documents/${row.id}/file${download ? "?download=1" : ""}`;
}

function getFileExtension(row: DocumentRow) {
  const fileName = String(row.file_name ?? "").toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(fileName);
  return match?.[1] ?? "";
}

function formatFileSize(value: unknown) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TruncatedCell({
  value,
  className = "w-64 max-w-64",
  lines = 1,
}: {
  value: unknown;
  className?: string;
  lines?: 1 | 2;
}) {
  const text = String(value ?? "").trim() || "-";
  const lineClass = lines === 2 ? "line-clamp-2 whitespace-normal" : "truncate";

  return (
    <span className={`block min-w-0 ${className} ${lineClass}`} title={text}>
      {text}
    </span>
  );
}

function isPdfDocument(row: DocumentRow) {
  const mimeType = String(row.mime_type ?? "");
  return mimeType === "application/pdf" || getFileExtension(row) === "pdf";
}

function isImageDocument(row: DocumentRow) {
  return String(row.mime_type ?? "").startsWith("image/");
}

function isTextDocument(row: DocumentRow) {
  const mimeType = String(row.mime_type ?? "");
  return mimeType.startsWith("text/") || ["txt", "csv", "log"].includes(getFileExtension(row));
}

function isExcelDocument(row: DocumentRow) {
  const mimeType = String(row.mime_type ?? "");
  const extension = getFileExtension(row);

  return (
    ["xls", "xlsx", "xlsm", "csv"].includes(extension) ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  );
}

function isWordDocument(row: DocumentRow) {
  const mimeType = String(row.mime_type ?? "");
  const extension = getFileExtension(row);

  return extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isLegacyWordDocument(row: DocumentRow) {
  const mimeType = String(row.mime_type ?? "");
  return getFileExtension(row) === "doc" || mimeType === "application/msword";
}

function buildExcelPreview(rows: unknown[][]) {
  const limitedRows = rows.slice(0, 120).map((row) => row.slice(0, 40).map((cell) => String(cell ?? "")));
  const headerValues = limitedRows[0] ?? [];
  const columnCount = Math.max(...limitedRows.map((row) => row.length), 0);
  const columns = Array.from({ length: columnCount }, (_, columnIndex) => {
    const value = headerValues[columnIndex] ?? "";

    return {
      id: `column-${columnIndex}-${value || "empty"}`,
      value: value || `Cột ${columnIndex + 1}`,
    };
  });
  const bodyRows = limitedRows.slice(1).map((row, rowIndex) => ({
    id: `row-${rowIndex}-${row.join("|")}`,
    cells: columns.map((column, columnIndex) => ({
      id: `${column.id}-${rowIndex}`,
      value: row[columnIndex] ?? "",
    })),
  }));

  return { columns, rows: bodyRows };
}

function WordDocumentPreview({ buffer }: { buffer: ArrayBuffer }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    if (!container) return;

    const bodyContainer = container;

    bodyContainer.textContent = "";
    setStatus("loading");
    setMessage("");

    async function renderWordDocument() {
      try {
        const { renderAsync } = await import("docx-preview");

        await renderAsync(buffer.slice(0), bodyContainer, undefined, {
          breakPages: false,
          className: "docx-preview-content",
          ignoreHeight: true,
          ignoreWidth: true,
          inWrapper: false,
          renderComments: false,
          renderEndnotes: true,
          renderFooters: true,
          renderFootnotes: true,
          renderHeaders: true,
        });

        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void renderWordDocument();

    return () => {
      cancelled = true;
      bodyContainer.textContent = "";
    };
  }, [buffer]);

  return (
    <ScrollArea className="h-[70svh] rounded-md border bg-background">
      {status === "loading" ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Đang dựng nội dung Word...
        </div>
      ) : null}
      {status === "error" ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Không dựng được nội dung Word.</p>
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>
        </div>
      ) : null}
      <div
        className="[&_.docx-preview-content]:!p-0 max-w-none p-6 text-sm leading-7 [&_a]:text-primary [&_h1]:font-semibold [&_h1]:text-2xl [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_ul]:list-disc"
        ref={containerRef}
      />
    </ScrollArea>
  );
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
                accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.txt,image/*"
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
  const [previewState, setPreviewState] = React.useState<PreviewState>({ status: "idle" });

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!document?.has_file) {
        setPreviewState({ status: "idle" });
        return;
      }

      if (isPdfDocument(document) || isImageDocument(document)) {
        setPreviewState({ status: "idle" });
        return;
      }

      if (isLegacyWordDocument(document)) {
        setPreviewState({
          status: "error",
          message:
            "File Word định dạng .doc cũ chưa thể xem trực tiếp an toàn trong trình duyệt. Vui lòng tải xuống hoặc lưu lại dưới dạng .docx rồi tải lên.",
        });
        return;
      }

      if (!isExcelDocument(document) && !isWordDocument(document) && !isTextDocument(document)) {
        setPreviewState({
          status: "error",
          message: "Định dạng này chưa hỗ trợ xem trực tiếp. Bạn vẫn có thể tải tệp gốc từ hệ thống.",
        });
        return;
      }

      setPreviewState({ status: "loading" });

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Không tải được nội dung hồ sơ.");
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        if (isExcelDocument(document)) {
          const xlsx = await import("xlsx");
          const workbook = xlsx.read(arrayBuffer, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0] ?? "Sheet 1";
          const sheet = workbook.Sheets[sheetName];
          const preview = buildExcelPreview(xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][]);

          if (!cancelled) setPreviewState({ status: "excel", sheetName, ...preview });
          return;
        }

        if (isWordDocument(document)) {
          if (!cancelled) setPreviewState({ status: "word", buffer: arrayBuffer });
          return;
        }

        const text = new TextDecoder("utf-8").decode(arrayBuffer);
        if (!cancelled) setPreviewState({ status: "text", text });
      } catch (error) {
        if (!cancelled) {
          setPreviewState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (open) {
      void loadPreview();
    } else {
      setPreviewState({ status: "idle" });
    }

    return () => {
      cancelled = true;
    };
  }, [document, fileUrl, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{String(document?.file_name ?? "Hồ sơ")}</DialogTitle>
          <DialogDescription>{String(document?.doc_type ?? "Hồ sơ công trình")}</DialogDescription>
        </DialogHeader>
        {document?.has_file ? (
          isPdfDocument(document) ? (
            <iframe className="h-[70svh] w-full rounded-md border bg-background" src={fileUrl} title="Xem hồ sơ PDF" />
          ) : isImageDocument(document) ? (
            <div className="relative h-[70svh] overflow-hidden rounded-md border bg-muted/20">
              <Image
                alt={String(document.file_name ?? "Hồ sơ")}
                className="object-contain"
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                src={fileUrl}
                unoptimized
              />
            </div>
          ) : previewState.status === "loading" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border bg-muted/30 p-6 text-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Đang mở nội dung hồ sơ...</p>
            </div>
          ) : previewState.status === "excel" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary">{previewState.sheetName}</Badge>
                <p className="text-muted-foreground text-xs">Hiển thị tối đa 120 dòng và 40 cột đầu tiên.</p>
              </div>
              <ScrollArea className="h-[70svh] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewState.columns.map((column) => (
                        <TableHead key={column.id}>{column.value}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewState.rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          ) : previewState.status === "word" ? (
            <WordDocumentPreview buffer={previewState.buffer} />
          ) : previewState.status === "text" ? (
            <ScrollArea className="h-[70svh] rounded-md border bg-muted/20">
              <pre className="whitespace-pre-wrap p-4 text-sm">{previewState.text}</pre>
            </ScrollArea>
          ) : previewState.status === "error" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-md border bg-muted/30 p-6 text-center">
              <AlertCircle className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Chưa xem được trực tiếp file này.</p>
                <p className="text-muted-foreground text-sm">{previewState.message}</p>
              </div>
              <Button asChild variant="outline">
                <a href={getDocumentFileUrl(document, true)} rel="noreferrer" target="_blank">
                  <Download />
                  Tải xuống
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-md border bg-muted/30 p-6 text-center">
              <FileText className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Sẵn sàng xem hồ sơ.</p>
                <p className="text-muted-foreground text-sm">Nếu nội dung chưa hiện, hãy thử tải xuống tệp gốc.</p>
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
  const { activeProjectCode, isSwitchingProject, runAction } = useGiaPhuErp();
  const emptyDocuments = React.useMemo<DocumentRow[]>(() => [], []);
  const paginatedDocuments = usePaginatedErpRows<DocumentRow>({
    dataset: "documents",
    projectCode: activeProjectCode,
    initialRows: emptyDocuments,
  });
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingDocument, setEditingDocument] = React.useState<DocumentRow | null>(null);
  const [previewDocument, setPreviewDocument] = React.useState<DocumentRow | null>(null);
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.documentsManage);

  async function runDocumentAction(action: string, payload: Record<string, unknown>) {
    const saved = await runAction(action, action === "deleteDocument" ? payload : { ...payload, __returnData: false });
    if (!saved) return false;

    paginatedDocuments.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title="Hồ sơ công trình"
        description="Tải lên, xem, sửa và tìm hồ sơ công trình."
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

      <SectionBlock title="Danh sách hồ sơ" meta={<Badge variant="outline">{paginatedDocuments.total} hồ sơ</Badge>}>
        <div className="space-y-4">
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
                  <div className="flex w-[260px] max-w-[260px] flex-col gap-1">
                    <TruncatedCell className="w-[260px] max-w-[260px] font-medium" value={row.file_name} />
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
              {
                key: "note",
                label: "Ghi chú",
                accessor: (row) => row.note,
                render: (row) => <TruncatedCell className="w-[240px] max-w-[240px]" value={row.note} />,
              },
              {
                key: "preview_text",
                label: "Trích yếu",
                accessor: (row) => row.preview_text,
                render: (row) => <TruncatedCell className="w-[360px] max-w-[360px]" value={row.preview_text} />,
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
                                  window.open(getDocumentFileUrl(row), "_blank", "noopener,noreferrer");
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
            rows={paginatedDocuments.rows}
            getRowId={(row) => String(row.id)}
            serverSide={paginatedDocuments.serverSide}
            detailType="documents"
            empty="Chưa có hồ sơ cho công trình hiện tại."
            selectable
            bulkDeleteAction={
              canManage
                ? {
                    confirmMessage: (rows) => `Xóa ${rows.length.toLocaleString("vi-VN")} hồ sơ đã chọn?`,
                    onDelete: async (rows) => {
                      for (const row of rows) {
                        await runDocumentAction("deleteDocument", {
                          id: row.id,
                          projectCode: activeProjectCode,
                        });
                      }
                      paginatedDocuments.refresh();
                    },
                  }
                : undefined
            }
            exportFileName="ho-so-cong-trinh"
            searchPlaceholder="Lọc nhanh trong kết quả hồ sơ..."
            filters={[
              {
                key: "doc_type",
                label: "Loại",
                options: uniqueOptions(paginatedDocuments.rows.map((row) => row.doc_type)),
              },
              {
                key: "has_file",
                label: "Tệp",
                accessor: (row) => (row.has_file ? "Đã tải" : "Thiếu tệp"),
                options: uniqueOptions(paginatedDocuments.rows.map((row) => (row.has_file ? "Đã tải" : "Thiếu tệp"))),
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
        onSaved={async () => {
          paginatedDocuments.refresh();
        }}
        open={editorOpen}
        projectCode={activeProjectCode}
      />
      <DocumentPreviewDialog document={previewDocument} onOpenChange={(open) => !open && setPreviewDocument(null)} />
    </div>
  );
}
