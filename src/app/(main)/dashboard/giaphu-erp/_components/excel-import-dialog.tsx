"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { erpPathForProject, getProjectRouteInfo } from "@/lib/giaphu-erp/project-routes";

import { DashboardLink } from "../../_components/dashboard-link";
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

type SheetHeader = {
  index: number;
  label: string;
};

type ExcelImportProps = {
  title: string;
  description?: string;
  action: string;
  fields: ExcelImportField[];
  onAction: (action: string, payload: Record<string, unknown>) => Promise<GiaPhuActionResult | false | unknown>;
  onImported?: () => void;
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

function getFieldColumnIndex(
  field: ExcelImportField,
  headerMap: Map<string, number>,
  columnMapping?: Record<string, string>,
) {
  const mappedColumn = columnMapping?.[field.key];
  if (mappedColumn && mappedColumn !== "__skip__") {
    const index = Number(mappedColumn);
    return Number.isInteger(index) ? index : undefined;
  }

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

function getSheetHeaderInfo(rawRows: unknown[][]) {
  const headerIndex = rawRows.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2);
  if (headerIndex < 0) return { headerIndex, headers: [] as SheetHeader[] };

  return {
    headerIndex,
    headers: rawRows[headerIndex].map((cell, index) => ({
      index,
      label: String(cell ?? "").trim() || `Cột ${index + 1}`,
    })),
  };
}

function parseRows(rawRows: unknown[][], fields: ExcelImportField[], columnMapping?: Record<string, string>) {
  const { headerIndex } = getSheetHeaderInfo(rawRows);
  if (headerIndex < 0)
    return {
      rows: [],
      missingHeaderKeys: fields.filter((field) => !field.hidden && field.required).map((field) => field.key),
      missingHeaders: fields.filter((field) => !field.hidden && field.required).map((field) => field.label),
    };

  const headerMap = buildHeaderMap(rawRows[headerIndex]);
  const columnByField = new Map<string, number | undefined>();
  for (const field of fields) {
    columnByField.set(field.key, getFieldColumnIndex(field, headerMap, columnMapping));
  }

  const missingFields = fields.filter(
    (field) => !field.hidden && field.required && columnByField.get(field.key) === undefined,
  );
  const missingHeaderKeys = missingFields.map((field) => field.key);
  const missingHeaders = missingFields.map((field) => field.label);
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
    .filter((row) => !isEmptyPayload(row.payload))
    .map<ParsedImportRow>((row) => ({
      ...row,
      payload: {
        ...row.payload,
        importOrder: row.sourceRow,
      } as Record<string, unknown>,
    }));

  return { rows, missingHeaderKeys, missingHeaders };
}

function getStaticDefaultValue(fields: ExcelImportField[], key: string) {
  const value = fields.find((field) => field.key === key)?.defaultValue;
  return typeof value === "function" ? undefined : value;
}

function getImportHref(action: string, fields: ExcelImportField[]) {
  const params = new URLSearchParams();

  if (action === "manageCatalog") {
    const kind = String(getStaticDefaultValue(fields, "kind") ?? "");
    if (kind) params.set("kind", kind);
    return `/dashboard/giaphu-erp/import/catalogs?${params.toString()}`;
  }

  if (action === "saveMaterial") {
    const materialType = String(getStaticDefaultValue(fields, "materialType") ?? "");
    if (materialType) params.set("materialType", materialType);
    return `/dashboard/giaphu-erp/import/materials?${params.toString()}`;
  }

  const targetByAction: Record<string, string> = {
    manageStaff: "staff",
    saveContract: "contracts",
    saveLaborNorm: "labor-norms",
    saveOperation: "operations",
    savePayment: "payments",
    saveProgress: "progress",
    saveProject: "projects",
    saveSubcontractor: "subcontractors",
    saveSubcontractorContract: "subcontractor-contracts",
  };

  return `/dashboard/giaphu-erp/import/${targetByAction[action] ?? action}`;
}

export function ExcelImportDialog({ action, fields }: ExcelImportProps) {
  const projectRoute = getProjectRouteInfo(usePathname());
  const href = getImportHref(action, fields);

  return (
    <Button asChild size="sm" variant="outline">
      <DashboardLink href={projectRoute ? erpPathForProject(projectRoute.projectId, href) : href}>
        <FileSpreadsheet />
        Import Excel
      </DashboardLink>
    </Button>
  );
}

export function ExcelImportPanel({
  title,
  description,
  action,
  fields,
  onAction,
  onImported,
  backHref,
}: ExcelImportProps & { backHref: string }) {
  const router = useRouter();
  const [sheetNames, setSheetNames] = React.useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = React.useState("");
  const [workbookRows, setWorkbookRows] = React.useState<Record<string, unknown[][]>>({});
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const selectedRows = workbookRows[selectedSheet] ?? [];
  const headerInfo = React.useMemo(() => getSheetHeaderInfo(selectedRows), [selectedRows]);
  const parsed = React.useMemo(
    () => parseRows(selectedRows, fields, columnMapping),
    [columnMapping, fields, selectedRows],
  );
  const hasSelectedSheet = Boolean(selectedSheet && workbookRows[selectedSheet]);
  const hasMissingHeaders = hasSelectedSheet && parsed.missingHeaders.length > 0;
  const validRows = parsed.rows.filter((row) => row.errors.length === 0);
  const invalidRows = parsed.rows.filter((row) => row.errors.length > 0);
  const previewFields = fields.filter((field) => !field.hidden);
  const mappableFields = previewFields.filter((field) => parsed.missingHeaderKeys.includes(field.key));

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
      setColumnMapping({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không đọc được file Excel.");
    }
  }

  function updateSelectedSheet(sheetName: string) {
    setSelectedSheet(sheetName);
    setColumnMapping({});
  }

  function updateColumnMapping(fieldKey: string, columnIndex: string) {
    setColumnMapping((current) => ({
      ...current,
      [fieldKey]: columnIndex,
    }));
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
        router.push(backHref);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {description ?? "Chọn file Excel/CSV theo sheet AppScript cũ, kiểm tra preview rồi import vào ERP."}
          </p>
        </div>
        <Button asChild variant="outline">
          <DashboardLink href={backHref}>Quay lại</DashboardLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            File import
          </CardTitle>
          <CardDescription>Chọn file, chọn sheet rồi kiểm tra dữ liệu trước khi lưu vào ERP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
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
              <Select value={selectedSheet} onValueChange={updateSelectedSheet} disabled={!sheetNames.length}>
                <SelectTrigger className="w-full">
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

          {hasMissingHeaders ? (
            <Alert>
              <Upload />
              <AlertTitle>Cần ghép cột Excel</AlertTitle>
              <AlertDescription>
                File chưa khớp các trường: {parsed.missingHeaders.join(", ")}. Chọn cột tương ứng bên dưới để tiếp tục
                import.
              </AlertDescription>
            </Alert>
          ) : null}

          {hasMissingHeaders && headerInfo.headers.length ? (
            <Card className="border-dashed shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ghép cột Excel</CardTitle>
                <CardDescription>Chọn cột trong file Excel tương ứng với trường ERP đang thiếu.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {mappableFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label>{field.label}</Label>
                      <Select
                        value={columnMapping[field.key] ?? "__skip__"}
                        onValueChange={(value) => updateColumnMapping(field.key, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn cột Excel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">Chưa chọn</SelectItem>
                          {headerInfo.headers.map((header) => (
                            <SelectItem key={`${field.key}-${header.index}`} value={String(header.index)}>
                              {header.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{validRows.length.toLocaleString("vi-VN")} dòng hợp lệ</Badge>
            <Badge variant={invalidRows.length ? "destructive" : "secondary"}>
              {invalidRows.length.toLocaleString("vi-VN")} dòng lỗi
            </Badge>
            {parsed.rows.length > 200 ? (
              <Badge variant="outline">Đang xem 200 / {parsed.rows.length.toLocaleString("vi-VN")} dòng</Badge>
            ) : null}
          </div>

          <ScrollArea className="h-[58vh] min-h-[360px] rounded-lg border">
            <Table className="min-w-[1120px]">
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
                      <TableCell key={field.key} className="max-w-56 truncate">
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
                    <TableCell colSpan={previewFields.length + 2} className="h-40 text-center text-muted-foreground">
                      Chọn file Excel để xem dữ liệu import.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button disabled={pending || !validRows.length || hasMissingHeaders} onClick={importRows}>
            <Upload />
            {pending ? "Đang import..." : `Import ${validRows.length.toLocaleString("vi-VN")} dòng`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
