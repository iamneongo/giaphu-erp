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
import { ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { AttendanceRow, LaborNormRow, ProgressRow, StaffRow } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

import { useCanAccessErpPermission } from "../../_components/effective-permissions-provider";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, uniqueOptions } from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import type { GiaPhuActionResult } from "../_lib/giaphu-erp-api";
import { ActionDialog } from "./action-dialog";
import { DataTable, type DataTableColumn } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type WorkforceSection = "attendance" | "staff" | "laborNorms" | "progress";

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

function weekSortValue(value: string) {
  const [weekText, yearText] = value.split(".");
  return Number(yearText || 0) * 100 + Number(weekText || 0);
}

function buildWeekOptions(options: Array<{ label: string; value: string }>) {
  const values = new Set([currentIsoWeek(), ...options.map((option) => option.value).filter(Boolean)]);

  return Array.from(values)
    .sort((first, second) => weekSortValue(second) - weekSortValue(first))
    .map((value) => ({ label: value, value }));
}

function dateTimeFromInput(value: unknown) {
  const dateText = String(value ?? "").slice(0, 10);
  if (!dateText) return null;

  const date = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function validateProgressStartDate(value: string, payload: Record<string, unknown>) {
  const startDate = dateTimeFromInput(value);
  const today = dateTimeFromInput(todayIso());
  const planEndDate = dateTimeFromInput(payload.planEndDate);
  const confirmedEndDate = dateTimeFromInput(payload.confirmedEndDate);

  if (!startDate) return "Ngày bắt đầu không hợp lệ.";
  if (today && startDate < today) return "Ngày bắt đầu không được nhỏ hơn ngày hiện tại.";
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
  value,
  onValueChange,
  options,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: StaffRow[];
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);
  const selectedStaff = options.find((option) => option.name === value);
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
          <span className={cn("truncate", !selectedStaff && "text-muted-foreground")}>
            {selectedStaff ? selectedStaff.name : "Tìm và chọn nhân công"}
          </span>
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
                    onValueChange(option.name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("size-4", value === option.name ? "opacity-100" : "opacity-0")} />
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
  weekOptions,
  activeProjectCode,
  canManage,
  loading,
  onAction,
}: {
  rows: AttendanceRow[];
  staff: StaffRow[];
  categoryOptions: Array<{ label: string; value: string }>;
  weekOptions: Array<{ label: string; value: string }>;
  activeProjectCode: string;
  canManage: boolean;
  loading: boolean;
  onAction: (
    action: string,
    payload: Record<string, unknown>,
  ) => Promise<GiaPhuActionResult | false | boolean | undefined>;
}) {
  const normalizedWeekOptions = React.useMemo(() => buildWeekOptions(weekOptions), [weekOptions]);
  const [selectedWeek, setSelectedWeek] = React.useState(currentIsoWeek());
  const [selectedCategory, setSelectedCategory] = React.useState(categoryOptions[0]?.value || "");
  const [selectedStaffName, setSelectedStaffName] = React.useState("");
  const [draftParticipants, setDraftParticipants] = React.useState<DraftAttendanceParticipant[]>([]);
  const [draftCells, setDraftCells] = React.useState<Record<string, AttendanceCellDraft>>({});
  const [draftExtras, setDraftExtras] = React.useState<Record<string, AttendanceExtraDraft>>({});
  const [dirtyStaffNames, setDirtyStaffNames] = React.useState<Set<string>>(new Set());
  const [savingStaffName, setSavingStaffName] = React.useState("");
  const [deletingStaffName, setDeletingStaffName] = React.useState("");

  React.useEffect(() => {
    if (normalizedWeekOptions.length > 0 && !normalizedWeekOptions.some((option) => option.value === selectedWeek)) {
      setSelectedWeek(currentIsoWeek());
    }
  }, [normalizedWeekOptions, selectedWeek]);

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
    setSelectedStaffName("");
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

  function addParticipant() {
    const staffRow = staff.find((row) => row.name === selectedStaffName);

    if (!staffRow || !selectedCategory) return;

    const id = [selectedWeek, selectedCategory, staffRow.name].join("::");
    setDraftParticipants((current) => {
      if (current.some((participant) => participant.id === id)) return current;

      return [
        ...current,
        {
          id,
          week: selectedWeek,
          category: selectedCategory,
          staff: staffRow,
        },
      ];
    });
    setSelectedStaffName("");
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
      const baseDraft = draftExtras[staffKey] ?? getAttendanceExtraDraft(rowByStaff.get(staffKey) ?? []);
      setDraftExtras((current) => ({
        ...current,
        [staffKey]: {
          ...baseDraft,
          [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
        },
      }));
      setDirtyStaffNames((current) => new Set(current).add(staffName));
    },
    [canManage, draftExtras, rowByStaff],
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
              value={extras.allowance}
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
              value={extras.overtimeHours}
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
        <div className="grid gap-3 sm:grid-cols-[160px_224px]">
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Tuần</div>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {normalizedWeekOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-[minmax(16rem,20rem)_auto] sm:items-end xl:w-auto xl:justify-end">
          <div className="w-full space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Thêm nhân công</div>
            <StaffSearchCombobox
              value={selectedStaffName}
              onValueChange={setSelectedStaffName}
              options={availableStaff}
              disabled={!canManage || availableStaff.length === 0 || !selectedCategory}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canManage || !selectedStaffName || !selectedCategory}
            onClick={addParticipant}
            className="h-9"
          >
            <Users />
            Thêm
          </Button>
        </div>
      </div>

      <DataTable
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
  });
  const paginatedLaborNorms = usePaginatedErpRows<LaborNormRow>({
    dataset: "laborNorms",
    projectCode: activeProjectCode,
    initialRows: scoped.laborNorms,
  });
  const paginatedProgress = usePaginatedErpRows<ProgressRow>({
    dataset: "progress",
    projectCode: activeProjectCode,
    initialRows: scoped.progress,
  });
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const attendanceWeekOptions = uniqueOptions(scoped.attendance.map((row) => row.week));
  const staffTeamOptions = uniqueOptions(data.staff.map((row) => row.team));
  const staffPositionOptions = uniqueOptions(data.staff.map((row) => row.position));
  const laborNormCategoryOptions = uniqueOptions(scoped.laborNorms.map((row) => row.category));
  const progressCategoryOptions = uniqueOptions(scoped.progress.map((row) => row.category));
  const canManage = useCanAccessErpPermission(ERP_PERMISSIONS.workforceManage);

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
    staff: (
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
    ),
    laborNorms: (
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
    ),
    progress: (
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
              categoryOptions={categoryOptions}
              weekOptions={attendanceWeekOptions}
              activeProjectCode={activeProjectCode}
              canManage={canManage}
              loading={isSwitchingProject}
              onAction={runAction}
            />
          </div>
        </div>
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
                                  options: categoryOptions,
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
                                  options: categoryOptions,
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
