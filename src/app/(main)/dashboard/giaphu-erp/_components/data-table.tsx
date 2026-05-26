"use client";

import * as React from "react";

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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  accessor?: (row: T) => unknown;
  exportValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
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

function toCsvSafe(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  empty = "Chưa có dữ liệu.",
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Tìm kiếm trong bảng...",
  filters = [],
  exportFileName = "erp-table",
  selectable = false,
  initialSorting = [],
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  empty?: string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  exportFileName?: string;
  selectable?: boolean;
  initialSorting?: SortingState;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [query, setQuery] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>({});

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
    return rows.filter((row) => {
      if (searchable && query.trim()) {
        const normalizedQuery = normalizeText(query);
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
  }, [filterValues, filters, normalizedColumns, query, rows, searchable]);

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
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    table.setPageIndex(0);
  }, [filterValues, query, table]);

  const pageCount = table.getPageCount();
  const visibleRows = table.getRowModel().rows;
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  function exportCsv() {
    const exportColumns = normalizedColumns.filter((column) => table.getColumn(column.key)?.getIsVisible() !== false);
    const header = exportColumns.map((column) => toCsvSafe(column.label)).join(",");
    const body = filteredRows
      .map((row) =>
        exportColumns
          .map((column) => {
            const value = column.exportValue
              ? column.exportValue(row)
              : column.accessor
                ? column.accessor(row)
                : getDefaultAccessor(row, column.key);
            return toCsvSafe(value);
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-md">
                <SlidersHorizontal />
                View
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

          <Button variant="outline" size="sm" className="h-9 rounded-md" onClick={exportCsv}>
            <Download />
            Export
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={(selectionColumn ? 1 : 0) + columns.length} className="h-24 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 p-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          {filteredRows.length.toLocaleString("vi-VN")} dòng
          {selectable ? ` • ${selectedCount.toLocaleString("vi-VN")} đã chọn` : ""}
          {" • "}
          Trang {pageCount ? table.getState().pagination.pageIndex + 1 : 0} / {pageCount || 1}
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
