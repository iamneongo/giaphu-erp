import type {
  AttendanceRow,
  GiaPhuDashboardData,
  GiaPhuOverviewInsights,
  GiaPhuPagedDataset,
  GiaPhuReportsData,
  GiaPhuReportsInsights,
  ReportTableState,
} from "@/lib/giaphu-erp/types";

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
  documentId?: number;
  refresh?: false;
  total?: number;
  pageIndex?: number;
  pageSize?: number;
  insights?: GiaPhuOverviewInsights | GiaPhuReportsInsights;
  filterOptions?: Record<string, Array<{ label: string; value: string }>>;
}

export interface GiaPhuPagedRowsResult<T> {
  rows: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

async function parseResponse(response: Response): Promise<GiaPhuActionResult> {
  const result = (await response.json()) as GiaPhuActionResult;

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Thao tác GiaPhu ERP thất bại.");
  }

  return result;
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

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Không tải được dữ liệu báo cáo.");
  }

  return result;
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
  filters,
  signal,
}: {
  dataset: GiaPhuPagedDataset;
  projectCode: string;
  pageIndex: number;
  pageSize: number;
  search: string;
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
