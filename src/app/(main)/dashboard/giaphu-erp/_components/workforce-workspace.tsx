"use client";

import * as React from "react";

import { useAuth } from "@clerk/nextjs";
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { AttendanceRow, StaffRow } from "@/lib/giaphu-erp/types";
import { cn } from "@/lib/utils";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, uniqueOptions } from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import type { GiaPhuActionResult } from "../_lib/giaphu-erp-api";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type WorkforceSection = "attendance" | "staff" | "laborNorms" | "progress";

const weekDayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const allFilterValue = "__all__";
const staffComboboxRenderLimit = 40;
const attendanceStatusOptions = [
  {
    key: "morning",
    label: "Sáng",
    shortLabel: "Sáng",
    helper: "+0.5",
    coefficient: 0.5,
    shift: "Sáng",
    status: "Sáng",
    className: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    activeClassName: "border-sky-500 bg-sky-100 text-sky-900 ring-sky-500/30",
  },
  {
    key: "afternoon",
    label: "Chiều",
    shortLabel: "Chiều",
    helper: "+0.5",
    coefficient: 0.5,
    shift: "Chiều",
    status: "Chiều",
    className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    activeClassName: "border-amber-500 bg-amber-100 text-amber-900 ring-amber-500/30",
  },
  {
    key: "leave",
    label: "Nghỉ có phép",
    shortLabel: "P",
    helper: "0",
    coefficient: 0,
    shift: "Nghỉ",
    status: "Nghỉ có phép",
    className: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    activeClassName: "border-violet-500 bg-violet-100 text-violet-900 ring-violet-500/30",
  },
  {
    key: "absent",
    label: "Nghỉ không phép",
    shortLabel: "V",
    helper: "0",
    coefficient: 0,
    shift: "Vắng",
    status: "Nghỉ không phép",
    className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    activeClassName: "border-rose-500 bg-rose-100 text-rose-900 ring-rose-500/30",
  },
] as const;

type AttendanceStatusOption = (typeof attendanceStatusOptions)[number];
const fullDayCellStyle = "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAttendanceStatusOption(row?: AttendanceRow) {
  if (!row) return null;

  const statusText = normalizeSearchText(`${row.status} ${row.shift}`);

  if (statusText.includes("khong phep") || statusText.includes("vang")) {
    return attendanceStatusOptions.find((option) => option.key === "absent") ?? null;
  }
  if (statusText.includes("co phep") || statusText.includes("phep")) {
    return attendanceStatusOptions.find((option) => option.key === "leave") ?? null;
  }
  if (statusText.includes("sang")) return attendanceStatusOptions.find((option) => option.key === "morning") ?? null;
  if (statusText.includes("chieu")) return attendanceStatusOptions.find((option) => option.key === "afternoon") ?? null;
  if (Number(row.coefficient) === 0) return attendanceStatusOptions.find((option) => option.key === "leave") ?? null;

  return attendanceStatusOptions.find((option) => option.key === "morning") ?? null;
}

function getAttendanceCellState(rows: AttendanceRow[]) {
  if (!rows.length) return null;

  const rowOptions = rows.map((row) => getAttendanceStatusOption(row)).filter(Boolean);
  const hasMorning = rowOptions.some((option) => option?.key === "morning");
  const hasAfternoon = rowOptions.some((option) => option?.key === "afternoon");
  const absenceOption = rowOptions.find((option) => option?.key === "absent" || option?.key === "leave");

  if (hasMorning && hasAfternoon) {
    return {
      label: "Cả ngày",
      detail: "+1",
      className: fullDayCellStyle,
    };
  }

  const option = absenceOption ?? rowOptions[0];
  const workdays = rows.reduce((sum, row) => sum + Number(row.coefficient || 0), 0);

  return {
    label: option?.shortLabel ?? rows[0]?.status ?? "Đã chấm",
    detail: rows.length > 1 ? `${rows.length} dòng` : `${workdays > 0 ? "+" : ""}${formatCount(workdays)}`,
    className: option?.className ?? "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
  };
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
  shift: string;
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
        salaryDay: row.halfDaySalary * 2,
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

function buildAttendanceShiftOptions() {
  const values = new Map<string, { label: string; value: string }>();

  for (const option of attendanceStatusOptions) {
    values.set(option.shift, { label: option.label, value: option.shift });
  }

  return Array.from(values.values());
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
  const deferredSearch = React.useDeferredValue(search);
  const selectedStaff = options.find((option) => option.name === value);
  const { visibleOptions, hiddenCount } = React.useMemo(() => {
    const term = normalizeSearchText(deferredSearch);
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
  }, [deferredSearch, options]);

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
  const normalizedShiftOptions = React.useMemo(() => buildAttendanceShiftOptions(), []);
  const [selectedWeek, setSelectedWeek] = React.useState(currentIsoWeek());
  const [selectedCategory, setSelectedCategory] = React.useState(categoryOptions[0]?.value || allFilterValue);
  const [selectedShift, setSelectedShift] = React.useState(allFilterValue);
  const [selectedStaffName, setSelectedStaffName] = React.useState("");
  const [draftParticipants, setDraftParticipants] = React.useState<DraftAttendanceParticipant[]>([]);
  const [attendanceNote, setAttendanceNote] = React.useState("");
  const [savingAttendance, setSavingAttendance] = React.useState(false);
  const [editor, setEditor] = React.useState<{
    row?: AttendanceRow;
    rows: AttendanceRow[];
    date: string;
    staff: StaffRow;
    category: string;
    shift: string;
  } | null>(null);

  React.useEffect(() => {
    if (normalizedWeekOptions.length > 0 && !normalizedWeekOptions.some((option) => option.value === selectedWeek)) {
      setSelectedWeek(currentIsoWeek());
    }
  }, [normalizedWeekOptions, selectedWeek]);

  React.useEffect(() => {
    if (
      selectedCategory !== allFilterValue &&
      categoryOptions.length > 0 &&
      !categoryOptions.some((option) => option.value === selectedCategory)
    ) {
      setSelectedCategory(categoryOptions[0].value);
    }
  }, [categoryOptions, selectedCategory]);

  const weekDates = React.useMemo(() => getWeekDates(selectedWeek), [selectedWeek]);
  const filteredRows = React.useMemo(
    () =>
      rows.filter(
        (row) =>
          row.week === selectedWeek &&
          (selectedCategory === allFilterValue || row.category === selectedCategory) &&
          (selectedShift === allFilterValue || row.shift === selectedShift),
      ),
    [rows, selectedCategory, selectedShift, selectedWeek],
  );
  const visibleDraftParticipants = React.useMemo(
    () =>
      draftParticipants.filter(
        (participant) =>
          participant.week === selectedWeek &&
          (selectedCategory === allFilterValue || participant.category === selectedCategory) &&
          (selectedShift === allFilterValue || participant.shift === selectedShift),
      ),
    [draftParticipants, selectedCategory, selectedShift, selectedWeek],
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
      const key = `${row.staffName}::${row.date}`;
      map.set(key, [...(map.get(key) ?? []), row]);
    }

    return map;
  }, [filteredRows]);
  const currentCategory = selectedCategory === allFilterValue ? categoryOptions[0]?.value || "" : selectedCategory;
  const currentShift = selectedShift === allFilterValue ? normalizedShiftOptions[0]?.value || "" : selectedShift;
  const availableStaff = React.useMemo(() => {
    const participantNames = new Set(boardRows.map((row) => row.name));

    return staff
      .filter((row) => !row.resigned && !participantNames.has(row.name))
      .sort((first, second) => first.name.localeCompare(second.name, "vi"));
  }, [boardRows, staff]);

  function addParticipant() {
    const staffRow = staff.find((row) => row.name === selectedStaffName);

    if (!staffRow || !currentCategory || !currentShift) return;

    const id = [selectedWeek, currentCategory, currentShift, staffRow.name].join("::");
    setDraftParticipants((current) => {
      if (current.some((participant) => participant.id === id)) return current;

      return [
        ...current,
        {
          id,
          week: selectedWeek,
          category: currentCategory,
          shift: currentShift,
          staff: staffRow,
        },
      ];
    });
    setSelectedStaffName("");
  }

  function openEditor(staffRow: StaffRow, date: string, cellRows: AttendanceRow[]) {
    if (!canManage) return;

    const existingRow =
      selectedShift === allFilterValue && selectedCategory === allFilterValue
        ? cellRows[0]
        : (cellRows.find(
            (row) =>
              (selectedShift === allFilterValue || row.shift === selectedShift) &&
              (selectedCategory === allFilterValue || row.category === selectedCategory),
          ) ?? cellRows[0]);

    setEditor({
      row: existingRow,
      rows: cellRows,
      date,
      staff: staffRow,
      category: existingRow?.category || currentCategory,
      shift: existingRow?.shift || currentShift,
    });
    setAttendanceNote("");
  }

  async function saveAttendanceStatus(option: AttendanceStatusOption) {
    if (!editor || savingAttendance) return;

    setSavingAttendance(true);
    const baseSalary = Math.max(0, Math.round(Number(editor.staff.salaryDay || editor.row?.halfDaySalary || 0)));
    const note = attendanceNote.trim();
    const existingOptionRow = editor.rows.find((row) => getAttendanceStatusOption(row)?.key === option.key);
    const rowsToReplace =
      option.key === "leave" || option.key === "absent"
        ? editor.rows.filter((row) => row.id)
        : editor.rows.filter((row) => {
            const rowOptionKey = getAttendanceStatusOption(row)?.key;
            return row.id && (rowOptionKey === "leave" || rowOptionKey === "absent");
          });

    const deleteResults = rowsToReplace.length
      ? await Promise.all(rowsToReplace.map((row) => onAction("deleteAttendanceRow", { id: row.id })))
      : [];

    if (deleteResults.some((ok) => ok === false)) {
      setSavingAttendance(false);
      return;
    }

    const payload = {
      id: option.key === "leave" || option.key === "absent" ? "" : (existingOptionRow?.id ?? ""),
      projectCode: activeProjectCode,
      date: existingOptionRow?.date || editor.row?.date || editor.date,
      week: existingOptionRow?.week || editor.row?.week || selectedWeek,
      shift: option.shift,
      category: editor.category,
      staffName: existingOptionRow?.staffName || editor.row?.staffName || editor.staff.name,
      position: existingOptionRow?.position || editor.row?.position || editor.staff.position || "Nhân công",
      halfDaySalary: baseSalary,
      allowance: 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      coefficient: option.coefficient,
      total: Math.round(baseSalary * option.coefficient),
      status: note ? `${option.status} - ${note}` : option.status,
    };
    const result = await onAction("saveWeeklyAttendance", payload);
    setSavingAttendance(false);

    if (result !== false) {
      const patch = typeof result === "object" && result && "patch" in result ? result.patch : undefined;
      const savedRows = patch?.attendanceUpsert ?? [];
      const deletedIds = new Set([...(patch?.attendanceDeleteIds ?? []), ...rowsToReplace.map((row) => row.id)]);
      const savedIds = new Set(savedRows.map((row) => row.id));

      setEditor((current) =>
        current
          ? {
              ...current,
              rows: [...current.rows.filter((row) => !deletedIds.has(row.id) && !savedIds.has(row.id)), ...savedRows],
              row: savedRows[0] ?? (current.row && deletedIds.has(current.row.id) ? undefined : current.row),
            }
          : current,
      );
      setAttendanceNote("");
    }
  }

  async function deleteCurrentAttendance() {
    const rowsToDelete = editor?.rows.filter((row) => row.id) ?? [];
    if (!rowsToDelete.length || savingAttendance) return;

    setSavingAttendance(true);
    const results = await Promise.all(rowsToDelete.map((row) => onAction("deleteAttendanceRow", { id: row.id })));
    setSavingAttendance(false);

    if (results.every((ok) => ok !== false)) {
      setEditor(null);
      setAttendanceNote("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Tuần</div>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="h-9 w-full sm:w-40">
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
              <SelectTrigger className="h-9 w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>Tất cả hạng mục</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="font-medium text-muted-foreground text-xs">Ca</div>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allFilterValue}>Tất cả ca</SelectItem>
                {normalizedShiftOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end xl:w-auto xl:justify-end">
          <div className="w-full space-y-1.5 sm:w-80">
            <div className="font-medium text-muted-foreground text-xs">Thêm nhân công</div>
            <StaffSearchCombobox
              value={selectedStaffName}
              onValueChange={setSelectedStaffName}
              options={availableStaff}
              disabled={!canManage || availableStaff.length === 0}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canManage || !selectedStaffName || !currentCategory || !currentShift}
            onClick={addParticipant}
            className="h-9"
          >
            <Users />
            Thêm
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[min(68svh,640px)] max-w-full rounded-md border bg-background [&>[data-slot=scroll-area-viewport]]:max-h-[min(68svh,640px)]">
        <div className="grid min-w-0 grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_6.75rem] sm:grid-cols-[16rem_minmax(0,1fr)_8rem]">
          <div className="z-20 border-r bg-background">
            <div className="sticky top-0 z-30 flex h-11 items-center border-b bg-muted/40 px-3 font-medium text-sm">
              Nhân sự
            </div>
            {loading ? (
              Array.from({ length: 6 }, (_, index) => `staff-loading-${index}`).map((key) => (
                <div key={key} className="flex h-[5.25rem] items-center border-b px-3 last:border-b-0">
                  <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
                </div>
              ))
            ) : boardRows.length === 0 ? (
              <div className="h-40" />
            ) : (
              boardRows.map((staffRow) => (
                <div
                  key={staffRow.id || staffRow.name}
                  className="flex h-[5.25rem] items-center border-b px-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{staffRow.name}</div>
                    <div className="truncate text-muted-foreground text-xs">
                      {[staffRow.team, staffRow.position].filter(Boolean).join(" · ") || "Nhân công"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <ScrollArea className="h-full min-w-0">
            <div className="min-w-[42rem] sm:min-w-[56rem]">
              <div
                className="sticky top-0 z-20 grid h-11 border-b bg-muted/40"
                style={{ gridTemplateColumns: `repeat(${weekDates.length}, minmax(6rem, 1fr))` }}
              >
                {weekDates.map((date, index) => (
                  <div
                    key={date}
                    className="flex flex-col items-center justify-center border-r px-2 text-center last:border-r-0"
                  >
                    <div className="font-semibold text-foreground text-sm">{weekDayLabels[index]}</div>
                    <div className="text-muted-foreground text-xs">{formatShortDate(date)}</div>
                  </div>
                ))}
              </div>

              {loading ? (
                Array.from({ length: 6 }, (_, index) => `attendance-loading-${index}`).map((key) => (
                  <div
                    key={key}
                    className="grid h-[5.25rem] border-b last:border-b-0"
                    style={{ gridTemplateColumns: `repeat(${weekDates.length}, minmax(6rem, 1fr))` }}
                  >
                    {weekDates.map((date) => (
                      <div key={date} className="flex items-center justify-center border-r px-2 last:border-r-0">
                        <div className="h-16 w-22 animate-pulse rounded-xl bg-muted sm:w-28" />
                      </div>
                    ))}
                  </div>
                ))
              ) : boardRows.length === 0 ? (
                <div className="grid h-40 place-items-center px-4 text-center">
                  <div className="max-w-sm rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-muted-foreground">
                    Chưa có nhân công trong tuần này. Chọn nhân công rồi thêm vào bảng chấm công.
                  </div>
                </div>
              ) : (
                boardRows.map((staffRow) => {
                  const staffCells = weekDates.map((date) => rowByCell.get(`${staffRow.name}::${date}`) ?? []);

                  return (
                    <div
                      key={staffRow.id || staffRow.name}
                      className="grid h-[5.25rem] border-b last:border-b-0"
                      style={{ gridTemplateColumns: `repeat(${weekDates.length}, minmax(6rem, 1fr))` }}
                    >
                      {weekDates.map((date, index) => {
                        const cellRows = staffCells[index];
                        const cellState = getAttendanceCellState(cellRows);
                        const hasRows = cellRows.length > 0;

                        return (
                          <div
                            key={date}
                            className="flex items-center justify-center border-r px-2 text-center last:border-r-0"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={!canManage}
                              onClick={() => openEditor(staffRow, date, cellRows)}
                              className={cn(
                                "h-16 w-22 flex-col gap-1 rounded-xl border px-2 py-2 font-semibold shadow-none transition-transform hover:-translate-y-0.5 sm:w-28",
                                hasRows && cellState
                                  ? cellState.className
                                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60",
                              )}
                            >
                              {hasRows ? (
                                <>
                                  <span className="text-base">{cellState?.label}</span>
                                  <span className="text-[11px]">{cellState?.detail}</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-base">-</span>
                                  {canManage ? <span className="text-[11px]">Chấm nhanh</span> : null}
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="z-20 border-l bg-background">
            <div className="sticky top-0 z-30 flex h-11 items-center justify-end border-b bg-muted/40 px-3 font-medium text-sm">
              Tổng
            </div>
            {loading ? (
              Array.from({ length: 6 }, (_, index) => `total-loading-${index}`).map((key) => (
                <div key={key} className="flex h-[5.25rem] items-center justify-end border-b px-3 last:border-b-0">
                  <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
                </div>
              ))
            ) : boardRows.length === 0 ? (
              <div className="h-40" />
            ) : (
              boardRows.map((staffRow) => {
                const staffCells = weekDates.map((date) => rowByCell.get(`${staffRow.name}::${date}`) ?? []);
                const staffTotal = staffCells.flat().reduce((sum, row) => sum + Number(row.total || 0), 0);
                const staffWorkdays = staffCells.flat().reduce((sum, row) => sum + Number(row.coefficient || 0), 0);

                return (
                  <div
                    key={staffRow.id || staffRow.name}
                    className="flex h-[5.25rem] flex-col items-end justify-center border-b px-3 text-right last:border-b-0"
                  >
                    <Badge
                      variant="outline"
                      className="mb-1 rounded-full border-orange-200 bg-orange-50 text-orange-700"
                    >
                      {formatCount(staffWorkdays)} công
                    </Badge>
                    <div className="font-semibold">{formatMoney(staffTotal)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ScrollArea>

      {editor ? (
        <Dialog
          open={Boolean(editor)}
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
              setAttendanceNote("");
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Chấm công nhanh</DialogTitle>
              <DialogDescription>
                {editor.staff.name} · {formatShortDate(editor.date)} · {editor.category}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 sm:grid-cols-2">
              {attendanceStatusOptions.map((option) => {
                const isSelected = editor.rows.some((row) => getAttendanceStatusOption(row)?.key === option.key);

                return (
                  <Button
                    key={option.key}
                    type="button"
                    variant="outline"
                    disabled={savingAttendance}
                    onClick={() => saveAttendanceStatus(option)}
                    className={cn(
                      "h-auto justify-between rounded-xl border p-3 text-left shadow-none transition-transform hover:-translate-y-0.5",
                      isSelected ? `shadow-sm ring-2 ${option.activeClassName}` : option.className,
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {isSelected ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
                      <span>
                        <span className="block font-semibold">{option.label}</span>
                        <span className="block text-xs opacity-80">Hệ số: {formatCount(option.coefficient)}</span>
                      </span>
                    </span>
                    <Badge variant={isSelected ? "default" : "secondary"} className="rounded-md">
                      {isSelected ? "Đã chấm" : option.helper}
                    </Badge>
                  </Button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="font-medium text-sm">Ghi chú vụ việc nếu có</div>
              <Textarea
                value={attendanceNote}
                onChange={(event) => setAttendanceNote(event.target.value)}
                placeholder="Ví dụ: đi trễ, nghỉ ốm, tăng ca dọn xà bần..."
              />
            </div>

            <DialogFooter className="justify-between sm:justify-between">
              <div>
                {editor.rows.length > 0 ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={savingAttendance}
                    onClick={deleteCurrentAttendance}
                  >
                    {editor.rows.length > 1 ? `Xóa ${editor.rows.length} dòng` : "Xóa chấm công"}
                  </Button>
                ) : null}
              </div>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={savingAttendance}>
                  Đóng
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export function WorkforceWorkspace({ section = "attendance" }: { section?: WorkforceSection }) {
  const { data, activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const attendanceWeekOptions = uniqueOptions(scoped.attendance.map((row) => row.week));
  const staffTeamOptions = uniqueOptions(data.staff.map((row) => row.team));
  const staffPositionOptions = uniqueOptions(data.staff.map((row) => row.position));
  const laborNormCategoryOptions = uniqueOptions(scoped.laborNorms.map((row) => row.category));
  const progressCategoryOptions = uniqueOptions(scoped.progress.map((row) => row.category));
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.workforceManage,
  );

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
          { name: "offDate", label: "Thời gian nghỉ", type: "date", validate: validateStaffOffDate },
          { name: "resigned", label: "Đã nghỉ việc", type: "checkbox" },
        ]}
      />
    ),
    laborNorms: (
      <ActionDialog
        title="Định mức nhân công"
        button="Định mức"
        icon={ClipboardList}
        action="saveLaborNorm"
        onAction={runAction}
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
        onAction={runAction}
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
      description: "Ghi nhận chấm công theo tuần, hạng mục và thực hiện khóa hoặc mở kết sổ khi cần.",
      content: (
        <div className="space-y-6">
          <SectionBlock title="Bảng chấm công tuần">
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
          </SectionBlock>
        </div>
      ),
    },
    staff: {
      title: "Nhân sự",
      description: "Quản lý danh sách nhân sự dùng chung cho ERP, đội nhóm, mức lương và trạng thái nghỉ việc.",
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
                                {
                                  name: "offDate",
                                  label: "Thời gian nghỉ",
                                  type: "date",
                                  value: row.offDate,
                                  validate: validateStaffOffDate,
                                },
                                { name: "resigned", label: "Đã nghỉ việc", type: "checkbox", value: row.resigned },
                              ],
                            }}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={data.staff}
            getRowId={(row) => row.id}
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
      description: "Thiết lập số công và chi phí định mức theo từng hạng mục của công trình đang chọn.",
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
                              onAction: runAction,
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
                                    return runAction("deleteLaborNorm", { id: row.id });
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
            rows={scoped.laborNorms}
            getRowId={(row) => row.id}
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
      description: "Theo dõi kế hoạch và ngày hoàn thành xác nhận của từng hạng mục trong công trình.",
      content: (
        <SectionBlock title="Tiến độ">
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
                              onAction: runAction,
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
                                    return runAction("deleteProgress", { id: row.id });
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
            rows={scoped.progress}
            getRowId={(row) => row.id}
            detailType="progress"
            selectable
            exportFileName="tien-do-hang-muc"
            filters={[{ key: "category", label: "Hạng mục", options: progressCategoryOptions }]}
            initialSorting={[{ id: "startDate", desc: true }]}
          />
        </SectionBlock>
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
