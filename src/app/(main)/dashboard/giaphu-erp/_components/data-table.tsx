"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { readActiveProjectCode, readActiveProjectRouteId } from "@/lib/giaphu-erp/project-context";
import { getProjectRouteInfo, projectScopedPath } from "@/lib/giaphu-erp/project-routes";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  accessor?: (row: T) => unknown;
  exportValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  headerCellClassName?: string;
  sortable?: boolean;
  searchable?: boolean;
  hideable?: boolean;
}

export interface DataTableFilter<T> {
  key: string;
  label: string;
  allLabel?: string;
  accessor?: (row: T) => unknown;
  options: Array<{ label: string; value: string }>;
}

export interface DataTableServerState {
  pageIndex: number;
  pageSize: number;
  query: string;
  sorting: SortingState;
  filters: Record<string, string>;
}

export interface DataTableServerSideOptions {
  rowCount: number;
  loading?: boolean;
  exportLoading?: boolean;
  filterOptionsLoading?: boolean;
  filterOptions?: Record<string, Array<{ label: string; value: string }>>;
  onFilterOptionsRequest?: () => void;
  onStateChange: (state: DataTableServerState) => void;
  getExportRows?: (state: DataTableServerState) => Promise<unknown[]>;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function getDefaultAccessor<T>(row: T, key: string) {
  if (typeof row === "object" && row !== null && key in (row as object)) {
    return (row as Record<string, unknown>)[key];
  }

  return undefined;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        '[role="checkbox"]',
        '[role="menuitem"]',
        '[data-row-action="true"]',
        '[data-slot="dialog-content"]',
        '[data-slot="dropdown-menu-content"]',
        '[data-slot="popover-content"]',
      ].join(", "),
    ),
  );
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

function getServerStateKey(state: DataTableServerState) {
  return JSON.stringify({
    pageIndex: state.pageIndex,
    pageSize: state.pageSize,
    query: state.query,
    sorting: state.sorting,
    filters: state.filters,
  });
}

function DataTableFilterCombobox({
  filter,
  options,
  loading,
  value,
  onValueChange,
  onOpen,
}: {
  filter: DataTableFilter<unknown>;
  options: Array<{ label: string; value: string }>;
  loading?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const allLabel = filter.allLabel ?? `Tất cả ${filter.label.toLowerCase()}`;
  const selectedOption = options.find((option) => option.value === value);
  const displayValue = value === "__all" ? allLabel : (selectedOption?.label ?? allLabel);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) onOpen?.();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-md px-3 font-normal sm:w-44"
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter>
          <CommandInput placeholder={`Tìm ${filter.label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>{loading ? "Đang tải lựa chọn..." : "Không có lựa chọn phù hợp."}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onValueChange("__all");
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", value === "__all" ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{allLabel}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={`${filter.key}-${option.value}`}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function escapeXml(value: unknown) {
  const cleanedText = Array.from(String(value ?? ""))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20;
    })
    .join("");

  return cleanedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getExcelColumnName(index: number) {
  let columnName = "";
  let nextIndex = index + 1;

  while (nextIndex > 0) {
    const remainder = (nextIndex - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    nextIndex = Math.floor((nextIndex - 1) / 26);
  }

  return columnName;
}

function buildWorksheetXml(headers: string[], rows: Array<Array<unknown>>) {
  const tableRows = [headers, ...rows];
  const columnWidths = headers
    .map((header, index) => {
      const maxLength = tableRows.reduce((currentMax, row) => {
        return Math.max(currentMax, String(row[index] ?? "").length);
      }, String(header).length);

      return `<col min="${index + 1}" max="${index + 1}" width="${Math.min(Math.max(maxLength + 2, 12), 45)}" customWidth="1"/>`;
    })
    .join("");
  const sheetRows = tableRows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          const cellRef = `${getExcelColumnName(columnIndex)}${rowNumber}`;
          const styleId = rowIndex === 0 ? 1 : 0;

          return `<c r="${cellRef}" t="inlineStr" s="${styleId}"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnWidths}</cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function getCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(output: number[], value: number) {
  output.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(output: number[], value: number) {
  output.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function appendBytes(output: number[], bytes: Uint8Array) {
  for (const byte of bytes) output.push(byte);
}

function buildZipFile(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const output: number[] = [];
  const centralDirectory: number[] = [];
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const localHeaderOffset = output.length;
    const crc32 = getCrc32(contentBytes);

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0x0800);
    writeUint16(output, 0);
    writeUint16(output, dosTime);
    writeUint16(output, dosDate);
    writeUint32(output, crc32);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    appendBytes(output, nameBytes);
    appendBytes(output, contentBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0x0800);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, dosTime);
    writeUint16(centralDirectory, dosDate);
    writeUint32(centralDirectory, crc32);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, localHeaderOffset);
    appendBytes(centralDirectory, nameBytes);
  }

  const centralDirectoryOffset = output.length;
  appendBytes(output, new Uint8Array(centralDirectory));
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, centralDirectory.length);
  writeUint32(output, centralDirectoryOffset);
  writeUint16(output, 0);

  return new Uint8Array(output);
}

function buildXlsxBlob(headers: string[], rows: Array<Array<unknown>>) {
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Gia Phú ERP</Application>
</Properties>`,
    },
    {
      name: "docProps/core.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Gia Phú ERP</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Dữ liệu" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Manrope"/></font><font><b/><sz val="11"/><name val="Manrope"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: buildWorksheetXml(headers, rows),
    },
  ];

  return new Blob([buildZipFile(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  empty = "Chưa có dữ liệu.",
  loading = false,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Tìm kiếm trong bảng...",
  filters = [],
  exportFileName = "erp-table",
  selectable = false,
  initialSorting = [],
  enableRowDetails = true,
  detailType,
  rowDetailHref,
  serverSide,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  empty?: string;
  loading?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  exportFileName?: string;
  selectable?: boolean;
  initialSorting?: SortingState;
  enableRowDetails?: boolean;
  detailType?: string;
  rowDetailHref?: (row: T) => string | undefined;
  serverSide?: DataTableServerSideOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isServerSide = Boolean(serverSide);
  const isLoading = loading ? true : (serverSide?.loading ?? false);
  const serverSideOnStateChange = serverSide?.onStateChange;
  const lastServerStateKey = React.useRef("");
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>({});
  const [exporting, setExporting] = React.useState(false);
  const handleSortingChange = React.useCallback<React.Dispatch<React.SetStateAction<SortingState>>>((updater) => {
    setSorting((currentSorting) => {
      const nextSorting = typeof updater === "function" ? updater(currentSorting) : updater;
      setPagination((currentPagination) =>
        currentPagination.pageIndex ? { ...currentPagination, pageIndex: 0 } : currentPagination,
      );
      return nextSorting;
    });
  }, []);

  const normalizedColumns = React.useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        hideable: column.hideable ?? true,
        searchable: column.searchable ?? true,
      })),
    [columns],
  );

  const filteredRows = React.useMemo(() => {
    if (isServerSide) return rows;

    return rows.filter((row) => {
      if (searchable && debouncedQuery.trim()) {
        const normalizedQuery = normalizeText(debouncedQuery);
        const matchesQuery = normalizedColumns.some((column) => {
          if (!column.searchable) return false;
          const value = column.accessor ? column.accessor(row) : getDefaultAccessor(row, column.key);
          return normalizeText(value).includes(normalizedQuery);
        });

        if (!matchesQuery) return false;
      }

      for (const filter of filters) {
        const selectedValue = filterValues[filter.key];
        if (!selectedValue || selectedValue === "__all") continue;

        const sourceValue = filter.accessor ? filter.accessor(row) : getDefaultAccessor(row, filter.key);
        if (String(sourceValue ?? "") !== selectedValue) {
          return false;
        }
      }

      return true;
    });
  }, [debouncedQuery, filterValues, filters, isServerSide, normalizedColumns, rows, searchable]);

  const columnDefs = React.useMemo<ColumnDef<T>[]>(
    () =>
      normalizedColumns.map((column) => {
        const hasDefaultAccessor = rows.some(
          (row) => typeof row === "object" && row !== null && column.key in (row as object),
        );
        const canSort = column.sortable ?? Boolean(column.accessor || hasDefaultAccessor);

        const headerContent = ({
          column: tableColumn,
        }: {
          column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
        }) => {
          if (!canSort) {
            return <span className={cn("font-medium", column.headerClassName)}>{column.label}</span>;
          }

          const sorted = tableColumn.getIsSorted();
          const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

          return (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("-ml-2 h-8 px-2 font-medium hover:bg-transparent", column.headerClassName)}
              onClick={() => tableColumn.toggleSorting(sorted === "asc")}
            >
              {column.label}
              <SortIcon className="size-3.5" />
            </Button>
          );
        };

        if (canSort) {
          return {
            id: column.key,
            accessorFn: (row) => (column.accessor ? column.accessor(row) : getDefaultAccessor(row, column.key)),
            enableSorting: true,
            enableHiding: column.hideable,
            header: headerContent,
            cell: ({ row }) => <div className={column.className}>{column.render(row.original)}</div>,
          } satisfies ColumnDef<T>;
        }

        return {
          id: column.key,
          enableSorting: false,
          enableHiding: column.hideable,
          header: headerContent,
          cell: ({ row }) => <div className={column.className}>{column.render(row.original)}</div>,
        } satisfies ColumnDef<T>;
      }),
    [normalizedColumns, rows],
  );

  const selectionColumn = React.useMemo<ColumnDef<T> | null>(
    () =>
      selectable
        ? {
            id: "__select__",
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
                aria-label="Chọn tất cả"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
                aria-label="Chọn dòng"
              />
            ),
          }
        : null,
    [selectable],
  );

  const table = useReactTable({
    data: filteredRows,
    columns: selectionColumn ? [selectionColumn, ...columnDefs] : columnDefs,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
    enableRowSelection: selectable,
    getRowId: (row) => String(getRowId(row)),
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: isServerSide ? undefined : getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: isServerSide,
    manualSorting: isServerSide,
    rowCount: serverSide?.rowCount,
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    if (!serverSideOnStateChange) return;

    const nextState = {
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      query: debouncedQuery,
      sorting,
      filters: filterValues,
    };
    const nextStateKey = getServerStateKey(nextState);

    if (lastServerStateKey.current === nextStateKey) return;
    lastServerStateKey.current = nextStateKey;
    serverSideOnStateChange(nextState);
  }, [debouncedQuery, filterValues, pagination.pageIndex, pagination.pageSize, serverSideOnStateChange, sorting]);

  const pageCount = table.getPageCount();
  const visibleRows = table.getRowModel().rows;
  const totalRowCount = serverSide?.rowCount ?? filteredRows.length;
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const skeletonColumnCount = (selectionColumn ? 1 : 0) + columns.length;
  const skeletonRows = React.useMemo(
    () => Array.from({ length: pagination.pageSize }, (_, index) => `skeleton-row-${index + 1}`),
    [pagination.pageSize],
  );
  const skeletonColumns = React.useMemo(
    () => Array.from({ length: skeletonColumnCount }, (_, index) => `skeleton-column-${index + 1}`),
    [skeletonColumnCount],
  );

  async function exportExcel() {
    const exportColumns = normalizedColumns.filter(
      (column) => column.key !== "actions" && table.getColumn(column.key)?.getIsVisible() !== false,
    );
    const header = exportColumns.map((column) => column.label);
    const rowsToExport =
      isServerSide && serverSide?.getExportRows
        ? ((await serverSide.getExportRows({
            pageIndex: 0,
            pageSize: Math.max(serverSide.rowCount, 1),
            query: debouncedQuery,
            sorting,
            filters: filterValues,
          })) as T[])
        : filteredRows;
    const body = rowsToExport.map((row) =>
      exportColumns.map((column) =>
        column.exportValue
          ? column.exportValue(row)
          : column.accessor
            ? column.accessor(row)
            : getDefaultAccessor(row, column.key),
      ),
    );
    const blob = buildXlsxBlob(header, body);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileName}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportExcel() {
    if (exporting || serverSide?.exportLoading) return;

    setExporting(true);
    try {
      await exportExcel();
    } finally {
      setExporting(false);
    }
  }

  function getDetailHref(row: T) {
    const customHref = rowDetailHref?.(row);
    if (customHref) return customHref;
    if (!detailType) return undefined;

    const detailPath = `/details/${detailType}/${encodeURIComponent(String(getRowId(row)))}`;
    const projectCode =
      getProjectRouteInfo(pathname)?.projectId || readActiveProjectRouteId() || readActiveProjectCode();

    return projectCode ? projectScopedPath(projectCode, detailPath) : `/dashboard/giaphu-erp${detailPath}`;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {searchable ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPagination((current) => (current.pageIndex ? { ...current, pageIndex: 0 } : current));
                }}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          ) : null}
          {filters.map((filter) => {
            const options = serverSide?.filterOptions?.[filter.key] ?? filter.options;
            return (
              <DataTableFilterCombobox
                key={filter.key}
                filter={filter as DataTableFilter<unknown>}
                options={options}
                loading={serverSide?.filterOptionsLoading}
                value={filterValues[filter.key] ?? "__all"}
                onOpen={serverSide?.onFilterOptionsRequest}
                onValueChange={(value) => {
                  setFilterValues((current) => {
                    const nextValues = { ...current };

                    if (value === "__all") {
                      delete nextValues[filter.key];
                    } else {
                      nextValues[filter.key] = value;
                    }

                    setPagination((current) => (current.pageIndex ? { ...current, pageIndex: 0 } : current));
                    return nextValues;
                  });
                }}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-md">
                <SlidersHorizontal />
                Cột
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {normalizedColumns
                .filter((column) => column.hideable !== false)
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={table.getColumn(column.key)?.getIsVisible() ?? true}
                    onCheckedChange={(value) => table.getColumn(column.key)?.toggleVisibility(Boolean(value))}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-md"
            disabled={exporting || serverSide?.exportLoading}
            onClick={() => void handleExportExcel()}
          >
            <Download />
            {exporting || serverSide?.exportLoading ? "Đang xuất..." : "Xuất Excel"}
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full rounded-md border pb-2">
        <table data-slot="table" className="w-full min-w-max caption-bottom text-sm">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const column = normalizedColumns.find((item) => item.key === header.column.id);

                  return (
                    <TableHead key={header.id} className={column?.headerCellClassName}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              skeletonRows.map((rowKey) => (
                <TableRow key={rowKey} className="h-12">
                  {skeletonColumns.map((columnKey, columnIndex) => (
                    <TableCell key={`${rowKey}-${columnKey}`}>
                      <Skeleton className={cn("h-4", columnIndex === 0 ? "w-24" : "w-full max-w-32")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={enableRowDetails && getDetailHref(row.original) ? "cursor-pointer" : undefined}
                  onClick={(event) => {
                    if (!enableRowDetails || isInteractiveTarget(event.target)) return;
                    const href = getDetailHref(row.original);
                    if (href) router.push(href);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const column = normalizedColumns.find((item) => item.key === cell.column.id);

                    return (
                      <TableCell key={cell.id} className={column?.cellClassName}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={skeletonColumnCount} className="h-24 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </ScrollArea>

      <div className="flex flex-col gap-4 p-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          {isLoading ? "Đang tải dữ liệu..." : `${totalRowCount.toLocaleString("vi-VN")} dòng`}
          {selectable ? ` • ${selectedCount.toLocaleString("vi-VN")} đã chọn` : ""}
          {isLoading ? "" : ` • Trang ${pageCount ? table.getState().pagination.pageIndex + 1 : 0} / ${pageCount || 1}`}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm">Hiển thị</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              aria-label="Trang đầu"
              variant="outline"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft />
            </Button>
            <Button
              aria-label="Trang trước"
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              aria-label="Trang sau"
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight />
            </Button>
            <Button
              aria-label="Trang cuối"
              variant="outline"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
