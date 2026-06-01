import type {
  AttendanceRow,
  BreakdownPoint,
  CategorySpendPoint,
  ContractRow,
  GiaPhuOverviewInsights,
  GiaPhuReportsInsights,
  MaterialRow,
  MonthlyCostPoint,
  OperationRow,
  PaymentRow,
  ProgressRow,
  RecentActivityPoint,
  SubcontractorRow,
  WeeklySnapshot,
} from "@/lib/giaphu-erp/types";

import { formatMoney } from "./formatters";

type ScopeData = {
  materials: MaterialRow[];
  attendance: AttendanceRow[];
  subcontractors: SubcontractorRow[];
  operations: OperationRow[];
  contracts: ContractRow[];
  payments: PaymentRow[];
  progress: ProgressRow[];
};

export type { BreakdownPoint, CategorySpendPoint, MonthlyCostPoint, RecentActivityPoint, WeeklySnapshot };

export function formatVnd(value: number) {
  return formatMoney(value);
}

export function formatPercent(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(1)}%`;
}

export function getOverviewInsights(scope: ScopeData): GiaPhuOverviewInsights {
  const monthly = buildMonthlyCostData(scope, 6);
  const breakdown = buildCostBreakdown(scope);
  const recentActivities = buildRecentActivities(scope, 5);
  const categorySpend = buildCategorySpend(scope, 6);

  const contractValue = scope.contracts.reduce((sum, row) => sum + row.value, 0);
  const collectedCash = scope.payments.reduce((sum, row) => sum + row.amount, 0);
  const materialMainCost = scope.materials
    .filter((row) => row.materialType === "VT Chính")
    .reduce((sum, row) => sum + row.quantity * row.price, 0);
  const materialSubCost = scope.materials
    .filter((row) => row.materialType !== "VT Chính")
    .reduce((sum, row) => sum + row.quantity * row.price, 0);
  const laborCost = scope.attendance.reduce((sum, row) => sum + row.total, 0);
  const subcontractorCost = scope.subcontractors.reduce((sum, row) => sum + row.advance, 0);
  const operationCost = scope.operations.reduce((sum, row) => sum + row.amount, 0);
  const totalCost = breakdown.reduce((sum, row) => sum + row.value, 0);
  const openMaterialDebt = scope.materials
    .filter((row) => row.paymentStatus !== "Đã TT")
    .reduce((sum, row) => sum + row.quantity * row.price, 0);
  const activeCategories = new Set([
    ...scope.materials.map((row) => row.category),
    ...scope.attendance.map((row) => row.category),
    ...scope.subcontractors.map((row) => row.category),
    ...scope.operations.map((row) => row.description),
    ...scope.progress.map((row) => row.category),
  ]).size;
  const activeWeeks = new Set([
    ...scope.materials.map((row) => row.week),
    ...scope.attendance.map((row) => row.week),
    ...scope.subcontractors.map((row) => row.week),
    ...scope.operations.map((row) => row.week),
  ]).size;

  const latest = monthly.at(-1) ?? emptyMonthlyPoint(monthKey(new Date()));
  const previous = monthly.at(-2) ?? emptyMonthlyPoint(monthKey(new Date()));
  const costTrend = percentChange(
    latest.materials + latest.labor + latest.subcontractors + latest.operations,
    previous.materials + previous.labor + previous.subcontractors + previous.operations,
  );
  const cashTrend = percentChange(latest.cashIn, previous.cashIn);

  return {
    monthly,
    breakdown,
    recentActivities,
    categorySpend,
    headline: {
      contractValue,
      collectedCash,
      remainingReceivable: Math.max(contractValue - collectedCash, 0),
      totalCost,
      materialMainCost,
      materialSubCost,
      laborCost,
      subcontractorCost,
      operationCost,
      provisionalProfit: contractValue - totalCost,
      openMaterialDebt,
      activeCategories,
      activeWeeks,
      costTrend,
      cashTrend,
    },
  };
}

export function getReportsInsights(scope: ScopeData): GiaPhuReportsInsights {
  const mainMaterialScope = {
    ...scope,
    materials: scope.materials.filter((row) => row.materialType === "VT Chính"),
    subcontractors: [],
  };
  const breakdown = buildCostBreakdown(mainMaterialScope);
  const monthly = buildMonthlyCostData(mainMaterialScope, 8);
  const weekly = buildWeeklySnapshots(mainMaterialScope, 8);
  const categorySpend = buildCategorySpend(mainMaterialScope, 8);

  const totalCost = breakdown.reduce((sum, row) => sum + row.value, 0);
  const contractValue = scope.contracts.reduce((sum, row) => sum + row.value, 0);
  const collectedCash = scope.payments.reduce((sum, row) => sum + row.amount, 0);
  const unpaidMaterials = scope.materials
    .filter((row) => row.paymentStatus !== "Đã TT")
    .reduce((sum, row) => sum + row.quantity * row.price, 0);

  return {
    breakdown,
    monthly,
    weekly,
    categorySpend,
    headline: {
      totalCost,
      contractValue,
      collectedCash,
      unpaidMaterials,
      materialMainCost: mainMaterialScope.materials.reduce((sum, row) => sum + row.quantity * row.price, 0),
      laborCost: scope.attendance.reduce((sum, row) => sum + row.total, 0),
      operationCost: scope.operations.reduce((sum, row) => sum + row.amount, 0),
      contractCoverage: contractValue ? (collectedCash / contractValue) * 100 : 0,
      costCoverage: totalCost ? (collectedCash / totalCost) * 100 : 0,
    },
  };
}

function buildCostBreakdown(scope: ScopeData): BreakdownPoint[] {
  const entries = [
    {
      key: "materials",
      label: "Vật tư",
      value: scope.materials.reduce((sum, row) => sum + row.quantity * row.price, 0),
      rows: scope.materials.length,
    },
    {
      key: "labor",
      label: "Nhân công",
      value: scope.attendance.reduce((sum, row) => sum + row.total, 0),
      rows: scope.attendance.length,
    },
    {
      key: "subcontractors",
      label: "Thầu phụ",
      value: scope.subcontractors.reduce((sum, row) => sum + row.advance, 0),
      rows: scope.subcontractors.length,
    },
    {
      key: "operations",
      label: "Vận hành",
      value: scope.operations.reduce((sum, row) => sum + row.amount, 0),
      rows: scope.operations.length,
    },
  ];

  const total = entries.reduce((sum, entry) => sum + entry.value, 0) || 1;

  return entries.map((entry) => ({
    ...entry,
    share: (entry.value / total) * 100,
  }));
}

function buildMonthlyCostData(scope: ScopeData, monthCount: number): MonthlyCostPoint[] {
  const months = getLastMonthKeys(monthCount);
  const map = new Map<string, MonthlyCostPoint>(months.map((month) => [month, emptyMonthlyPoint(month)]));

  for (const row of scope.materials) {
    const key = monthKey(row.date);
    const entry = map.get(key);
    if (entry) entry.materials += row.quantity * row.price;
  }

  for (const row of scope.attendance) {
    const key = monthKey(row.date);
    const entry = map.get(key);
    if (entry) entry.labor += row.total;
  }

  for (const row of scope.subcontractors) {
    const key = monthKey(row.date);
    const entry = map.get(key);
    if (entry) entry.subcontractors += row.advance;
  }

  for (const row of scope.operations) {
    const key = monthKey(row.date);
    const entry = map.get(key);
    if (entry) entry.operations += row.amount;
  }

  for (const row of scope.payments) {
    const key = monthKey(row.date);
    const entry = map.get(key);
    if (entry) entry.cashIn += row.amount;
  }

  return months.map((month) => map.get(month) ?? emptyMonthlyPoint(month));
}

function buildWeeklySnapshots(scope: ScopeData, limit: number): WeeklySnapshot[] {
  const map = new Map<string, WeeklySnapshot>();
  const ensure = (week: string) => {
    const normalized = week || "Chưa rõ";
    if (!map.has(normalized)) {
      map.set(normalized, {
        week: normalized,
        materials: 0,
        labor: 0,
        subcontractors: 0,
        operations: 0,
        total: 0,
      });
    }
    return map.get(normalized)!;
  };

  for (const row of scope.materials) ensure(row.week).materials += row.quantity * row.price;
  for (const row of scope.attendance) ensure(row.week).labor += row.total;
  for (const row of scope.subcontractors) ensure(row.week).subcontractors += row.advance;
  for (const row of scope.operations) ensure(row.week).operations += row.amount;

  return [...map.values()]
    .map((row) => ({ ...row, total: row.materials + row.labor + row.subcontractors + row.operations }))
    .sort((a, b) => compareWeek(b.week, a.week))
    .slice(0, limit)
    .reverse();
}

function buildCategorySpend(scope: ScopeData, limit: number): CategorySpendPoint[] {
  const map = new Map<string, CategorySpendPoint>();
  const ensure = (category: string) => {
    const normalized = category || "Khác";
    if (!map.has(normalized)) {
      map.set(normalized, {
        category: normalized,
        total: 0,
        materials: 0,
        labor: 0,
        subcontractors: 0,
        operations: 0,
      });
    }
    return map.get(normalized)!;
  };

  for (const row of scope.materials) {
    const entry = ensure(row.category);
    const value = row.quantity * row.price;
    entry.materials += value;
    entry.total += value;
  }
  for (const row of scope.attendance) {
    const entry = ensure(row.category);
    entry.labor += row.total;
    entry.total += row.total;
  }
  for (const row of scope.subcontractors) {
    const entry = ensure(row.category);
    entry.subcontractors += row.advance;
    entry.total += row.advance;
  }
  for (const row of scope.operations) {
    const entry = ensure(row.description);
    entry.operations += row.amount;
    entry.total += row.amount;
  }

  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

function buildRecentActivities(scope: ScopeData, limit: number): RecentActivityPoint[] {
  const activities: RecentActivityPoint[] = [
    ...scope.materials.map((row) => ({
      id: `material-${row.id}`,
      type: "Vật tư",
      title: row.materialName || row.materialCode || "Phiếu vật tư",
      subtitle: row.supplier || row.category || "Chưa phân loại",
      amount: row.quantity * row.price,
      date: row.date,
    })),
    ...scope.payments.map((row) => ({
      id: `payment-${row.id}`,
      type: "Thu tiền",
      title: row.note || "Phiếu thu công trình",
      subtitle: row.projectCode,
      amount: row.amount,
      date: row.date,
    })),
    ...scope.subcontractors.map((row) => ({
      id: `subcontractor-${row.id}`,
      type: "Thầu phụ",
      title: row.contractorName || "Tạm ứng thầu phụ",
      subtitle: row.category || row.note || "Chưa ghi chú",
      amount: row.advance,
      date: row.date,
    })),
    ...scope.operations.map((row) => ({
      id: `operation-${row.id}`,
      type: "Vận hành",
      title: row.description || "Chi phí vận hành",
      subtitle: row.projectCode,
      amount: row.amount,
      date: row.date,
    })),
  ];

  return activities.sort((a, b) => compareIsoDate(b.date, a.date)).slice(0, limit);
}

function monthKey(value: string | Date) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (!value) {
    const now = new Date();
    return monthKey(now);
  }
  return value.slice(0, 7);
}

function emptyMonthlyPoint(month: string): MonthlyCostPoint {
  return {
    month,
    materials: 0,
    labor: 0,
    subcontractors: 0,
    operations: 0,
    cashIn: 0,
  };
}

function getLastMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    return monthKey(date);
  });
}

function compareIsoDate(a: string, b: string) {
  return (a || "").localeCompare(b || "");
}

function compareWeek(a: string, b: string) {
  const [aWeek = "0", aYear = "0"] = a.split(".");
  const [bWeek = "0", bYear = "0"] = b.split(".");
  return Number(aYear) - Number(bYear) || Number(aWeek) - Number(bWeek);
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
