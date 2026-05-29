import type { AttendanceRow, GiaPhuDashboardData } from "@/lib/giaphu-erp/types";

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
}

async function parseResponse(response: Response): Promise<GiaPhuActionResult> {
  const result = (await response.json()) as GiaPhuActionResult;

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Thao tác GiaPhu ERP thất bại.");
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

export async function uploadGiaPhuDocument(formData: FormData) {
  const result = await parseResponse(
    await fetch("/api/giaphu-erp/documents", {
      method: "POST",
      body: formData,
    }),
  );

  return result;
}
