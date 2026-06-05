"use client";

import * as React from "react";

import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { GiaPhuActionResult } from "../_lib/giaphu-erp-api";

type ExcelImportFieldType = "text" | "number" | "date" | "boolean";

export type ExcelImportField = {
  key: string;
  label: string;
  aliases?: string[];
  type?: ExcelImportFieldType;
  required?: boolean;
  hidden?: boolean;
  defaultValue?: unknown | ((payload: Record<string, unknown>) => unknown);
  transform?: (value: unknown, payload: Record<string, unknown>) => unknown;
  validate?: (value: unknown, payload: Record<string, unknown>) => string | undefined;
};

type ParsedImportRow = {
  sourceRow: number;
  payload: Record<string, unknown>;
  errors: string[];
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, rawYear] = slashMatch;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return text;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const sanitized = raw.replace(/[^\d,.-]/g, "");
  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");
  let normalized = sanitized;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    normalized = sanitized.replaceAll(thousandSeparator, "").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    normalized =
      sanitized.length - lastComma - 1 === 3 && (sanitized.match(/,/g) ?? []).length === 1
        ? sanitized.replace(",", "")
        : sanitized.replace(",", ".");
  } else if ((sanitized.match(/\./g) ?? []).length > 1) {
    normalized = sanitized.replaceAll(".", "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "co", "có", "x", "da", "đã"].includes(text);
}

function normalizeValue(value: unknown, type: ExcelImportFieldType | undefined) {
  if (type === "number") return normalizeNumber(value);
  if (type === "date") return normalizeDate(value);
  if (type === "boolean") return normalizeBoolean(value);
  return String(value ?? "").trim();
}

function isEmptyPayload(payload: Record<string, unknown>) {
  return Object.values(payload).every((value) => String(value ?? "").trim() === "" || value === false);
}

function buildHeaderMap(headerRow: unknown[]) {
  const map = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function getFieldColumnIndex(field: ExcelImportField, headerMap: Map<string, number>) {
  const keys = [field.label, field.key, ...(field.aliases ?? [])].map(normalizeHeader).filter(Boolean);
  for (const key of keys) {
    const index = headerMap.get(key);
    if (index !== undefined) return index;
  }

  return undefined;
}

function getDefaultValue(field: ExcelImportField, payload: Record<string, unknown>) {
  return typeof field.defaultValue === "function" ? field.defaultValue(payload) : field.defaultValue;
}

function parseRows(rawRows: unknown[][], fields: ExcelImportField[]) {
  const headerIndex = rawRows.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2);
  if (headerIndex < 0)
    return { rows: [], missingHeaders: fields.filter((field) => !field.hidden).map((field) => field.label) };

  const headerMap = buildHeaderMap(rawRows[headerIndex]);
  const columnByField = new Map<string, number | undefined>();
  for (const field of fields) {
    columnByField.set(field.key, getFieldColumnIndex(field, headerMap));
  }

  const missingHeaders = fields
    .filter((field) => !field.hidden && field.required && columnByField.get(field.key) === undefined)
    .map((field) => field.label);
  const rows = rawRows
    .slice(headerIndex + 1)
    .map<ParsedImportRow>((row, index) => {
      const payload: Record<string, unknown> = {};
      const errors: string[] = [];

      for (const field of fields) {
        const columnIndex = columnByField.get(field.key);
        const rawValue = columnIndex === undefined ? undefined : row[columnIndex];
        let value =
          rawValue === undefined || String(rawValue ?? "").trim() === ""
            ? getDefaultValue(field, payload)
            : normalizeValue(rawValue, field.type);

        if (field.transform) {
          value = field.transform(value, payload);
        }

        payload[field.key] = value ?? "";

        if (field.required && String(payload[field.key] ?? "").trim() === "") {
          errors.push(`Thiếu ${field.label}`);
        }

        const validationError = field.validate?.(payload[field.key], payload);
        if (validationError) errors.push(validationError);
      }

      return { sourceRow: headerIndex + index + 2, payload, errors };
    })
    .filter((row) => !isEmptyPayload(row.payload));

  return { rows, missingHeaders };
}

export function ExcelImportDialog({
  title,
  description,
  action,
  fields,
  onAction,
  onImported,
}: {
  title: string;
  description?: string;
  action: string;
  fields: ExcelImportField[];
  onAction: (action: string, payload: Record<string, unknown>) => Promise<GiaPhuActionResult | false | unknown>;
  onImported?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [sheetNames, setSheetNames] = React.useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = React.useState("");
  const [workbookRows, setWorkbookRows] = React.useState<Record<string, unknown[][]>>({});
  const [pending, startTransition] = React.useTransition();
  const parsed = React.useMemo(
    () => parseRows(workbookRows[selectedSheet] ?? [], fields),
    [fields, selectedSheet, workbookRows],
  );
  const validRows = parsed.rows.filter((row) => row.errors.length === 0);
  const invalidRows = parsed.rows.filter((row) => row.errors.length > 0);
  const previewFields = fields.filter((field) => !field.hidden);

  async function handleFile(file: File | null) {
    if (!file) return;

    try {
      const xlsx = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array", cellDates: true });
      const nextRows = Object.fromEntries(
        workbook.SheetNames.map((sheetName) => [
          sheetName,
          xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" }) as unknown[][],
        ]),
      );

      setSheetNames(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0] ?? "");
      setWorkbookRows(nextRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không đọc được file Excel.");
    }
  }

  function importRows() {
    if (!validRows.length) {
      toast.error("Không có dòng hợp lệ để import.");
      return;
    }

    startTransition(async () => {
      const result = await onAction("bulkImport", {
        __returnData: false,
        items: validRows.map((row) => ({ action, payload: row.payload })),
      });

      if (result !== false) {
        toast.success(`Đã import ${validRows.length.toLocaleString("vi-VN")} dòng.`);
        onImported?.();
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileSpreadsheet />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Chọn file Excel/CSV theo sheet AppScript cũ, kiểm tra preview rồi import vào ERP."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-2">
            <Label htmlFor="excel-file">File Excel / CSV</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Sheet</Label>
            <Select value={selectedSheet} onValueChange={setSelectedSheet} disabled={!sheetNames.length}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn sheet" />
              </SelectTrigger>
              <SelectContent>
                {sheetNames.map((sheetName) => (
                  <SelectItem key={sheetName} value={sheetName}>
                    {sheetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {parsed.missingHeaders.length ? (
          <Alert variant="destructive">
            <Upload />
            <AlertTitle>Thiếu cột bắt buộc</AlertTitle>
            <AlertDescription>{parsed.missingHeaders.join(", ")}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{validRows.length.toLocaleString("vi-VN")} dòng hợp lệ</Badge>
          <Badge variant={invalidRows.length ? "destructive" : "secondary"}>
            {invalidRows.length.toLocaleString("vi-VN")} dòng lỗi
          </Badge>
        </div>

        <ScrollArea className="max-h-[420px] rounded-md border">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Dòng</TableHead>
                {previewFields.map((field) => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                <TableHead>Lỗi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.rows.slice(0, 200).map((row) => (
                <TableRow key={row.sourceRow}>
                  <TableCell>{row.sourceRow}</TableCell>
                  {previewFields.map((field) => (
                    <TableCell key={field.key} className="max-w-48 truncate">
                      {String(row.payload[field.key] ?? "") || "-"}
                    </TableCell>
                  ))}
                  <TableCell className={row.errors.length ? "text-destructive" : "text-muted-foreground"}>
                    {row.errors.join(", ") || "OK"}
                  </TableCell>
                </TableRow>
              ))}
              {!parsed.rows.length ? (
                <TableRow>
                  <TableCell colSpan={previewFields.length + 2} className="h-24 text-center text-muted-foreground">
                    Chọn file Excel để xem dữ liệu import.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter showCloseButton>
          <Button disabled={pending || !validRows.length || parsed.missingHeaders.length > 0} onClick={importRows}>
            <Upload />
            {pending ? "Đang import..." : `Import ${validRows.length.toLocaleString("vi-VN")} dòng`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
