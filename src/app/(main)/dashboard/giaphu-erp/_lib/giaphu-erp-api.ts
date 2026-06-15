import type {
  ActivityLogRow,
  AttendanceRow,
  GiaPhuDashboardData,
  GiaPhuOverviewInsights,
  GiaPhuPagedDataset,
  GiaPhuReportsData,
  GiaPhuReportsInsights,
  ProjectRow,
  ReportTableState,
} from "@/lib/giaphu-erp/types";
import { normalizeVietnameseMojibake } from "@/lib/text/mojibake";

export type GiaPhuActionPayload = Record<string, unknown>;

export interface GiaPhuActionResult {
  status: "success" | "error";
  message?: string;
  data?: GiaPhuDashboardData;
  patch?: {
    attendanceUpsert?: AttendanceRow[];
    attendanceDeleteIds?: number[];
  };
  rows?: Record<string, unknown>[];
  project?: ProjectRow;
  documentId?: number;
  refresh?: false;
  total?: number;
  pageIndex?: number;
  pageSize?: number;
  insights?: GiaPhuOverviewInsights | GiaPhuReportsInsights;
  filterOptions?: Record<string, Array<{ label: string; value: string }>>;
  materialDebtSummary?: GiaPhuMaterialDebtSummary;
}

export interface GiaPhuMaterialDebtSummary {
  total: number;
  rows: number;
  suppliers: number;
}

export interface GiaPhuPagedRowsResult<T> {
  rows: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface GiaPhuActivityLogsResult {
  rows: ActivityLogRow[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

async function parseResponse(response: Response): Promise<GiaPhuActionResult> {
  const result = (await response.json()) as GiaPhuActionResult;
  const message = normalizeVietnameseMojibake(result.message);

  if (!response.ok || result.status !== "success") {
    throw new Error(message || "Thao tác GiaPhu ERP thất bại.");
  }

  return { ...result, message };
}

async function parseReportsResponse(response: Response): Promise<{
  status: "success" | "error";
  message?: string;
  data?: GiaPhuReportsData;
}> {
  const result = (await response.json()) as {
    status: "success" | "error";
    message?: string;
    data?: GiaPhuReportsData;
  };
  const message = normalizeVietnameseMojibake(result.message);

  if (!response.ok || result.status !== "success") {
    throw new Error(message || "Không tải được dữ liệu báo cáo.");
  }

  return { ...result, message };
}

export async function fetchGiaPhuData() {
  const result = await parseResponse(await fetch("/api/giaphu-erp", { cache: "no-store" }));
  if (!result.data) throw new Error("API không trả về dữ liệu ERP.");
  return result.data;
}

export async function runGiaPhuAction(action: string, payload: GiaPhuActionPayload) {
  const result = await parseResponse(
    await fetch("/api/giaphu-erp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    }),
  );

  return result;
}

export async function queryGiaPhuDocuments(payload: GiaPhuActionPayload) {
  const result = await runGiaPhuAction("queryDocuments", payload);
  return result.rows ?? [];
}

export async function fetchGiaPhuPagedRows<T>({
  dataset,
  projectCode,
  pageIndex,
  pageSize,
  search,
  sorting,
  filters,
  signal,
}: {
  dataset: GiaPhuPagedDataset;
  projectCode: string;
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting?: Array<{ id: string; desc: boolean }>;
  filters?: Record<string, string>;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    view: "rows",
    dataset,
    projectCode,
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  });

  if (search.trim()) params.set("search", search.trim());
  if (sorting?.length) params.set("sorting", JSON.stringify(sorting.slice(0, 1)));
  const activeFilters = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value && value !== "__all"),
  );
  if (Object.keys(activeFilters).length) params.set("filters", JSON.stringify(activeFilters));

  const result = await parseResponse(
    await fetch(`/api/giaphu-erp?${params.toString()}`, { cache: "no-store", signal }),
  );

  return {
    rows: (result.rows ?? []) as T[],
    total: Number(result.total ?? 0),
    pageIndex: Number(result.pageIndex ?? pageIndex),
    pageSize: Number(result.pageSize ?? pageSize),
  } satisfies GiaPhuPagedRowsResult<T>;
}

export async function fetchGiaPhuFilterOptions({
  dataset,
  projectCode,
  filters,
  signal,
}: {
  dataset: GiaPhuPagedDataset;
  projectCode: string;
  filters?: Record<string, string>;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    view: "filter-options",
    dataset,
    projectCode,
  });

  const activeFilters = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value && value !== "__all"),
  );
  if (Object.keys(activeFilters).length) params.set("filters", JSON.stringify(activeFilters));

  const result = await parseResponse(
    await fetch(`/api/giaphu-erp?${params.toString()}`, { cache: "no-store", signal }),
  );
  return result.filterOptions ?? {};
}

export async function fetchGiaPhuActivityLogs({
  pageIndex,
  pageSize,
  search,
  module,
  action,
  projectCode,
  signal,
}: {
  pageIndex: number;
  pageSize: number;
  search?: string;
  module?: string;
  action?: string;
  projectCode?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    view: "activity-logs",
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  });

  if (search?.trim()) params.set("search", search.trim());
  if (module?.trim() && module !== "__all") params.set("module", module.trim());
  if (action?.trim() && action !== "__all") params.set("action", action.trim());
  if (projectCode?.trim() && projectCode !== "__all") params.set("projectCode", projectCode.trim());

  const result = await parseResponse(
    await fetch(`/api/giaphu-erp?${params.toString()}`, { cache: "no-store", signal }),
  );

  return {
    rows: (result.rows ?? []) as unknown as ActivityLogRow[],
    total: Number(result.total ?? 0),
    pageIndex: Number(result.pageIndex ?? pageIndex),
    pageSize: Number(result.pageSize ?? pageSize),
  } satisfies GiaPhuActivityLogsResult;
}

export async function fetchGiaPhuInsights<T extends GiaPhuOverviewInsights | GiaPhuReportsInsights>({
  type,
  projectCode,
}: {
  type: "overview" | "reports";
  projectCode: string;
}) {
  const params = new URLSearchParams({
    view: "insights",
    type,
    projectCode,
  });

  const result = await parseResponse(await fetch(`/api/giaphu-erp?${params.toString()}`, { cache: "no-store" }));
  if (!result.insights) throw new Error("API không trả về dữ liệu báo cáo.");

  return result.insights as T;
}

export async function fetchGiaPhuMaterialDebtSummary({
  projectCode,
  signal,
}: {
  projectCode: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    view: "material-debt-summary",
    projectCode,
  });

  const result = await parseResponse(
    await fetch(`/api/giaphu-erp?${params.toString()}`, { cache: "no-store", signal }),
  );
  if (!result.materialDebtSummary) throw new Error("API không trả về thống kê công nợ vật tư.");

  return result.materialDebtSummary;
}

export async function fetchGiaPhuReportsData({
  projectCode,
  tables,
  signal,
}: {
  projectCode: string;
  tables?: {
    labor?: ReportTableState;
    materials?: ReportTableState;
    operations?: ReportTableState;
  };
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({ projectCode });

  if (tables) {
    params.set("tables", JSON.stringify(tables));
  }

  const result = await parseReportsResponse(
    await fetch(`/api/giaphu-erp/reports?${params.toString()}`, { cache: "no-store", signal }),
  );

  if (!result.data) throw new Error("API không trả về dữ liệu báo cáo.");
  return result.data as GiaPhuReportsData;
}

export async function uploadGiaPhuDocument(formData: FormData) {
  const result = await parseResponse(
    await fetch("/api/giaphu-erp/documents", {
      method: "POST",
      body: formData,
    }),
  );

  return result;
}
