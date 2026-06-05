"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardPaste,
  Filter,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { MaterialRow, MaterialType } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

import { DashboardLink } from "../../_components/dashboard-link";
import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { currentIsoWeek, isoWeekFromDate, todayIso } from "../_lib/date-utils";
import { catalogOptions, materialTypeOptions, uniqueOptions } from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable, type DataTableColumn } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type ReviewRow = {
  id: string;
  sourceLine: number;
  rawMaterialName: string;
  category: string;
  materialName: string;
  supplier: string;
  quantity: string;
  unit: string;
  debt: boolean;
};

type ParsedZalo = {
  rows: ReviewRow[];
  rejected: Array<{ line: number; text: string }>;
  header: {
    date: string;
    week: string;
    category: string;
    supplier: string;
  };
};

type ZaloMaterialBreakdownPageProps = {
  initialMaterialType?: MaterialType;
  allowedMaterialTypes?: MaterialType[];
  backHref?: string;
  title?: string;
  description?: string;
};

const zaloMaterialTypeOptions = materialTypeOptions.filter((option) =>
  ["VT Chính", "VT Phụ", "VT MEP-HVAC"].includes(option.value),
) as Array<{ label: string; value: MaterialType }>;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function catalogKey(value: string) {
  return normalizeText(value).toLowerCase();
}

function parseNumber(value: string) {
  const raw = value.trim();
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

function formatNumberInput(value: string) {
  const parsed = parseNumber(value);
  return parsed ? String(parsed) : "";
}

function appScriptDateToIso(value: string) {
  const parts = value.split("/");
  if (parts.length !== 3) return "";
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function parseZaloHeaderLine(line: string) {
  const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const date = dateMatch?.[1] ? appScriptDateToIso(dateMatch[1]) : "";
  let category = "";

  if (dateMatch?.[1] && line.includes(".")) {
    const dotParts = line.split(".").map(normalizeText).filter(Boolean);
    const dateIndex = dotParts.findIndex((part) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(part));
    if (dateIndex >= 0) {
      category = normalizeText(dotParts.slice(dateIndex + 2).join(".") || dotParts.slice(dateIndex + 1).join("."));
    }
  }

  const categoryMatch = line.match(/(?:hạng\s*mục|hm|buổi\s*:?\s*\w+)\s*[:.]?\s*(.+)$/i);
  if (!category && categoryMatch?.[1]) {
    category = normalizeText(categoryMatch[1]).replace(/^[-:.\s]+/, "");
  }

  return {
    date,
    category,
  };
}

function findMaterialSuggestion(value: string, options: string[]) {
  const key = catalogKey(value);
  if (!key) return "";
  const exact = options.find((option) => catalogKey(option) === key);
  if (exact) return exact;
  return options.find((option) => catalogKey(option).includes(key) || key.includes(catalogKey(option))) ?? "";
}

function parseAppScriptZalo(value: string): ParsedZalo {
  const rows: ReviewRow[] = [];
  const rejected: ParsedZalo["rejected"] = [];
  const lines = value.split(/\r?\n/).map(normalizeText).filter(Boolean);
  const header = { date: "", week: "", category: "", supplier: "" };
  let category = "";
  let supplier = "";

  lines.forEach((line, index) => {
    if (/^(stt|vật tư|vat tu|tên|ten|ghi chú|ghi chu)/i.test(line)) return;

    if (index === 0) {
      const parsedHeader = parseZaloHeaderLine(line);
      if (parsedHeader.date) {
        header.date = parsedHeader.date;
        header.week = isoWeekFromDate(header.date);
      }
      if (parsedHeader.category) {
        category = parsedHeader.category;
        header.category = category;
      }
    }

    if (/^(hm|hạng mục)\s*:/i.test(line)) {
      category = normalizeText(line.split(":").slice(1).join(":"));
      header.category = category;
      return;
    }

    if (/^(ncc|nhà\s*cung\s*cấp)\s*:/i.test(line)) {
      supplier = normalizeText(line.split(":").slice(1).join(":"));
      header.supplier = supplier;
      return;
    }

    const cleaned = line.replace(/^[\d\-*)\s.]+/, "");
    let materialName = "";
    let quantity = "";
    let unit = "";

    let match = cleaned.match(/^(.+?)\s*:\s*([\d.,]+)(?:\s*[.-]\s*|\s+)?(.+)?$/);
    if (match) {
      materialName = normalizeText(match[1] ?? "");
      quantity = formatNumberInput(match[2] ?? "");
      unit = normalizeText(match[3] ?? "");
    } else {
      match = cleaned.match(/^(.+?)\s+([\d.,]+)\s+(.+)$/);
      if (match) {
        materialName = normalizeText(match[1] ?? "");
        quantity = formatNumberInput(match[2] ?? "");
        unit = normalizeText(match[3] ?? "");
      }
    }

    if (materialName && parseNumber(quantity) > 0) {
      rows.push({
        id: crypto.randomUUID(),
        sourceLine: index + 1,
        rawMaterialName: materialName,
        category,
        materialName,
        supplier,
        quantity,
        unit,
        debt: false,
      });
      return;
    }

    if (index > 0 || !header.date) rejected.push({ line: index + 1, text: line });
  });

  return { rows, rejected, header };
}

function statusForRow(row: ReviewRow, materialType: MaterialType, mainMaterials: string[]) {
  if (!row.category.trim()) return { tone: "error" as const, message: "Chưa chọn hạng mục." };
  if (!row.materialName.trim()) return { tone: "error" as const, message: "Chưa nhập vật tư chuẩn." };
  if (parseNumber(row.quantity) <= 0) return { tone: "error" as const, message: "Chưa nhập số lượng." };
  if (!row.unit.trim()) return { tone: "error" as const, message: "Chưa nhập đơn vị." };

  if (materialType === "VT Chính") {
    const suggestion = findMaterialSuggestion(row.materialName, mainMaterials);
    if (catalogKey(suggestion) !== catalogKey(row.materialName)) {
      return {
        tone: "warning" as const,
        message: suggestion ? `Chưa khớp danh mục. Gợi ý: ${suggestion}` : "Chưa có trong danh mục vật tư công ty.",
      };
    }
    return { tone: "success" as const, message: "Khớp danh mục công ty." };
  }

  return { tone: "info" as const, message: "Cho phép hiệu chỉnh tay, không đối chiếu danh mục." };
}

function updateRow(rows: ReviewRow[], id: string, patch: Partial<ReviewRow>) {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

function uniqueTextOptions(values: string[]) {
  const seen = new Set<string>();
  return values
    .map(normalizeText)
    .filter(Boolean)
    .filter((value) => {
      const key = catalogKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function materialTotal(row: MaterialRow) {
  return Number(row.quantity || 0) * Number(row.price || 0);
}

function buildSavedMaterialColumns({
  canManage,
  runAction,
  refresh,
}: {
  canManage: boolean;
  runAction: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  refresh: () => void;
}): DataTableColumn<MaterialRow>[] {
  return [
    { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
    { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
    {
      key: "category",
      label: "Hạng mục",
      accessor: (row) => row.category,
      render: (row) => <span className="block max-w-48 truncate">{row.category || "-"}</span>,
    },
    {
      key: "materialName",
      label: "Vật tư",
      accessor: (row) => row.materialName,
      render: (row) => <span className="block max-w-72 truncate font-medium">{row.materialName || "-"}</span>,
    },
    {
      key: "supplier",
      label: "Nhà CC",
      accessor: (row) => row.supplier,
      render: (row) => <span className="block max-w-56 truncate">{row.supplier || "-"}</span>,
    },
    {
      key: "quantity",
      label: "SL",
      accessor: (row) => row.quantity,
      render: (row) => formatCount(row.quantity),
      exportValue: (row) => row.quantity,
    },
    { key: "unit", label: "ĐV", accessor: (row) => row.unit, render: (row) => row.unit || "-" },
    {
      key: "price",
      label: "Đơn giá",
      accessor: (row) => row.price,
      render: (row) => formatMoney(row.price),
      exportValue: (row) => row.price,
    },
    {
      key: "total",
      label: "Thành tiền",
      accessor: (row) => materialTotal(row),
      render: (row) => <span className="font-medium">{formatMoney(materialTotal(row))}</span>,
      exportValue: (row) => materialTotal(row),
    },
    {
      key: "paymentStatus",
      label: "TT",
      accessor: (row) => row.paymentStatus,
      render: (row) => (
        <Badge variant={row.paymentStatus === "Đã TT" ? "secondary" : "destructive"}>{row.paymentStatus}</Badge>
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
            render: (row: MaterialRow) => (
              <div className="flex justify-end">
                <TableRowActions
                  edit={{
                    title: "Cập nhật đơn giá vật tư",
                    action: "updateMaterialPrice",
                    onAction: async (action, payload) => {
                      await runAction(action, { ...payload, __returnData: false });
                      refresh();
                    },
                    fields: [
                      { name: "id", label: "ID", type: "hidden", value: row.id },
                      { name: "price", label: "Đơn giá", type: "number", value: row.price },
                    ],
                  }}
                  actions={[
                    {
                      label: "Đánh dấu đã TT",
                      icon: CheckCircle2,
                      disabled: row.paymentStatus === "Đã TT",
                      onSelect: async () => {
                        await runAction("markMaterialPaid", { id: row.id, __returnData: false });
                        refresh();
                      },
                    },
                    {
                      label: "Xóa",
                      icon: Trash2,
                      destructive: true,
                      onSelect: async () => {
                        if (!window.confirm(`Xóa dòng vật tư "${row.materialName}"?`)) return;
                        await runAction("deleteMaterial", { id: row.id, __returnData: false });
                        refresh();
                      },
                    },
                  ]}
                />
              </div>
            ),
          } satisfies DataTableColumn<MaterialRow>,
        ]
      : []),
  ];
}

function SearchableCellPicker({
  value,
  options,
  placeholder,
  onChange,
  className,
  allowCustom = true,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const searchKey = catalogKey(search);
  const filteredOptions = searchKey
    ? options.filter((option) => catalogKey(option).includes(searchKey))
    : options.slice(0, 60);
  const exactMatch = options.some((option) => catalogKey(option) === searchKey);
  const customValue = normalizeText(search);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setSearch(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-9 w-full justify-between rounded-md px-3 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
          role="combobox"
          size="sm"
          variant="outline"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Không có dữ liệu phù hợp.</CommandEmpty>
            {allowCustom && customValue && !exactMatch ? (
              <>
                <CommandGroup heading="Nhập tay">
                  <CommandItem
                    value={`custom-${customValue}`}
                    onSelect={() => {
                      onChange(customValue);
                      setOpen(false);
                    }}
                  >
                    Dùng "{customValue}"
                  </CommandItem>
                </CommandGroup>
                {filteredOptions.length ? <CommandSeparator /> : null}
              </>
            ) : null}
            <CommandGroup heading="Danh mục">
              {filteredOptions.map((option) => (
                <CommandItem
                  data-checked={catalogKey(option) === catalogKey(value)}
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ZaloMaterialBreakdownPage({
  initialMaterialType = "VT Chính",
  allowedMaterialTypes,
  backHref,
  title = "Phân rã Zalo vật tư",
  description = "Đọc vật tư từ tin nhắn Zalo, kiểm tra lại rồi lưu ERP.",
}: ZaloMaterialBreakdownPageProps = {}) {
  const pathname = usePathname();
  const { activeProjectCode, data, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const materialTypeChoices = React.useMemo(() => {
    if (!allowedMaterialTypes?.length) return zaloMaterialTypeOptions;
    const choices = zaloMaterialTypeOptions.filter((option) => allowedMaterialTypes.includes(option.value));
    return choices.length ? choices : zaloMaterialTypeOptions;
  }, [allowedMaterialTypes]);
  const defaultMaterialType = materialTypeChoices.some((option) => option.value === initialMaterialType)
    ? initialMaterialType
    : (materialTypeChoices[0]?.value ?? "VT Chính");
  const materialType = defaultMaterialType;
  const [date, setDate] = React.useState(todayIso());
  const [week, setWeek] = React.useState(currentIsoWeek());
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [rejected, setRejected] = React.useState<ParsedZalo["rejected"]>([]);
  const [zaloDialogOpen, setZaloDialogOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.materialsManage);
  const resolvedBackHref =
    backHref ?? (pathname.replace(/\/(?:create|zalo)\/?$/, "") || "/dashboard/giaphu-erp/catalogs/vat-tu");
  const categorySelectOptions = catalogOptions(data.catalogs.hangMuc);
  const categoryOptions = categorySelectOptions.map((option) => option.value);
  const mainMaterials = catalogOptions(data.catalogs.vatTu).map((option) => option.value);
  const materialSelectOptions = catalogOptions(
    materialType === "VT Chính" ? data.catalogs.vatTu : data.catalogs.vatTuPhu,
  );
  const supplierSelectOptions = catalogOptions(data.catalogs.nhaCungCap);
  const supplierOptions = supplierSelectOptions.map((option) => option.value);
  const unitOptions = uniqueTextOptions([
    ...data.catalogs.vatTu.map((item) => item.unit),
    ...data.catalogs.vatTuPhu.map((item) => item.unit),
    ...scoped.materials.map((item) => item.unit),
    "bao",
    "m3",
    "kg",
    "cái",
    "bộ",
    "m",
    "m2",
    "viên",
  ]);
  const rowStatuses = rows.map((row) => statusForRow(row, materialType, mainMaterials));
  const errors = rowStatuses.filter((status) => status.tone === "error");
  const warnings = rowStatuses.filter((status) => status.tone === "warning");
  const materialFixedFilters = React.useMemo(() => ({ materialType }), [materialType]);
  const savedMaterialRows = React.useMemo(
    () => scoped.materials.filter((row) => row.materialType === materialType),
    [materialType, scoped.materials],
  );
  const paginatedMaterials = usePaginatedErpRows<MaterialRow>({
    dataset: "materials",
    projectCode: activeProjectCode,
    initialRows: savedMaterialRows,
    fixedFilters: materialFixedFilters,
  });
  const savedMaterialColumns = React.useMemo(
    () =>
      buildSavedMaterialColumns({
        canManage,
        runAction,
        refresh: paginatedMaterials.refresh,
      }),
    [canManage, paginatedMaterials.refresh, runAction],
  );
  const savedMaterialWeekOptions = uniqueOptions(savedMaterialRows.map((row) => row.week));
  const savedMaterialCategoryOptions = uniqueOptions(savedMaterialRows.map((row) => row.category));
  const savedMaterialSupplierOptions = uniqueOptions(savedMaterialRows.map((row) => row.supplier));
  const savedMaterialPaymentOptions = uniqueOptions(savedMaterialRows.map((row) => row.paymentStatus));

  function parseText() {
    const parsed = parseAppScriptZalo(text);
    if (parsed.header.date) setDate(parsed.header.date);
    if (parsed.header.week) setWeek(parsed.header.week);
    setRows(parsed.rows);
    setRejected(parsed.rejected);

    if (!parsed.rows.length) {
      toast.error("Không đọc được dòng vật tư từ nội dung Zalo.");
      return;
    }

    setZaloDialogOpen(false);
    toast.success("Đã phân rã ra màn hình đối soát nhập liệu.");
  }

  function saveRows() {
    if (!rows.length) {
      toast.error("Không có dữ liệu hợp lệ.");
      return;
    }

    if (errors.length) {
      toast.error(`Còn ${errors.length} lỗi cần sửa trước khi chốt lưu.`);
      return;
    }

    if (materialType === "VT Chính" && warnings.length) {
      toast.error(`Có ${warnings.length} cảnh báo chưa xử lý. Vật tư chính phải khớp danh mục công ty.`);
      return;
    }

    startTransition(async () => {
      const result = await runAction("saveZaloMaterialBreakdown", {
        projectCode: activeProjectCode,
        date,
        week,
        materialType,
        __returnData: false,
        rows: rows.map((row) => ({
          date,
          week,
          category: row.category,
          materialType,
          materialName: row.materialName,
          quantity: parseNumber(row.quantity),
          unit: row.unit,
          price: 0,
          debt: row.debt ? "Có" : "Không",
          status: "Đã xác nhận",
          supplier: row.supplier,
          paymentStatus: row.debt ? "Chưa TT" : "Đã TT",
        })),
      });

      if (result !== false) {
        setRows([]);
        setRejected([]);
        setText("");
        paginatedMaterials.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={title}
        description={description}
        icon={ClipboardPaste}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {backHref ? (
              <Button asChild size="sm" variant="outline">
                <DashboardLink href={resolvedBackHref}>Quay lại</DashboardLink>
              </Button>
            ) : null}
            <Dialog open={zaloDialogOpen} onOpenChange={setZaloDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <ClipboardPaste />
                  Phân rã Zalo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Phân rã Zalo {materialType}</DialogTitle>
                  <DialogDescription>Dán nội dung Zalo. Bảng đối soát sẽ nhận các dòng đọc được.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="zalo-date">Ngày</Label>
                        <Input
                          id="zalo-date"
                          type="date"
                          value={date}
                          onChange={(event) => setDate(event.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="zalo-week">Tuần</Label>
                        <Input id="zalo-week" value={week} onChange={(event) => setWeek(event.target.value)} />
                      </div>
                    </div>

                    <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm">
                      <div className="font-semibold">Cú pháp chuẩn Zalo {materialType}</div>
                      <div className="mt-2 space-y-1 text-muted-foreground text-xs">
                        <div>Dòng 1: ngày/tháng/năm.buổi.hạng mục</div>
                        <div>Dòng 2+: 1. vật tư a: số lượng.đơn vị</div>
                        <div>Tuỳ chọn: NCC: Nhà cung cấp A</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="zalo-text">Nội dung Zalo</Label>
                      <div className="text-muted-foreground text-xs">Dán nhiều dòng cùng lúc.</div>
                    </div>
                    <Textarea
                      id="zalo-text"
                      className="min-h-[320px] resize-y font-mono text-sm"
                      value={text}
                      placeholder={`16/04/2026.Sáng.Láng trại\nNCC: Nhà cung cấp A\n1. Xi măng PCB40: 20.bao\n2. Cát tô: 3.m3`}
                      onChange={(event) => setText(event.target.value)}
                    />

                    {rejected.length ? (
                      <Alert variant="destructive">
                        <AlertTriangle />
                        <AlertTitle>{rejected.length} dòng chưa đọc được</AlertTitle>
                        <AlertDescription>
                          Kiểm tra lại dấu `:` và định dạng `SL.ĐV` trước khi chốt lưu.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                </div>

                <DialogFooter showCloseButton>
                  <Button onClick={parseText}>
                    <Filter />
                    Phân rã {materialType}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ActionDialog
              title={`Thêm ${materialType}`}
              description="Nhập một dòng vật tư và lưu vào ERP."
              button="Thêm tay"
              icon={Plus}
              action="saveMaterial"
              trigger={
                <Button size="sm" variant="outline">
                  <Plus />
                  Thêm tay
                </Button>
              }
              onAction={async (action, payload) => {
                const result = await runAction(action, { ...payload, __returnData: false });
                paginatedMaterials.refresh();
                return result;
              }}
              fields={[
                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                { name: "materialType", label: "Loại", type: "hidden", value: materialType },
                { name: "status", label: "Trạng thái", type: "hidden", value: "Thêm tay" },
                { name: "date", label: "Ngày", type: "date", value: todayIso(), required: true },
                {
                  name: "week",
                  label: "Tuần",
                  value: currentIsoWeek(),
                  deriveValue: (payload) => isoWeekFromDate(String(payload.date ?? "")) || currentIsoWeek(),
                  readOnly: true,
                },
                {
                  name: "category",
                  label: "Hạng mục",
                  type: "select",
                  options: categorySelectOptions,
                  required: true,
                },
                {
                  name: "materialName",
                  label: "Vật tư",
                  type: "select",
                  options: materialSelectOptions,
                  required: true,
                },
                {
                  name: "supplier",
                  label: "NCC",
                  type: "select",
                  options: supplierSelectOptions,
                  placeholder: "Chọn NCC từ danh mục",
                  helperText: supplierSelectOptions.length
                    ? "Lấy thông tin từ Danh mục > Nhà cung cấp."
                    : "Chưa có NCC. Vui lòng thêm ở Danh mục > Nhà cung cấp trước.",
                  validate: (value) => {
                    const supplier = value.trim();
                    if (!supplierSelectOptions.length) {
                      return "Chưa có NCC trong danh mục. Vui lòng thêm nhà cung cấp trước.";
                    }
                    if (!supplier) return "Vui lòng chọn NCC từ danh mục nhà cung cấp.";
                    if (!supplierSelectOptions.some((option) => option.value === supplier)) {
                      return "NCC phải được chọn từ danh mục nhà cung cấp.";
                    }
                    return undefined;
                  },
                },
                { name: "quantity", label: "Số lượng", type: "number", value: 1, required: true },
                {
                  name: "unit",
                  label: "Đơn vị",
                  type: "select",
                  options: unitOptions.map((value) => ({ label: value, value })),
                  required: true,
                },
                { name: "price", label: "Đơn giá", type: "number", value: 0 },
                {
                  name: "debt",
                  label: "Công nợ",
                  type: "select",
                  value: "Không",
                  options: [
                    { label: "Không", value: "Không" },
                    { label: "Có", value: "Có" },
                  ],
                },
                {
                  name: "paymentStatus",
                  label: "Thanh toán",
                  type: "select",
                  value: "Đã TT",
                  options: [
                    { label: "Đã TT", value: "Đã TT" },
                    { label: "Chưa TT", value: "Chưa TT" },
                  ],
                },
                { name: "paymentInfo", label: "Ghi chú thanh toán", type: "textarea" },
              ]}
            />
            {rows.length ? (
              <Button disabled={pending} size="sm" onClick={saveRows}>
                {pending ? <RefreshCw className="animate-spin" /> : <Save />}
                Chốt lưu ERP
              </Button>
            ) : null}
          </div>
        }
      />

      {rows.length ? (
        <Card className="border-t-2 border-t-amber-500">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              Bước 2: Rà soát dữ liệu phân rã - {materialType}
            </CardTitle>
            <CardDescription>Kiểm tra hạng mục, vật tư, nhà cung cấp, số lượng và công nợ.</CardDescription>
            <CardAction>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={errors.length ? "destructive" : "secondary"}>{errors.length} lỗi</Badge>
                <Badge variant={warnings.length ? "destructive" : "secondary"}>{warnings.length} cảnh báo</Badge>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table className="min-w-[1080px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56">Hạng mục</TableHead>
                    <TableHead>{materialType === "VT Chính" ? "Vật tư đối chiếu DM" : "Vật tư"}</TableHead>
                    <TableHead className="w-64">Nhà CC</TableHead>
                    <TableHead className="w-24">SL</TableHead>
                    <TableHead className="w-24">ĐV</TableHead>
                    <TableHead className="w-16">Nợ?</TableHead>
                    <TableHead className="w-16">Xóa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const status = rowStatuses[index];
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <SearchableCellPicker
                            options={categoryOptions}
                            placeholder="Chọn hạng mục"
                            value={row.category}
                            onChange={(value) => setRows((current) => updateRow(current, row.id, { category: value }))}
                          />
                        </TableCell>
                        <TableCell>
                          {row.rawMaterialName ? (
                            <div className="mb-1 text-destructive text-xs italic">Gốc: {row.rawMaterialName}</div>
                          ) : null}
                          {materialType === "VT Chính" ? (
                            <>
                              <SearchableCellPicker
                                className={
                                  status?.tone === "success"
                                    ? "border-emerald-500"
                                    : status?.tone === "warning" || status?.tone === "error"
                                      ? "border-destructive"
                                      : "border-primary"
                                }
                                options={mainMaterials}
                                placeholder="Tìm vật tư"
                                value={row.materialName}
                                onChange={(value) =>
                                  setRows((current) => updateRow(current, row.id, { materialName: value }))
                                }
                              />
                              <div
                                className={
                                  status?.tone === "success"
                                    ? "mt-1 font-medium text-emerald-600 text-xs"
                                    : "mt-1 font-medium text-destructive text-xs"
                                }
                              >
                                {status?.message}
                              </div>
                            </>
                          ) : (
                            <Input
                              value={row.materialName}
                              placeholder="Nhập vật tư"
                              onChange={(event) =>
                                setRows((current) => updateRow(current, row.id, { materialName: event.target.value }))
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <SearchableCellPicker
                            options={supplierOptions}
                            placeholder="Chọn NCC"
                            value={row.supplier}
                            onChange={(value) => setRows((current) => updateRow(current, row.id, { supplier: value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            inputMode="decimal"
                            value={row.quantity}
                            onChange={(event) =>
                              setRows((current) => updateRow(current, row.id, { quantity: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <SearchableCellPicker
                            options={unitOptions}
                            placeholder="Đơn vị"
                            value={row.unit}
                            onChange={(value) => setRows((current) => updateRow(current, row.id, { unit: value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={row.debt}
                            onCheckedChange={(checked) =>
                              setRows((current) => updateRow(current, row.id, { debt: checked === true }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      <SectionBlock title={`Danh sách ${materialType}`}>
        <DataTable
          key={`materials-${activeProjectCode}-${materialType}`}
          loading={isSwitchingProject}
          columns={savedMaterialColumns}
          rows={paginatedMaterials.rows}
          getRowId={(row) => row.id}
          serverSide={paginatedMaterials.serverSide}
          detailType="materials"
          selectable
          exportFileName={materialType === "VT Chính" ? "vat-tu-chinh" : "vat-tu-phu"}
          searchPlaceholder="Tìm vật tư, hạng mục, nhà cung cấp..."
          empty={`Chưa có dữ liệu ${materialType}.`}
          filters={[
            { key: "week", label: "Tuần", options: savedMaterialWeekOptions },
            { key: "category", label: "Hạng mục", options: savedMaterialCategoryOptions },
            { key: "supplier", label: "Nhà CC", options: savedMaterialSupplierOptions },
            { key: "paymentStatus", label: "Thanh toán", options: savedMaterialPaymentOptions },
          ]}
          initialSorting={[{ id: "date", desc: true }]}
        />
      </SectionBlock>
    </div>
  );
}
