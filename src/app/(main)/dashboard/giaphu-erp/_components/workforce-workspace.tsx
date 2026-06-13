"use client";

import * as React from "react";

import {
  CalendarCheck,
  Check,
  ChevronsUpDown,
  ClipboardList,
  HardHat,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { AttendanceRow, LaborNormRow, ProgressRow, ProjectRow, StaffRow } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { currentIsoWeek, isoWeekFromDate, todayIso } from "../_lib/date-utils";
import { catalogOptions, catalogOptionsWithValue, catalogOptionsWithValues, uniqueOptions } from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import type { GiaPhuActionResult } from "../_lib/giaphu-erp-api";
import { ActionDialog } from "./action-dialog";
import { DataTable, type DataTableColumn } from "./data-table";
import { DatePickerField } from "./date-picker-field";
import { ExcelImportDialog } from "./excel-import-dialog";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type WorkforceSection = "attendance" | "payroll" | "payslips" | "staff" | "laborNorms" | "progress";

const weekDayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const staffComboboxRenderLimit = 40;
const attendanceShiftOptions = [
  { key: "morning", label: "Sáng", shortLabel: "S", shift: "Sáng", status: "Sáng", coefficient: 0.5 },
  { key: "afternoon", label: "Chiều", shortLabel: "C", shift: "Chiều", status: "Chiều", coefficient: 0.5 },
] as const;

type AttendanceShiftKey = (typeof attendanceShiftOptions)[number]["key"];
type AttendanceCellDraft = Record<AttendanceShiftKey, boolean>;
type AttendanceExtraDraft = {
  allowance: number;
  overtimeHours: number;
};
type AttendanceBoardRow = StaffRow;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAttendanceShiftKey(row?: AttendanceRow): AttendanceShiftKey | null {
  if (!row) return null;
  const statusText = normalizeSearchText(`${row.status} ${row.shift}`);

  if (statusText.includes("sang")) return "morning";
  if (statusText.includes("chieu")) return "afternoon";
  return null;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWeekDates(weekValue: string) {
  const [weekText, yearText] = weekValue.split(".");
  const week = Number(weekText);
  const year = Number(yearText);

  if (!week || !year) {
    const today = new Date(`${todayIso()}T00:00:00`);
    const day = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return isoDate(date);
    });
  }

  const janFourth = new Date(year, 0, 4);
  const janFourthDay = janFourth.getDay() || 7;
  const firstMonday = new Date(janFourth);
  firstMonday.setDate(janFourth.getDate() - janFourthDay + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + (week - 1) * 7 + index);
    return isoDate(date);
  });
}

function defaultAttendanceAnchorDate() {
  return getWeekDates(currentIsoWeek())[0] ?? todayIso();
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

type DraftAttendanceParticipant = {
  id: string;
  week: string;
  category: string;
  staff: StaffRow;
};

type PayrollRow = {
  id: string;
  stt: number;
  week: string;
  category: string;
  staffName: string;
  position: string;
  shiftCount: number;
  workdays: number;
  salaryDay: number;
  baseSalary: number;
  allowance: number;
  overtimeHours: number;
  overtimeAmount: number;
  total: number;
  dates: string;
};

function formatPayrollMoney(value: number) {
  return formatCount(value, 0);
}

function escapePrintText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPrintDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}

function getPayslipDateRange(row: PayrollRow) {
  const dates = row.dates
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean)
    .sort();

  if (!dates.length) return "";
  if (dates[0] === dates[dates.length - 1]) return formatPrintDate(dates[0]);

  return `${formatPrintDate(dates[0])} - ${formatPrintDate(dates[dates.length - 1])}`;
}

function printPayslipRows(
  rows: PayrollRow[],
  title = "Phiếu lương nhân công tuần",
  project?: Pick<ProjectRow, "code" | "name">,
) {
  if (!rows.length) return;

  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) return;

  const projectLabel = project ? `${project.code} - ${project.name}` : "";
  const payslipCards = rows
    .map(
      (row, index) => `
        <article class="payslip">
          <header class="payslip-header">
            <div class="company">CTY TVTK-TMĐV GIA PHÚ</div>
            <h1>${escapePrintText(title)}</h1>
            <div class="meta">
              ${projectLabel ? `CT: ${escapePrintText(projectLabel)} - ` : ""}Tuần ${escapePrintText(row.week)}
              ${getPayslipDateRange(row) ? ` - ${escapePrintText(getPayslipDateRange(row))}` : ""}
            </div>
            <div class="meta">HM: ${escapePrintText(row.category || "-")} - STT: ${row.stt || index + 1}</div>
          </header>
          <table class="payslip-table">
            <tbody>
              <tr>
                <th>Họ tên</th>
                <td colspan="3" class="name">${escapePrintText(row.staffName)}</td>
              </tr>
              <tr>
                <th>Ngày công</th>
                <td class="value">${formatCount(row.workdays)} công</td>
                <th>Tăng ca</th>
                <td class="value">${formatPayrollMoney(row.overtimeAmount)}</td>
              </tr>
              <tr>
                <th>Phụ cấp</th>
                <td class="value">${formatPayrollMoney(row.allowance)}</td>
                <th>Thành tiền</th>
                <td class="value total">${formatPayrollMoney(row.total)}</td>
              </tr>
            </tbody>
          </table>
          <footer class="payslip-footer">
            <div>
              <div class="signature-line"></div>
              <div>Người lập phiếu</div>
            </div>
            <div>
              <div class="signature-line"></div>
              <div>Người nhận</div>
            </div>
          </footer>
        </article>`,
    )
    .join("");

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapePrintText(title)}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4 landscape; margin: 8mm; }
          body {
            margin: 0;
            color: #003f4b;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
          }
          .payslip-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .payslip {
            min-height: 158px;
            border: 1px solid #111827;
            border-radius: 6px;
            padding: 7px 10px 8px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .payslip-header {
            text-align: center;
            line-height: 1.1;
          }
          .company {
            font-weight: 700;
            font-size: 11px;
            letter-spacing: .02em;
          }
          h1 {
            margin: 1px 0 2px;
            color: #004f60;
            font-size: 17px;
            line-height: 1;
            text-transform: uppercase;
          }
          .meta {
            color: #1f2937;
            font-size: 8px;
          }
          .payslip-table {
            width: 100%;
            margin-top: 10px;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .payslip-table th,
          .payslip-table td {
            border: 1px solid #213547;
            padding: 5px 7px;
            vertical-align: middle;
          }
          .payslip-table th {
            width: 22%;
            background: #eef8f6;
            color: #004f60;
            font-weight: 700;
            text-align: left;
          }
          .payslip-table td {
            color: #003f4b;
            font-weight: 700;
          }
          .payslip-table .value {
            text-align: right;
          }
          .payslip-table .total {
            color: #007066;
          }
          .payslip-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 48px;
            margin-top: 8px;
            color: #1f2937;
            text-align: center;
            font-size: 8px;
          }
          .signature-line {
            border-top: 1px dotted #111827;
            height: 6px;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <main class="payslip-grid">${payslipCards}</main>
      </body>
    </html>
  `);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

function buildAttendanceParticipants(attendance: AttendanceRow[], draftStaff: StaffRow[]) {
  const staffMap = new Map<string, StaffRow>();

  for (const row of draftStaff) {
    staffMap.set(row.name, row);
  }

  for (const row of attendance) {
    if (!staffMap.has(row.staffName)) {
      staffMap.set(row.staffName, {
        id: row.staffName,
        name: row.staffName,
        team: "",
        position: row.position,
        salaryDay: row.halfDaySalary,
        resigned: false,
        offDate: "",
      });
    }
  }

  return Array.from(staffMap.values()).sort((first, second) => first.name.localeCompare(second.name, "vi"));
}

function buildPayrollRows(rows: AttendanceRow[]) {
  const payrollMap = new Map<string, PayrollRow & { dateSet: Set<string> }>();

  for (const row of rows) {
    const key = [row.week, row.category, row.staffName].join("::");
    const current = payrollMap.get(key) ?? {
      id: key,
      week: row.week,
      category: row.category,
      staffName: row.staffName,
      stt: 0,
      position: row.position,
      shiftCount: 0,
      workdays: 0,
      salaryDay: 0,
      baseSalary: 0,
      allowance: 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      total: 0,
      dates: "",
      dateSet: new Set<string>(),
    };

    current.position = current.position || row.position;
    current.shiftCount += 1;
    current.workdays += Number(row.coefficient || 0);
    current.salaryDay = Math.max(current.salaryDay, Number(row.halfDaySalary || 0));
    current.allowance += Number(row.allowance || 0);
    current.overtimeHours += Number(row.overtimeHours || 0);
    current.overtimeAmount += Number(row.overtimeAmount || 0);
    current.baseSalary += Math.max(
      0,
      Number(row.total || 0) - Number(row.allowance || 0) - Number(row.overtimeAmount || 0),
    );
    current.total += Number(row.total || 0);
    if (row.date) current.dateSet.add(row.date);

    payrollMap.set(key, current);
  }

  return Array.from(payrollMap.values())
    .map(({ dateSet, ...row }) => ({
      ...row,
      dates: Array.from(dateSet).sort().join(", "),
    }))
    .sort((first, second) => {
      const weekCompare = second.week.localeCompare(first.week, "vi");
      if (weekCompare !== 0) return weekCompare;
      const categoryCompare = first.category.localeCompare(second.category, "vi");
      if (categoryCompare !== 0) return categoryCompare;
      return first.staffName.localeCompare(second.staffName, "vi");
    })
    .map((row, index) => ({ ...row, stt: index + 1 }));
}

function dateTimeFromInput(value: unknown) {
  const dateText = String(value ?? "").slice(0, 10);
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function validateProgressStartDate(value: string, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(value);
  const planEndDate = dateTimeFromInput(payload.planEndDate);
  const confirmedEndDate = dateTimeFromInput(payload.confirmedEndDate);

  if (!startDate) return "Ngày bắt đầu không hợp lệ.";
  if (planEndDate && planEndDate < startDate) return "Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.";
  if (confirmedEndDate && confirmedEndDate < startDate) return "Ngày HT xác nhận không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateProgressPlanEndDate(value: string, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(payload.startDate);
  const planEndDate = dateTimeFromInput(value);

  if (!planEndDate) return "Ngày HT dự kiến không hợp lệ.";
  if (startDate && planEndDate < startDate) return "Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateProgressConfirmedEndDate(value: string, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(payload.startDate);
  const planEndDate = dateTimeFromInput(payload.planEndDate);
  const confirmedEndDate = dateTimeFromInput(value);

  if (!confirmedEndDate) return "Ngày HT xác nhận không hợp lệ.";
  if (planEndDate && confirmedEndDate < planEndDate) {
    return "Ngày HT xác nhận không được nhỏ hơn ngày HT dự kiến.";
  }
  if (startDate && confirmedEndDate < startDate) return "Ngày HT xác nhận không được nhỏ hơn ngày bắt đầu.";

  return undefined;
}

function validateStaffOffDate(value: string, payload: Record<string, unknown>) {
  if (payload.resigned === true && !value) {
    return "Vui lòng chọn thời gian nghỉ khi đánh dấu nhân sự đã nghỉ việc.";
  }

  return undefined;
}

function shouldShowStaffOffDate(payload: Record<string, unknown>) {
  return payload.resigned === true;
}

function defaultStaffOffDate(payload: Record<string, unknown>) {
  return payload.resigned === true ? todayIso() : undefined;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

function StaffSearchCombobox({
  values,
  onValuesChange,
  options,
  disabled,
}: {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: StaffRow[];
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);
  const selectedNames = React.useMemo(() => new Set(values), [values]);
  const selectedLabel =
    values.length === 0
      ? "Tìm và chọn nhân công"
      : values.length === 1
        ? values[0]
        : `Đã chọn ${values.length} nhân công`;
  const { visibleOptions, hiddenCount } = React.useMemo(() => {
    const term = normalizeSearchText(debouncedSearch);
    const matchedOptions = term
      ? options.filter((option) =>
          normalizeSearchText(
            [option.name, option.team, option.position, option.id].filter(Boolean).join(" "),
          ).includes(term),
        )
      : options;

    return {
      visibleOptions: matchedOptions.slice(0, staffComboboxRenderLimit),
      hiddenCount: Math.max(0, matchedOptions.length - staffComboboxRenderLimit),
    };
  }, [debouncedSearch, options]);

  function toggleValue(name: string) {
    const nextValues = selectedNames.has(name) ? values.filter((value) => value !== name) : [...values, name];
    onValuesChange(nextValues);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className={cn("truncate", !values.length && "text-muted-foreground")}>{selectedLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Tìm theo tên, đội, chức vụ..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy nhân công.</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.id || option.name}
                  value={option.name}
                  onSelect={() => {
                    toggleValue(option.name);
                  }}
                >
                  <Checkbox
                    checked={selectedNames.has(option.name)}
                    tabIndex={-1}
                    className="pointer-events-none mr-1"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{option.name}</div>
                    <div className="truncate text-muted-foreground text-xs">
                      {[option.team, option.position].filter(Boolean).join(" · ") || "Chưa có đội/chức vụ"}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {hiddenCount > 0 ? (
              <div className="px-3 py-2 text-muted-foreground text-xs">Nhập thêm từ khóa để lọc nhanh hơn.</div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getAttendanceCellDraft(rows: AttendanceRow[]): AttendanceCellDraft {
  return {
    morning: rows.some((row) => getAttendanceShiftKey(row) === "morning"),
    afternoon: rows.some((row) => getAttendanceShiftKey(row) === "afternoon"),
  };
}

function attendanceCellKey(staffName: string, date: string) {
  return `${staffName}::${date}`;
}

function attendanceStaffKey(staffName: string) {
  return staffName;
}

function countAttendanceWorkdays(cells: AttendanceCellDraft[]) {
  return cells.reduce((total, cell) => total + (cell.morning ? 0.5 : 0) + (cell.afternoon ? 0.5 : 0), 0);
}

function formatAttendanceCellDraft(cell: AttendanceCellDraft) {
  if (cell.morning && cell.afternoon) return "Sáng + Chiều";
  if (cell.morning) return "Sáng";
  if (cell.afternoon) return "Chiều";
  return "";
}

function getAttendanceExtraDraft(rows: AttendanceRow[]): AttendanceExtraDraft {
  return rows.reduce(
    (total, row) => ({
      allowance: total.allowance + Number(row.allowance || 0),
      overtimeHours: total.overtimeHours + Number(row.overtimeHours || 0),
    }),
    { allowance: 0, overtimeHours: 0 },
  );
}

function AttendanceBoard({
  rows,
  staff,
  categoryOptions,
  activeCategoryValues,
  activeProjectCode,
  canManage,
  loading,
  onAction,
}: {
  rows: AttendanceRow[];
  staff: StaffRow[];
  categoryOptions: Array<{ label: string; value: string }>;
  activeCategoryValues: string[];
  activeProjectCode: string;
  canManage: boolean;
  loading: boolean;
  onAction: (
    action: string,
    payload: Record<string, unknown>,
  ) => Promise<GiaPhuActionResult | false | boolean | undefined>;
}) {
  const defaultAnchorDate = React.useMemo(() => defaultAttendanceAnchorDate(), []);
  const [anchorDate, setAnchorDate] = React.useState(defaultAnchorDate);
  const [selectedWeek, setSelectedWeek] = React.useState(() => isoWeekFromDate(defaultAnchorDate) || currentIsoWeek());
  const [selectedCategory, setSelectedCategory] = React.useState(categoryOptions[0]?.value || "");
  const [selectedStaffNames, setSelectedStaffNames] = React.useState<string[]>([]);
  const [draftParticipants, setDraftParticipants] = React.useState<DraftAttendanceParticipant[]>([]);
  const [draftCells, setDraftCells] = React.useState<Record<string, AttendanceCellDraft>>({});
  const [draftExtras, setDraftExtras] = React.useState<Record<string, AttendanceExtraDraft>>({});
  const [dirtyStaffNames, setDirtyStaffNames] = React.useState<Set<string>>(new Set());
  const [savingStaffName, setSavingStaffName] = React.useState("");
  const [deletingStaffName, setDeletingStaffName] = React.useState("");
  const selectedCategoryIsActive = React.useMemo(
    () => activeCategoryValues.includes(selectedCategory),
    [activeCategoryValues, selectedCategory],
  );

  const applyAnchorDate = React.useCallback((value: string) => {
    const nextDate = value.slice(0, 10);
    const nextWeek = isoWeekFromDate(nextDate);
    if (!nextWeek) return;

    setAnchorDate(nextDate);
    setSelectedWeek(nextWeek);
  }, []);

  React.useEffect(() => {
    if (categoryOptions.length === 0) {
      setSelectedCategory("");
      return;
    }

    if (!selectedCategory || !categoryOptions.some((option) => option.value === selectedCategory)) {
      setSelectedCategory(categoryOptions[0].value);
    }
  }, [categoryOptions, selectedCategory]);

  React.useEffect(() => {
    if (!selectedCategory && !selectedWeek) return;

    setDraftCells({});
    setDraftExtras({});
    setDirtyStaffNames(new Set());
    setSelectedStaffNames([]);
  }, [selectedCategory, selectedWeek]);

  const weekDates = React.useMemo(() => getWeekDates(selectedWeek), [selectedWeek]);
  const filteredRows = React.useMemo(
    () => rows.filter((row) => row.week === selectedWeek && row.category === selectedCategory),
    [rows, selectedCategory, selectedWeek],
  );
  const visibleDraftParticipants = React.useMemo(
    () =>
      draftParticipants.filter(
        (participant) => participant.week === selectedWeek && participant.category === selectedCategory,
      ),
    [draftParticipants, selectedCategory, selectedWeek],
  );
  const boardRows = React.useMemo(
    () =>
      buildAttendanceParticipants(
        filteredRows,
        visibleDraftParticipants.map((participant) => participant.staff),
      ),
    [filteredRows, visibleDraftParticipants],
  );
  const rowByCell = React.useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();

    for (const row of filteredRows) {
      const key = attendanceCellKey(row.staffName, row.date);
      map.set(key, [...(map.get(key) ?? []), row]);
    }

    return map;
  }, [filteredRows]);
  const rowByStaff = React.useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();

    for (const row of filteredRows) {
      const key = attendanceStaffKey(row.staffName);
      map.set(key, [...(map.get(key) ?? []), row]);
    }

    return map;
  }, [filteredRows]);
  const availableStaff = React.useMemo(() => {
    const participantNames = new Set(boardRows.map((row) => row.name));

    return staff
      .filter((row) => !row.resigned && !participantNames.has(row.name))
      .sort((first, second) => first.name.localeCompare(second.name, "vi"));
  }, [boardRows, staff]);

  React.useEffect(() => {
    const availableNames = new Set(availableStaff.map((row) => row.name));
    setSelectedStaffNames((current) => current.filter((name) => availableNames.has(name)));
  }, [availableStaff]);

  const getCurrentCellDraft = React.useCallback(
    (staffName: string, date: string) => {
      const key = attendanceCellKey(staffName, date);
      return draftCells[key] ?? getAttendanceCellDraft(rowByCell.get(key) ?? []);
    },
    [draftCells, rowByCell],
  );

  const getCurrentStaffExtras = React.useCallback(
    (staffName: string) => {
      const key = attendanceStaffKey(staffName);
      return draftExtras[key] ?? getAttendanceExtraDraft(rowByStaff.get(key) ?? []);
    },
    [draftExtras, rowByStaff],
  );

  function addParticipants() {
    const staffRows = selectedStaffNames
      .map((name) => staff.find((row) => row.name === name))
      .filter((row): row is StaffRow => Boolean(row));

    if (!staffRows.length || !selectedCategory || !selectedCategoryIsActive) return;

    setDraftParticipants((current) => {
      const currentIds = new Set(current.map((participant) => participant.id));
      const nextParticipants = staffRows
        .map((staffRow) => ({
          id: [selectedWeek, selectedCategory, staffRow.name].join("::"),
          week: selectedWeek,
          category: selectedCategory,
          staff: staffRow,
        }))
        .filter((participant) => !currentIds.has(participant.id));

      return nextParticipants.length ? [...current, ...nextParticipants] : current;
    });
    setSelectedStaffNames([]);
  }

  const updateCell = React.useCallback(
    (staffName: string, date: string, key: AttendanceShiftKey, checked: boolean) => {
      if (!canManage) return;

      const cellKey = attendanceCellKey(staffName, date);
      const baseDraft = draftCells[cellKey] ?? getAttendanceCellDraft(rowByCell.get(cellKey) ?? []);
      setDraftCells((current) => ({
        ...current,
        [cellKey]: {
          ...baseDraft,
          [key]: checked,
        },
      }));
      setDirtyStaffNames((current) => new Set(current).add(staffName));
    },
    [canManage, draftCells, rowByCell],
  );

  const updateStaffExtra = React.useCallback(
    (staffName: string, key: keyof AttendanceExtraDraft, value: number) => {
      if (!canManage) return;

      const staffKey = attendanceStaffKey(staffName);
      setDraftExtras((current) => {
        const baseDraft = current[staffKey] ?? getAttendanceExtraDraft(rowByStaff.get(staffKey) ?? []);

        return {
          ...current,
          [staffKey]: {
            ...baseDraft,
            [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
          },
        };
      });
      setDirtyStaffNames((current) => new Set(current).add(staffName));
    },
    [canManage, rowByStaff],
  );

  const saveStaffAttendance = React.useCallback(
    async (staffRow: AttendanceBoardRow) => {
      if (!canManage || !selectedCategory || savingStaffName) return;

      setSavingStaffName(staffRow.name);
      const salaryDay = Math.max(0, Math.round(Number(staffRow.salaryDay || 0)));
      const staffExtras = getCurrentStaffExtras(staffRow.name);
      const overtimeAmount = Math.round(staffExtras.overtimeHours * (salaryDay / 8));
      const selectedRows = weekDates.flatMap((date) => {
        const draft = getCurrentCellDraft(staffRow.name, date);

        return attendanceShiftOptions
          .filter((option) => draft[option.key])
          .map((option) => ({
            projectCode: activeProjectCode,
            date,
            week: selectedWeek,
            shift: option.shift,
            category: selectedCategory,
            staffName: staffRow.name,
            position: staffRow.position || "Nhân công",
            halfDaySalary: salaryDay,
            allowance: 0,
            overtimeHours: 0,
            overtimeAmount: 0,
            coefficient: option.coefficient,
            total: Math.round(salaryDay * option.coefficient),
            status: option.status,
          }));
      });
      const payloadRows = selectedRows.map((row, index) => ({
        ...row,
        allowance: index === 0 ? staffExtras.allowance : 0,
        overtimeHours: index === 0 ? staffExtras.overtimeHours : 0,
        overtimeAmount: index === 0 ? overtimeAmount : 0,
        total: row.total + (index === 0 ? staffExtras.allowance + overtimeAmount : 0),
      }));

      const result = await onAction("saveStaffWeeklyAttendance", {
        projectCode: activeProjectCode,
        week: selectedWeek,
        category: selectedCategory,
        staffName: staffRow.name,
        rows: payloadRows,
        __returnData: false,
      });
      setSavingStaffName("");

      if (result !== false) {
        setDirtyStaffNames((current) => {
          const next = new Set(current);
          next.delete(staffRow.name);
          return next;
        });
        setDraftCells((current) => {
          const next = { ...current };
          for (const date of weekDates) delete next[attendanceCellKey(staffRow.name, date)];
          return next;
        });
        setDraftExtras((current) => {
          const next = { ...current };
          delete next[attendanceStaffKey(staffRow.name)];
          return next;
        });
        setDraftParticipants((current) => current.filter((participant) => participant.staff.name !== staffRow.name));
      }
    },
    [
      activeProjectCode,
      canManage,
      getCurrentCellDraft,
      getCurrentStaffExtras,
      onAction,
      savingStaffName,
      selectedCategory,
      selectedWeek,
      weekDates,
    ],
  );

  const clearStaffDraft = React.useCallback(
    (staffName: string) => {
      setDirtyStaffNames((current) => {
        const next = new Set(current);
        next.delete(staffName);
        return next;
      });
      setDraftCells((current) => {
        const next = { ...current };
        for (const date of weekDates) delete next[attendanceCellKey(staffName, date)];
        return next;
      });
      setDraftExtras((current) => {
        const next = { ...current };
        delete next[attendanceStaffKey(staffName)];
        return next;
      });
      setDraftParticipants((current) => current.filter((participant) => participant.staff.name !== staffName));
    },
    [weekDates],
  );

  const deleteStaffAttendance = React.useCallback(
    async (staffRow: AttendanceBoardRow) => {
      if (!canManage || !selectedCategory || deletingStaffName || savingStaffName) return;

      const existingRows = rowByStaff.get(staffRow.name) ?? [];
      const hasDraftRow = visibleDraftParticipants.some((participant) => participant.staff.name === staffRow.name);
      if (!existingRows.length && hasDraftRow) {
        clearStaffDraft(staffRow.name);
        return;
      }

      if (!existingRows.length) return;
      if (!window.confirm(`Xóa chấm công của "${staffRow.name}" trong tuần ${selectedWeek}?`)) return;

      setDeletingStaffName(staffRow.name);
      const result = await onAction("saveStaffWeeklyAttendance", {
        projectCode: activeProjectCode,
        week: selectedWeek,
        category: selectedCategory,
        staffName: staffRow.name,
        rows: [],
        __returnData: false,
      });
      setDeletingStaffName("");

      if (result !== false) {
        clearStaffDraft(staffRow.name);
      }
    },
    [
      activeProjectCode,
      canManage,
      clearStaffDraft,
      deletingStaffName,
      onAction,
      rowByStaff,
      savingStaffName,
      selectedCategory,
      selectedWeek,
      visibleDraftParticipants,
    ],
  );

  const getStaffWorkdays = React.useCallback(
    (row: AttendanceBoardRow) => {
      return countAttendanceWorkdays(weekDates.map((date) => getCurrentCellDraft(row.name, date)));
    },
    [getCurrentCellDraft, weekDates],
  );

  const getStaffTotal = React.useCallback(
    (row: AttendanceBoardRow) => {
      const salaryDay = Number(row.salaryDay || 0);
      const extras = getCurrentStaffExtras(row.name);
      return Math.round(getStaffWorkdays(row) * salaryDay + extras.allowance + extras.overtimeHours * (salaryDay / 8));
    },
    [getCurrentStaffExtras, getStaffWorkdays],
  );

  const columns = React.useMemo<DataTableColumn<AttendanceBoardRow>[]>(
    () => [
      {
        key: "staff",
        label: "Nhân sự",
        sortable: true,
        searchable: true,
        accessor: (row) => `${row.name} ${row.team} ${row.position}`,
        className: "min-w-56",
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate font-semibold">{row.name}</div>
            <div className="truncate text-muted-foreground text-xs">
              {[row.team, row.position].filter(Boolean).join(" · ") || "Nhân công"}
            </div>
            <div className="text-emerald-700 text-xs">{formatMoney(row.salaryDay)}/ngày</div>
          </div>
        ),
      },
      ...weekDates.map<DataTableColumn<AttendanceBoardRow>>((date, index) => ({
        key: `date-${date}`,
        label: `${weekDayLabels[index]} ${formatShortDate(date)}`,
        className: "min-w-32",
        headerClassName: "text-center",
        accessor: (row) => formatAttendanceCellDraft(getCurrentCellDraft(row.name, date)),
        exportValue: (row) => formatAttendanceCellDraft(getCurrentCellDraft(row.name, date)),
        render: (row) => {
          const draft = getCurrentCellDraft(row.name, date);

          return (
            <div className="flex justify-center gap-2">
              {attendanceShiftOptions.map((option) => (
                <div
                  key={option.key}
                  className="flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs"
                >
                  <span>{option.shortLabel}</span>
                  <Checkbox
                    checked={draft[option.key]}
                    disabled={!canManage}
                    onCheckedChange={(checked) => updateCell(row.name, date, option.key, checked === true)}
                  />
                </div>
              ))}
            </div>
          );
        },
      })),
      {
        key: "allowance",
        label: "Phụ cấp",
        className: "min-w-32",
        render: (row) => {
          const extras = getCurrentStaffExtras(row.name);

          return (
            <Input
              disabled={!canManage}
              min={0}
              type="number"
              defaultValue={extras.allowance}
              onChange={(event) => updateStaffExtra(row.name, "allowance", Number(event.target.value))}
              className="h-8 text-right"
            />
          );
        },
        exportValue: (row) => getCurrentStaffExtras(row.name).allowance,
      },
      {
        key: "overtimeHours",
        label: "OT giờ",
        className: "min-w-28",
        render: (row) => {
          const extras = getCurrentStaffExtras(row.name);

          return (
            <Input
              disabled={!canManage}
              min={0}
              step={0.5}
              type="number"
              defaultValue={extras.overtimeHours}
              onChange={(event) => updateStaffExtra(row.name, "overtimeHours", Number(event.target.value))}
              className="h-8 text-right"
            />
          );
        },
        exportValue: (row) => getCurrentStaffExtras(row.name).overtimeHours,
      },
      {
        key: "total",
        label: "Tổng",
        sortable: true,
        className: "min-w-32 text-right",
        headerClassName: "text-right",
        accessor: (row) => getStaffTotal(row),
        render: (row) => (
          <div className="text-right">
            <Badge variant="outline" className="mb-1 rounded-full">
              {formatCount(getStaffWorkdays(row))} công
            </Badge>
            <div className="font-semibold">{formatMoney(getStaffTotal(row))}</div>
          </div>
        ),
        exportValue: (row) => getStaffTotal(row),
      },
      {
        key: "actions",
        label: "Thao tác",
        className: "min-w-40 text-right",
        headerClassName: "text-right",
        hideable: false,
        render: (row) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              type="button"
              disabled={!canManage || !dirtyStaffNames.has(row.name) || Boolean(savingStaffName || deletingStaffName)}
              onClick={() => saveStaffAttendance(row)}
            >
              <Check />
              {savingStaffName === row.name ? "Đang lưu" : "Lưu"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={!canManage || Boolean(savingStaffName || deletingStaffName)}
              onClick={() => deleteStaffAttendance(row)}
            >
              {deletingStaffName === row.name ? <RefreshCw className="animate-spin" /> : <Trash2 />}
              Xóa
            </Button>
          </div>
        ),
      },
    ],
    [
      canManage,
      deleteStaffAttendance,
      deletingStaffName,
      dirtyStaffNames,
      getCurrentCellDraft,
      getCurrentStaffExtras,
      getStaffTotal,
      getStaffWorkdays,
      saveStaffAttendance,
      savingStaffName,
      updateCell,
      updateStaffExtra,
      weekDates,
    ],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="grid gap-3 sm:grid-cols-[140px_224px_220px]">
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Tuần</div>
            <Input value={selectedWeek} readOnly className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Hạng mục</div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Chọn hạng mục" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Ngày neo trong tuần (thường T2)</div>
            <DatePickerField
              name="attendanceAnchorDate"
              value={anchorDate}
              placeholder="Chọn ngày neo"
              className="h-9"
              onValueChange={applyAnchorDate}
            />
          </div>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-[minmax(16rem,20rem)_auto] sm:items-end xl:w-auto xl:justify-end">
          <div className="w-full space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Thêm nhân công</div>
            <StaffSearchCombobox
              values={selectedStaffNames}
              onValuesChange={setSelectedStaffNames}
              options={availableStaff}
              disabled={!canManage || availableStaff.length === 0 || !selectedCategory || !selectedCategoryIsActive}
            />
            {!selectedCategoryIsActive && selectedCategory ? (
              <div className="text-muted-foreground text-xs">Hạng mục đã lưu trữ: chỉ cho sửa/xóa dữ liệu cũ.</div>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canManage || !selectedStaffNames.length || !selectedCategory || !selectedCategoryIsActive}
            onClick={addParticipants}
            className="h-9"
          >
            <Users />
            {selectedStaffNames.length > 1 ? `Thêm (${selectedStaffNames.length})` : "Thêm"}
          </Button>
        </div>
      </div>

      <DataTable
        key={`attendance-${selectedWeek}-${selectedCategory}`}
        columns={columns}
        rows={boardRows}
        getRowId={(row) => row.id || row.name}
        loading={loading}
        pageSize={10}
        empty={selectedCategory ? "Chưa có nhân công trong tuần này." : "Chọn hạng mục để chấm công."}
        searchPlaceholder="Tìm nhân công..."
        exportFileName="cham-cong-nhan-cong"
        enableRowDetails={false}
      />
    </div>
  );
}

export function WorkforceWorkspace({ section = "attendance" }: { section?: WorkforceSection }) {
  const { data, activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const paginatedStaff = usePaginatedErpRows<StaffRow>({
    dataset: "staff",
    projectCode: "",
    initialRows: data.staff,
    enabled: section === "staff",
  });
  const paginatedLaborNorms = usePaginatedErpRows<LaborNormRow>({
    dataset: "laborNorms",
    projectCode: activeProjectCode,
    initialRows: scoped.laborNorms,
    enabled: section === "laborNorms",
  });
  const paginatedProgress = usePaginatedErpRows<ProgressRow>({
    dataset: "progress",
    projectCode: activeProjectCode,
    initialRows: scoped.progress,
    enabled: section === "progress",
  });
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const attendanceBoardCategoryOptions = React.useMemo(
    () =>
      catalogOptionsWithValues(
        data.catalogs.hangMuc,
        scoped.attendance.map((row) => row.category),
      ),
    [data.catalogs.hangMuc, scoped.attendance],
  );
  const activeCategoryValues = React.useMemo(
    () => data.catalogs.hangMuc.filter((item) => !item.archived).map((item) => item.name),
    [data.catalogs.hangMuc],
  );
  const staffTeamOptions = uniqueOptions(data.staff.map((row) => row.team));
  const staffPositionOptions = uniqueOptions(data.staff.map((row) => row.position));
  const laborNormCategoryOptions = uniqueOptions(scoped.laborNorms.map((row) => row.category));
  const progressCategoryOptions = uniqueOptions(scoped.progress.map((row) => row.category));
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.workforceManage);
  const activeProject = React.useMemo(
    () => data.projects.find((project) => project.code === activeProjectCode || project.id === activeProjectCode),
    [activeProjectCode, data.projects],
  );
  const payrollRows = React.useMemo(() => buildPayrollRows(scoped.attendance), [scoped.attendance]);
  const attendanceWeekOptions = React.useMemo(
    () => uniqueOptions(scoped.attendance.map((row) => row.week)),
    [scoped.attendance],
  );
  const attendanceCategoryOptions = React.useMemo(
    () => uniqueOptions(scoped.attendance.map((row) => row.category)),
    [scoped.attendance],
  );
  const attendanceStaffOptions = React.useMemo(
    () => uniqueOptions(scoped.attendance.map((row) => row.staffName)),
    [scoped.attendance],
  );

  async function runLaborNormAction(action: string, payload: Record<string, unknown>) {
    const result = await runAction(action, { ...payload, __returnData: false });
    if (result) paginatedLaborNorms.refresh();
    return result;
  }

  async function runProgressAction(action: string, payload: Record<string, unknown>) {
    const result = await runAction(action, { ...payload, __returnData: false });
    if (result) paginatedProgress.refresh();
    return result;
  }

  const actions = {
    attendance: (
      <>
        <ActionDialog
          title="Kết sổ chấm công"
          button="Kết sổ"
          icon={ShieldCheck}
          action="closeAttendance"
          onAction={runAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "week", label: "Tuần", value: currentIsoWeek(), required: true },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "by", label: "Người kết sổ", value: "Admin" },
            { name: "note", label: "Ghi chú", type: "textarea" },
          ]}
        />
        <ActionDialog
          title="Mở kết sổ"
          button="Mở khóa"
          icon={RefreshCw}
          action="reopenAttendance"
          onAction={runAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "week", label: "Tuần", value: currentIsoWeek(), required: true },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "by", label: "Người mở", value: "Admin" },
            { name: "note", label: "Ghi chú", type: "textarea" },
          ]}
        />
      </>
    ),
    payroll: null,
    payslips: null,
    staff: (
      <>
        <ExcelImportDialog
          title="Import nhân sự từ Excel"
          action="manageStaff"
          onAction={runAction}
          onImported={paginatedStaff.refresh}
          fields={[
            { key: "id", label: "Mã NS", aliases: ["Ma NS", "Mã", "Code"] },
            { key: "name", label: "Họ tên", aliases: ["Ho ten", "Tên nhân sự", "Tên"], required: true },
            { key: "team", label: "Đội", aliases: ["Doi", "Tổ đội"] },
            { key: "position", label: "Chức vụ", aliases: ["Chuc vu", "Vai trò"] },
            { key: "salaryDay", label: "Lương/ngày", aliases: ["Luong ngay", "Lương"], type: "number" },
            { key: "resigned", label: "Đã nghỉ việc", aliases: ["Nghỉ việc", "Da nghi viec"], type: "boolean" },
            { key: "offDate", label: "Thời gian nghỉ", aliases: ["Ngay nghỉ", "Ngay nghi"], type: "date" },
          ]}
        />
        <ActionDialog
          title="Nhân sự"
          button="Nhân sự"
          icon={Users}
          action="manageStaff"
          onAction={runAction}
          fields={[
            { name: "id", label: "Mã NS" },
            { name: "name", label: "Họ tên", required: true },
            { name: "team", label: "Đội" },
            { name: "position", label: "Chức vụ" },
            { name: "salaryDay", label: "Lương/ngày", type: "number" },
            { name: "resigned", label: "Đã nghỉ việc", type: "checkbox" },
            {
              name: "offDate",
              label: "Thời gian nghỉ",
              type: "date",
              validate: validateStaffOffDate,
              visibleWhen: shouldShowStaffOffDate,
              defaultValueWhen: defaultStaffOffDate,
            },
          ]}
        />
      </>
    ),
    laborNorms: (
      <>
        <ExcelImportDialog
          title="Import định mức nhân công từ Excel"
          action="saveLaborNorm"
          onAction={runAction}
          onImported={paginatedLaborNorms.refresh}
          fields={[
            { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
            { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
            {
              key: "workdays",
              label: "Số công định mức",
              aliases: ["Số công ĐM", "So cong"],
              type: "number",
              required: true,
            },
            {
              key: "cost",
              label: "Chi phí định mức",
              aliases: ["Chi phí ĐM", "Chi phi"],
              type: "number",
              required: true,
            },
          ]}
        />
        <ActionDialog
          title="Định mức nhân công"
          button="Định mức"
          icon={ClipboardList}
          action="saveLaborNorm"
          onAction={runLaborNormAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            { name: "workdays", label: "Số công định mức", type: "number", required: true },
            { name: "cost", label: "Chi phí định mức", type: "number", required: true },
          ]}
        />
      </>
    ),
    progress: (
      <>
        <ExcelImportDialog
          title="Import tiến độ hạng mục từ Excel"
          action="saveProgress"
          onAction={runAction}
          onImported={paginatedProgress.refresh}
          fields={[
            { key: "projectCode", label: "Công trình", hidden: true, defaultValue: activeProjectCode },
            { key: "category", label: "Hạng mục", aliases: ["Hang muc"], required: true },
            { key: "startDate", label: "Ngày bắt đầu", aliases: ["Ngay bat dau"], type: "date", required: true },
            { key: "durationDays", label: "Số ngày", aliases: ["So ngay"], type: "number", required: true },
            { key: "workdays", label: "Số công", aliases: ["So cong"], type: "number", required: true },
            { key: "planEndDate", label: "Ngày HT dự kiến", aliases: ["HT dự kiến"], type: "date", required: true },
            {
              key: "confirmedEndDate",
              label: "Ngày HT xác nhận",
              aliases: ["HT xác nhận"],
              type: "date",
              required: true,
            },
            { key: "evaluation", label: "Đánh giá", aliases: ["Danh gia"], defaultValue: "Đang theo dõi" },
          ]}
        />
        <ActionDialog
          title="Tiến độ hạng mục"
          button="Tiến độ"
          icon={CalendarCheck}
          action="saveProgress"
          onAction={runProgressAction}
          fields={[
            { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
            { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
            {
              name: "startDate",
              label: "Ngày bắt đầu",
              type: "date",
              value: todayIso(),
              required: true,
              validate: validateProgressStartDate,
            },
            { name: "durationDays", label: "Số ngày", type: "number", required: true },
            { name: "workdays", label: "Số công", type: "number", required: true },
            {
              name: "planEndDate",
              label: "Ngày HT dự kiến",
              type: "date",
              required: true,
              validate: validateProgressPlanEndDate,
            },
            {
              name: "confirmedEndDate",
              label: "Ngày HT xác nhận",
              type: "date",
              required: true,
              validate: validateProgressConfirmedEndDate,
            },
            { name: "evaluation", label: "Đánh giá", value: "Đang theo dõi" },
          ]}
        />
      </>
    ),
  } satisfies Record<WorkforceSection, React.ReactNode>;

  const sections = {
    attendance: {
      title: "Chấm công nhân công",
      description: "Chấm công theo tuần, hạng mục và trạng thái kết sổ.",
      content: (
        <div className="space-y-6">
          <div className="space-y-3">
            <AttendanceBoard
              rows={scoped.attendance}
              staff={data.staff}
              categoryOptions={attendanceBoardCategoryOptions}
              activeCategoryValues={activeCategoryValues}
              activeProjectCode={activeProjectCode}
              canManage={canManage}
              loading={isSwitchingProject}
              onAction={runAction}
            />
          </div>
        </div>
      ),
    },
    payroll: {
      title: "Bảng lương",
      description: "Tổng hợp lương nhân công theo tuần, hạng mục và nhân sự từ dữ liệu chấm công.",
      content: (
        <SectionBlock title="Bảng lương nhân công">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              {
                key: "stt",
                label: "STT",
                accessor: (row) => row.stt,
                className: "w-16 text-center",
                headerClassName: "text-center",
                headerCellClassName: "text-center",
                render: (row) => <div className="text-center">{row.stt}</div>,
              },
              {
                key: "staffName",
                label: "Họ tên",
                accessor: (row) => `${row.staffName} ${row.position}`,
                searchable: true,
                render: (row) => <div className="min-w-52 truncate">{row.staffName}</div>,
              },
              {
                key: "salaryDay",
                label: "Mức lương",
                accessor: (row) => row.salaryDay,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.salaryDay)}</div>,
              },
              {
                key: "category",
                label: "Hạng mục",
                accessor: (row) => row.category,
                render: (row) => row.category,
              },
              {
                key: "shiftCount",
                label: "Công ca",
                accessor: (row) => row.shiftCount,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatCount(row.shiftCount)}</div>,
              },
              {
                key: "workdays",
                label: "Công quy đổi",
                accessor: (row) => row.workdays,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatCount(row.workdays)}</div>,
              },
              {
                key: "allowance",
                label: "Phụ cấp",
                accessor: (row) => row.allowance,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.allowance)}</div>,
              },
              {
                key: "overtime",
                label: "OT",
                accessor: (row) => row.overtimeAmount,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.overtimeAmount)}</div>,
                exportValue: (row) => row.overtimeAmount,
              },
              {
                key: "total",
                label: "Thực nhận",
                accessor: (row) => row.total,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.total)}</div>,
              },
            ]}
            rows={payrollRows}
            getRowId={(row) => row.id}
            exportFileName="bang-luong-nhan-cong"
            searchPlaceholder="Tìm nhân sự, hạng mục..."
            filters={[
              { key: "week", label: "Tuần", options: attendanceWeekOptions },
              { key: "category", label: "Hạng mục", options: attendanceCategoryOptions },
              { key: "staffName", label: "Nhân sự", options: attendanceStaffOptions },
            ]}
            initialSorting={[{ id: "stt", desc: false }]}
            footerRow={(rows, columnCount) => {
              const total = rows.reduce((sum, row) => sum + row.total, 0);

              return (
                <TableRow>
                  <TableCell colSpan={Math.max(columnCount - 1, 1)} className="text-right font-bold">
                    TỔNG CHI PHÍ NHÂN CÔNG:
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatPayrollMoney(total)}</TableCell>
                </TableRow>
              );
            }}
          />
        </SectionBlock>
      ),
    },
    payslips: {
      title: "Phiếu lương",
      description: "Phiếu lương tổng hợp theo tuần, hạng mục và nhân sự để in đối chiếu.",
      content: (
        <SectionBlock title="Phiếu lương nhân công">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              {
                key: "stt",
                label: "STT",
                accessor: (row) => row.stt,
                className: "w-16 text-center",
                headerClassName: "text-center",
                headerCellClassName: "text-center",
                render: (row) => <div className="text-center">{row.stt}</div>,
              },
              {
                key: "staffName",
                label: "Họ tên",
                accessor: (row) => `${row.staffName} ${row.position}`,
                searchable: true,
                render: (row) => <div className="min-w-64 truncate">{row.staffName}</div>,
              },
              {
                key: "category",
                label: "Hạng mục",
                accessor: (row) => row.category,
                className: "text-center",
                headerClassName: "text-center",
                headerCellClassName: "text-center",
                render: (row) => <div className="text-center">{row.category}</div>,
              },
              {
                key: "workdays",
                label: "Ngày công",
                accessor: (row) => row.workdays,
                className: "text-center",
                headerClassName: "text-center",
                headerCellClassName: "text-center",
                render: (row) => <div className="text-center">{formatCount(row.workdays)} công</div>,
              },
              {
                key: "allowance",
                label: "Phụ cấp",
                accessor: (row) => row.allowance,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.allowance)}</div>,
              },
              {
                key: "overtime",
                label: "Tăng ca",
                accessor: (row) => row.overtimeAmount,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.overtimeAmount)}</div>,
              },
              {
                key: "total",
                label: "Thành tiền",
                accessor: (row) => row.total,
                className: "text-right",
                headerClassName: "text-right",
                headerCellClassName: "text-right",
                render: (row) => <div className="text-right">{formatPayrollMoney(row.total)}</div>,
              },
            ]}
            rows={payrollRows}
            getRowId={(row) => row.id}
            selectable
            exportFileName="phieu-luong-nhan-cong"
            searchPlaceholder="Tìm nhân sự, hạng mục..."
            filters={[
              { key: "week", label: "Tuần", options: attendanceWeekOptions },
              { key: "category", label: "Hạng mục", options: attendanceCategoryOptions },
              { key: "staffName", label: "Nhân sự", options: attendanceStaffOptions },
            ]}
            initialSorting={[{ id: "stt", desc: false }]}
            toolbarActions={({ filteredRows, selectedRows, selectedCount }) => (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-md"
                  disabled={!selectedCount}
                  onClick={() => printPayslipRows(selectedRows, "Phiếu lương nhân công tuần", activeProject)}
                >
                  In phiếu đã chọn
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-md"
                  disabled={!filteredRows.length}
                  onClick={() => printPayslipRows(filteredRows, "Phiếu lương nhân công tuần", activeProject)}
                >
                  In tất cả
                </Button>
              </>
            )}
            footerRow={(rows, columnCount) => {
              const totalWorkdays = rows.reduce((sum, row) => sum + row.workdays, 0);
              const totalAllowance = rows.reduce((sum, row) => sum + row.allowance, 0);
              const totalOvertime = rows.reduce((sum, row) => sum + row.overtimeAmount, 0);
              const total = rows.reduce((sum, row) => sum + row.total, 0);
              const label =
                rows.length && rows.every((row) => row.category === rows[0]?.category)
                  ? `TỔNG CỘNG TUẦN - ${rows[0]?.category || ""}`
                  : "TỔNG CỘNG TUẦN";

              return (
                <TableRow>
                  <TableCell colSpan={Math.max(columnCount - 4, 1)} className="font-bold">
                    {label}
                  </TableCell>
                  <TableCell className="text-center font-bold">{formatCount(totalWorkdays)} công</TableCell>
                  <TableCell className="text-right font-bold">{formatPayrollMoney(totalAllowance)}</TableCell>
                  <TableCell className="text-right font-bold">{formatPayrollMoney(totalOvertime)}</TableCell>
                  <TableCell className="text-right font-bold">{formatPayrollMoney(total)}</TableCell>
                </TableRow>
              );
            }}
          />
        </SectionBlock>
      ),
    },
    staff: {
      title: "Nhân sự",
      description: "Nhân sự, đội nhóm, mức lương và trạng thái nghỉ việc.",
      content: (
        <SectionBlock title="Danh sách nhân sự">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "id", label: "Mã", accessor: (row) => row.id, render: (row) => row.id },
              { key: "name", label: "Họ tên", accessor: (row) => row.name, render: (row) => row.name },
              { key: "team", label: "Đội", accessor: (row) => row.team, render: (row) => row.team || "-" },
              {
                key: "position",
                label: "Chức vụ",
                accessor: (row) => row.position,
                render: (row) => row.position || "-",
              },
              {
                key: "salaryDay",
                label: "Lương/ngày",
                accessor: (row) => row.salaryDay,
                render: (row) => formatMoney(row.salaryDay),
              },
              {
                key: "resigned",
                label: "Trạng thái",
                accessor: (row) => (row.resigned ? "Đã nghỉ việc" : "Đang làm"),
                render: (row) =>
                  row.resigned ? (
                    <Badge variant="secondary">Đã nghỉ việc{row.offDate ? ` · ${row.offDate}` : ""}</Badge>
                  ) : (
                    <Badge variant="outline">Đang làm</Badge>
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
                      render: (row: (typeof data.staff)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa nhân sự",
                              action: "manageStaff",
                              onAction: runAction,
                              fields: [
                                { name: "originalId", label: "Mã gốc", type: "hidden", value: row.id },
                                { name: "id", label: "Mã NS", value: row.id, readOnly: true },
                                { name: "name", label: "Họ tên", required: true, value: row.name },
                                { name: "team", label: "Đội", value: row.team },
                                { name: "position", label: "Chức vụ", value: row.position },
                                { name: "salaryDay", label: "Lương/ngày", type: "number", value: row.salaryDay },
                                { name: "resigned", label: "Đã nghỉ việc", type: "checkbox", value: row.resigned },
                                {
                                  name: "offDate",
                                  label: "Thời gian nghỉ",
                                  type: "date",
                                  value: row.offDate,
                                  validate: validateStaffOffDate,
                                  visibleWhen: shouldShowStaffOffDate,
                                  defaultValueWhen: defaultStaffOffDate,
                                },
                              ],
                            }}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={paginatedStaff.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedStaff.serverSide}
            detailType="staff"
            selectable
            exportFileName="nhan-su"
            searchPlaceholder="Tìm theo mã, tên, đội..."
            filters={[
              { key: "team", label: "Đội", options: staffTeamOptions },
              { key: "position", label: "Chức vụ", options: staffPositionOptions },
            ]}
          />
        </SectionBlock>
      ),
    },
    laborNorms: {
      title: "Định mức nhân công",
      description: "Số công và chi phí định mức theo hạng mục.",
      content: (
        <SectionBlock title="Định mức nhân công">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
              {
                key: "workdays",
                label: "Số công ĐM",
                accessor: (row) => row.workdays,
                render: (row) => formatCount(row.workdays),
              },
              { key: "cost", label: "Chi phí ĐM", accessor: (row) => row.cost, render: (row) => formatMoney(row.cost) },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.laborNorms)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa định mức nhân công",
                              action: "saveLaborNorm",
                              onAction: runLaborNormAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: catalogOptionsWithValue(data.catalogs.hangMuc, row.category),
                                  value: row.category,
                                  required: true,
                                },
                                {
                                  name: "workdays",
                                  label: "Số công định mức",
                                  type: "number",
                                  value: row.workdays,
                                  required: true,
                                },
                                {
                                  name: "cost",
                                  label: "Chi phí định mức",
                                  type: "number",
                                  value: row.cost,
                                  required: true,
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa định mức nhân công của "${row.category}"?`)) {
                                    return runLaborNormAction("deleteLaborNorm", { id: row.id });
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
            rows={paginatedLaborNorms.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedLaborNorms.serverSide}
            detailType="labor-norms"
            selectable
            bulkDeleteAction={
              canManage
                ? {
                    confirmMessage: (rows) => `Xóa ${rows.length.toLocaleString("vi-VN")} dòng định mức đã chọn?`,
                    onDelete: async (rows) => {
                      for (const row of rows) {
                        await runLaborNormAction("deleteLaborNorm", { id: row.id });
                      }
                      paginatedLaborNorms.refresh();
                    },
                  }
                : undefined
            }
            exportFileName="dinh-muc-nhan-cong"
            filters={[{ key: "category", label: "Hạng mục", options: laborNormCategoryOptions }]}
          />
        </SectionBlock>
      ),
    },
    progress: {
      title: "Tiến độ hạng mục",
      description: "Kế hoạch và ngày hoàn thành của từng hạng mục.",
      content: (
        <div className="space-y-3">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
              {
                key: "startDate",
                label: "Bắt đầu",
                accessor: (row) => row.startDate,
                render: (row) => row.startDate || "-",
              },
              {
                key: "planEndDate",
                label: "Dự kiến",
                accessor: (row) => row.planEndDate,
                render: (row) => row.planEndDate || "-",
              },
              {
                key: "confirmedEndDate",
                label: "Xác nhận",
                accessor: (row) => row.confirmedEndDate,
                render: (row) => row.confirmedEndDate || "-",
              },
              {
                key: "evaluation",
                label: "Đánh giá",
                accessor: (row) => row.evaluation,
                render: (row) => row.evaluation || "-",
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.progress)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa tiến độ",
                              action: "saveProgress",
                              onAction: runProgressAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: catalogOptionsWithValue(data.catalogs.hangMuc, row.category),
                                  value: row.category,
                                  required: true,
                                },
                                {
                                  name: "startDate",
                                  label: "Ngày bắt đầu",
                                  type: "date",
                                  value: row.startDate || todayIso(),
                                  required: true,
                                  validate: validateProgressStartDate,
                                },
                                {
                                  name: "durationDays",
                                  label: "Số ngày",
                                  type: "number",
                                  value: row.durationDays,
                                  required: true,
                                },
                                {
                                  name: "workdays",
                                  label: "Số công",
                                  type: "number",
                                  value: row.workdays,
                                  required: true,
                                },
                                {
                                  name: "planEndDate",
                                  label: "Ngày HT dự kiến",
                                  type: "date",
                                  value: row.planEndDate,
                                  required: true,
                                  validate: validateProgressPlanEndDate,
                                },
                                {
                                  name: "confirmedEndDate",
                                  label: "Ngày HT xác nhận",
                                  type: "date",
                                  value: row.confirmedEndDate,
                                  required: true,
                                  validate: validateProgressConfirmedEndDate,
                                },
                                { name: "evaluation", label: "Đánh giá", value: row.evaluation },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa tiến độ của "${row.category}"?`)) {
                                    return runProgressAction("deleteProgress", { id: row.id });
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
            rows={paginatedProgress.rows}
            getRowId={(row) => row.id}
            serverSide={paginatedProgress.serverSide}
            detailType="progress"
            selectable
            bulkDeleteAction={
              canManage
                ? {
                    confirmMessage: (rows) => `Xóa ${rows.length.toLocaleString("vi-VN")} dòng tiến độ đã chọn?`,
                    onDelete: async (rows) => {
                      for (const row of rows) {
                        await runProgressAction("deleteProgress", { id: row.id });
                      }
                      paginatedProgress.refresh();
                    },
                  }
                : undefined
            }
            exportFileName="tien-do-hang-muc"
            filters={[{ key: "category", label: "Hạng mục", options: progressCategoryOptions }]}
            initialSorting={[{ id: "startDate", desc: true }]}
          />
        </div>
      ),
    },
  } satisfies Record<
    WorkforceSection,
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
        icon={HardHat}
        actions={canManage ? actions[section] : undefined}
      />
      {currentSection.content}
    </div>
  );
}
