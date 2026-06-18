import { getSql } from "../db/neon";
import { buildNextCatalogCode, catalogKinds, normalizeCatalogCode } from "./catalog-codes";
import {
  ATTACHMENT_DOCUMENT_DOC_TYPES,
  ATTACHMENT_DOCUMENT_PROJECT_CODE,
  STAFF_DOCUMENT_DOC_TYPES,
  STAFF_DOCUMENT_PROJECT_CODE,
} from "./document-scope";
import { isValidPhoneNumber } from "./phone";
import type {
  ActivityLogRow,
  AttendanceLockRow,
  AttendanceRow,
  CatalogItem,
  ContractRow,
  CostSummary,
  DocumentRow,
  ErpTableSorting,
  GiaPhuDashboardData,
  GiaPhuOverviewInsights,
  GiaPhuPagedDataset,
  GiaPhuReportsData,
  GiaPhuReportsInsights,
  LaborNormRow,
  MaterialRow,
  OperationRow,
  PaymentRow,
  PayrollAdjustmentRow,
  ProgressRow,
  ProjectRow,
  ReportTableState,
  StaffRow,
  StaffSkillEvaluationRow,
  SubcontractorContractRow,
  SubcontractorRow,
} from "./types";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

type Row = Record<string, unknown>;
type DashboardDataOptions = {
  activeProjectCode?: string;
  organizationId?: string;
};

const scryptAsync = promisify(scryptCallback);
const PROJECT_PIN_HASH_PREFIX = "scrypt";
const PROJECT_PIN_MIN_LENGTH = 4;

export type GiaPhuPagedRowsOptions = {
  dataset: GiaPhuPagedDataset;
  activeProjectCode?: string;
  organizationId?: string;
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sorting?: ErpTableSorting;
  filters?: Record<string, string>;
};

export type GiaPhuFilterOption = { label: string; value: string };
export type GiaPhuFilterOptionsResult = Record<string, GiaPhuFilterOption[]>;
export type GiaPhuMaterialDebtSummary = {
  total: number;
  rows: number;
  suppliers: number;
};
export type GiaPhuActivityLogOptions = {
  organizationId: string;
  userId: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  module: string;
  entityId?: string | number;
  projectCode?: string;
  summary: string;
  ipAddress?: string;
  userAgent?: string;
};
export type GiaPhuActivityLogQueryOptions = {
  organizationId: string;
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  action?: string;
  projectCode?: string;
};
export type GiaPhuActivityLogsResult = {
  rows: ActivityLogRow[];
  total: number;
  pageIndex: number;
  pageSize: number;
};

export type GiaPhuPagedRowsResult =
  | { dataset: "projects"; rows: ProjectRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "catalogs"; rows: CatalogItem[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "staff"; rows: StaffRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "contracts"; rows: ContractRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "payments"; rows: PaymentRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "documents"; rows: DocumentRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "materials"; rows: MaterialRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "attendance"; rows: AttendanceRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "laborNorms"; rows: LaborNormRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "progress"; rows: ProgressRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "subcontractors"; rows: SubcontractorRow[]; total: number; pageIndex: number; pageSize: number }
  | {
      dataset: "subcontractorContracts";
      rows: SubcontractorContractRow[];
      total: number;
      pageIndex: number;
      pageSize: number;
    }
  | { dataset: "operations"; rows: OperationRow[]; total: number; pageIndex: number; pageSize: number };

type GlobalSchemaState = typeof globalThis & {
  __giaPhuSchemaPromise?: Promise<void>;
  __giaPhuSchemaReady?: boolean;
  __giaPhuActivityLogSchemaPromise?: Promise<void>;
  __giaPhuActivityLogSchemaReady?: boolean;
  __giaPhuPerformanceIndexesPromise?: Promise<void>;
  __giaPhuPerformanceIndexesReady?: boolean;
  __giaPhuStaffDocumentNamespacePromise?: Promise<void>;
  __giaPhuStaffDocumentNamespaceReady?: boolean;
};

const emptyCatalogs = () => ({
  hangMuc: [] as CatalogItem[],
  vatTu: [] as CatalogItem[],
  vatTuPhu: [] as CatalogItem[],
  thauPhu: [] as CatalogItem[],
  nhaCungCap: [] as CatalogItem[],
});

function organizationIdFrom(value: unknown) {
  return text(value).trim();
}

function requireOrganizationId(value: unknown) {
  const organizationId = organizationIdFrom(value);
  if (!organizationId) throw new Error("Thiếu tổ chức đang hoạt động.");
  return organizationId;
}

function emptyDashboardData(): GiaPhuDashboardData {
  return {
    projects: [],
    catalogs: emptyCatalogs(),
    staff: [],
    materials: [],
    attendance: [],
    payrollAdjustments: [],
    subcontractors: [],
    subcontractorContracts: [],
    operations: [],
    laborNorms: [],
    progress: [],
    payments: [],
    contracts: [],
    attendanceLocks: [],
    summaries: {},
  };
}

const catalogFieldLabels: Record<CatalogItem["kind"], { code: string; name: string }> = {
  hangMuc: { code: "Mã hạng mục", name: "Tên hạng mục" },
  vatTu: { code: "Mã vật tư", name: "Tên vật tư" },
  vatTuPhu: { code: "Mã vật tư phụ", name: "Tên vật tư phụ" },
  thauPhu: { code: "Mã thầu phụ", name: "Tên thầu phụ" },
  nhaCungCap: { code: "Mã nhà cung cấp", name: "Tên nhà cung cấp" },
};

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function dateOnly(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function dateTime(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function limitText(value: unknown, maxLength: number) {
  const normalized = text(value).replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function activityLogFromRow(row: Row): ActivityLogRow {
  return {
    id: number(row.id),
    organizationId: text(row.organization_id),
    userId: text(row.user_id),
    actorName: text(row.actor_name),
    actorEmail: text(row.actor_email),
    action: text(row.action),
    module: text(row.module),
    entityId: text(row.entity_id),
    projectCode: text(row.project_code),
    summary: text(row.summary),
    ipAddress: text(row.ip_address),
    userAgent: text(row.user_agent),
    createdAt: dateTime(row.created_at),
  };
}

async function hashProjectPin(value: unknown) {
  const pin = text(value).trim();
  if (!pin) return "";
  if (pin.length < PROJECT_PIN_MIN_LENGTH) {
    throw new Error(`Mã PIN công trình phải có ít nhất ${PROJECT_PIN_MIN_LENGTH} ký tự.`);
  }

  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(pin, salt, 32)) as Buffer;
  return `${PROJECT_PIN_HASH_PREFIX}:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyProjectPinHash(pin: unknown, hash: unknown) {
  const normalizedPin = text(pin).trim();
  const normalizedHash = text(hash).trim();
  if (!normalizedHash) return true;
  if (!normalizedPin) return false;

  const [prefix, salt, key] = normalizedHash.split(":");
  if (prefix !== PROJECT_PIN_HASH_PREFIX || !salt || !key) return false;

  const expected = Buffer.from(key, "hex");
  const actual = (await scryptAsync(normalizedPin, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function materialCatalogKey(value: unknown) {
  return text(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function weekFromDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${String(week).padStart(2, "0")}.${utc.getUTCFullYear()}`;
}

function money(value: unknown) {
  return parseLocalizedNumber(value);
}

function decimal(value: unknown) {
  return parseLocalizedNumber(value);
}

function requireNumericInput(value: unknown, label: string) {
  const raw = text(value).trim();

  if (!raw) {
    throw new Error(`Thiếu ${label.toLowerCase()}.`);
  }

  if (!/\d/.test(raw) || !/^-?[\d\s,.]+$/.test(raw)) {
    throw new Error(`${label} phải là số hợp lệ.`);
  }

  return parseLocalizedNumber(raw);
}

function requireNonNegativeNumericInput(value: unknown, label: string) {
  const parsed = requireNumericInput(value, label);

  if (parsed < 0) {
    throw new Error(`${label} không được âm.`);
  }

  return parsed;
}

function dateInputTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date.getTime();
}

function requireDateInput(value: unknown, label: string) {
  const date = dateOnly(value).trim();

  if (!date) {
    throw new Error(`Thiếu ${label.toLowerCase()}.`);
  }

  if (dateInputTime(date) == null) {
    throw new Error(`${label} không hợp lệ.`);
  }

  return date;
}

function assertProgressDateRules(startDate: string, planEndDate: string, confirmedEndDate: string) {
  const start = dateInputTime(startDate);
  const planEnd = dateInputTime(planEndDate);
  const confirmedEnd = dateInputTime(confirmedEndDate);

  if (start == null || planEnd == null || confirmedEnd == null) return;

  if (planEnd < start) {
    throw new Error("Ngày HT dự kiến không được nhỏ hơn ngày bắt đầu.");
  }

  if (confirmedEnd < planEnd) {
    throw new Error("Ngày HT xác nhận không được nhỏ hơn ngày HT dự kiến.");
  }

  if (confirmedEnd < start) {
    throw new Error("Ngày HT xác nhận không được nhỏ hơn ngày bắt đầu.");
  }
}

function parseLocalizedNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = text(value).trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/[^\d,.-]/g, "");
  const sign = sanitized.startsWith("-") ? "-" : "";
  const digits = sanitized.replace(/-/g, "");
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");

  let normalized = digits;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = digits.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    const commaCount = (digits.match(/,/g) ?? []).length;
    normalized =
      commaCount === 1 && digits.length - lastComma - 1 !== 3 ? digits.replace(",", ".") : digits.replaceAll(",", "");
  } else if (lastDot >= 0) {
    const dotCount = (digits.match(/\./g) ?? []).length;
    normalized = dotCount === 1 && digits.length - lastDot - 1 !== 3 ? digits : digits.replaceAll(".", "");
  }

  normalized = `${sign}${normalized}`.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function projectFromRow(row: Row): ProjectRow {
  return {
    id: text(row.id || row.code),
    code: text(row.code),
    name: text(row.name),
    owner: text(row.owner),
    contact: text(row.contact),
    referrer: text(row.referrer),
    startDate: dateOnly(row.start_date),
    status: text(row.status),
    failureReason: text(row.failure_reason),
    hasPin: Boolean(text(row.pin_hash)),
  };
}

function catalogFromRow(row: Row): CatalogItem {
  return {
    id: text(row.id),
    projectCode: text(row.project_code),
    kind: text(row.kind) as CatalogItem["kind"],
    code: text(row.code),
    name: text(row.name),
    unit: text(row.unit),
    supplier: text(row.supplier),
    contact: text(row.contact),
    note: text(row.note),
    sortOrder: number(row.sort_order),
    archived: bool(row.archived),
  };
}

function staffFromRow(row: Row): StaffRow {
  return {
    id: text(row.id),
    name: text(row.name),
    team: text(row.team),
    position: text(row.position),
    salaryDay: number(row.salary_day),
    resigned: bool(row.resigned),
    offDate: dateOnly(row.off_date),
    avatarUrl: text(row.avatar_url),
    profileFiles: text(row.profile_files),
    birthYear: text(row.birth_year),
    phone: text(row.phone),
    citizenId: text(row.citizen_id),
    hometown: text(row.hometown),
    currentAddress: text(row.current_address),
    mainSkill: text(row.main_skill),
    internalLevel: text(row.internal_level),
    referrer: text(row.referrer),
    expectedStability: text(row.expected_stability),
    ranking: text(row.ranking),
    startDate: dateOnly(row.start_date),
    note: text(row.note),
  };
}

function staffSkillEvaluationFromRow(row: Row): StaffSkillEvaluationRow {
  const criteriaValue = row.criteria;
  const criteria =
    criteriaValue && typeof criteriaValue === "object" && !Array.isArray(criteriaValue)
      ? (criteriaValue as Record<string, { score: number; note: string }>)
      : {};

  return {
    id: number(row.id),
    staffId: text(row.staff_id),
    staffName: text(row.staff_name),
    date: dateOnly(row.evaluation_date),
    evaluator: text(row.evaluator),
    travelReady: text(row.travel_ready),
    statusAfterReview: text(row.status_after_review),
    leaveDate: dateOnly(row.leave_date),
    criteria,
    summaryNote: text(row.summary_note),
    newSalary: number(row.new_salary),
    totalScore: number(row.total_score),
    rank: text(row.rank),
    createdAt: dateTime(row.created_at),
  };
}

function materialFromRow(row: Row): MaterialRow {
  return {
    id: number(row.id),
    date: dateOnly(row.work_date),
    week: text(row.week),
    shift: text(row.shift),
    projectCode: text(row.project_code),
    category: text(row.category),
    materialCode: text(row.material_code),
    materialName: text(row.material_name),
    quantity: number(row.quantity),
    unit: text(row.unit),
    price: number(row.price),
    debt: text(row.debt),
    status: text(row.status),
    paymentStatus: (text(row.payment_status) || "Chưa TT") as MaterialRow["paymentStatus"],
    paymentInfo: text(row.payment_info),
    materialType: (text(row.material_type) || "VT Chính") as MaterialRow["materialType"],
    supplier: text(row.supplier),
  };
}

function attendanceFromRow(row: Row): AttendanceRow {
  return {
    id: number(row.id),
    date: dateOnly(row.work_date),
    week: text(row.week),
    shift: text(row.shift),
    projectCode: text(row.project_code),
    category: text(row.category),
    staffName: text(row.staff_name),
    position: text(row.position),
    halfDaySalary: number(row.half_day_salary),
    allowance: number(row.allowance),
    overtimeHours: number(row.overtime_hours),
    overtimeAmount: number(row.overtime_amount),
    total: number(row.total),
    status: text(row.status),
    coefficient: number(row.coefficient),
  };
}

function payrollAdjustmentFromRow(row: Row): PayrollAdjustmentRow {
  return {
    id: text(row.id),
    projectCode: text(row.project_code),
    week: text(row.week),
    category: text(row.category),
    staffName: text(row.staff_name),
    allowance: number(row.allowance),
    overtimeHours: number(row.overtime_hours),
    overtimeAmount: number(row.overtime_amount),
    adjustment: number(row.adjustment),
    note: text(row.note),
  };
}

function subcontractorFromRow(row: Row): SubcontractorRow {
  return {
    id: number(row.id),
    date: dateOnly(row.work_date),
    week: text(row.week),
    projectCode: text(row.project_code),
    category: text(row.category),
    contractorName: text(row.contractor_name),
    note: text(row.note),
    advance: number(row.advance),
    fileUrl: text(row.file_url),
    fileId: text(row.file_id),
    fileName: text(row.attachment_file_name),
    mimeType: text(row.attachment_mime_type),
    fileSize: number(row.attachment_file_size),
    hasFile: Boolean(row.attachment_has_file),
    cumulative: number(row.cumulative),
    status: text(row.status),
  };
}

function subcontractorContractFromRow(row: Row): SubcontractorContractRow {
  return {
    id: number(row.id),
    projectCode: text(row.project_code),
    contractorName: text(row.contractor_name),
    approvedCost: number(row.approved_cost),
    note: text(row.note),
    fileUrl: text(row.file_url),
    fileId: text(row.file_id),
    status: text(row.status),
    approvedBy: text(row.approved_by),
    approvedAt: dateTime(row.approved_at),
  };
}

function operationFromRow(row: Row): OperationRow {
  return {
    id: number(row.id),
    date: dateOnly(row.work_date),
    week: text(row.week),
    projectCode: text(row.project_code),
    description: text(row.description),
    amount: number(row.amount),
    fileUrl: text(row.file_url),
    fileId: text(row.file_id),
    fileName: text(row.attachment_file_name),
    mimeType: text(row.attachment_mime_type),
    fileSize: number(row.attachment_file_size),
    hasFile: Boolean(row.attachment_has_file),
  };
}

function laborNormFromRow(row: Row): LaborNormRow {
  return {
    id: number(row.id),
    projectCode: text(row.project_code),
    category: text(row.category),
    workdays: number(row.workdays),
    cost: number(row.cost),
  };
}

function progressFromRow(row: Row): ProgressRow {
  return {
    id: number(row.id),
    projectCode: text(row.project_code),
    category: text(row.category),
    startDate: dateOnly(row.start_date),
    durationDays: number(row.duration_days),
    workdays: number(row.workdays),
    planEndDate: dateOnly(row.plan_end_date),
    confirmedEndDate: dateOnly(row.confirmed_end_date),
    evaluation: text(row.evaluation),
  };
}

function paymentFromRow(row: Row): PaymentRow {
  return {
    id: number(row.id),
    projectCode: text(row.project_code),
    date: dateOnly(row.payment_date),
    amount: number(row.amount),
    note: text(row.note),
    fileId: text(row.file_id),
    fileUrl: text(row.file_url),
    fileName: text(row.attachment_file_name),
    mimeType: text(row.attachment_mime_type),
    fileSize: number(row.attachment_file_size),
    hasFile: Boolean(row.attachment_has_file),
  };
}

function contractFromRow(row: Row): ContractRow {
  return {
    id: number(row.id),
    projectCode: text(row.project_code),
    contractNo: text(row.contract_no),
    value: number(row.value),
    signedDate: dateOnly(row.signed_date),
    note: text(row.note),
    fileId: text(row.file_id),
    fileUrl: text(row.file_url),
    fileName: text(row.attachment_file_name),
    mimeType: text(row.attachment_mime_type),
    fileSize: number(row.attachment_file_size),
    hasFile: Boolean(row.attachment_has_file),
  };
}

function documentFromRow(row: Row): DocumentRow {
  return {
    id: number(row.id),
    project_code: text(row.project_code),
    doc_type: text(row.doc_type),
    file_name: text(row.file_name),
    mime_type: text(row.mime_type),
    file_size: number(row.file_size),
    note: text(row.note),
    preview_text: text(row.preview_text),
    has_file: bool(row.has_file),
  };
}

function lockFromRow(row: Row): AttendanceLockRow {
  return {
    lockKey: text(row.lock_key),
    projectCode: text(row.project_code),
    week: text(row.week),
    category: text(row.category),
    status: (text(row.status) || "OPEN") as AttendanceLockRow["status"],
    closedBy: text(row.closed_by),
    closedAt: dateTime(row.closed_at),
    openedBy: text(row.opened_by),
    openedAt: dateTime(row.opened_at),
    note: text(row.note),
  };
}

function emptySummary(): CostSummary {
  return {
    materialMain: 0,
    materialSub: 0,
    materialMep: 0,
    labor: 0,
    subcontractor: 0,
    operations: 0,
    total: 0,
  };
}

function excludeArchivedCategory(
  sql: any,
  organizationId: string,
  activeProjectCode?: string,
  categoryColumn = sql`category`,
) {
  const projectCode = text(activeProjectCode).trim();
  return sql`
    and not exists (
      select 1
      from gp_catalog_items archived_category
      where archived_category.organization_id = ${organizationId}
        and archived_category.kind = 'hangMuc'
        ${projectCode ? sql`and archived_category.project_code = ${projectCode}` : sql``}
        and archived_category.archived = true
        and lower(btrim(archived_category.name)) = lower(btrim(${categoryColumn}))
    )
  `;
}

async function getGiaPhuSummaries(activeProjectCode?: string, organizationId?: string) {
  const projectCode = text(activeProjectCode).trim();
  const orgId = organizationIdFrom(organizationId);
  if (!projectCode || !orgId) return {};

  const sql = getSql();
  const summaries: Record<string, CostSummary> = {};
  const get = (code: string) => {
    const key = code || "CHUNG";
    summaries[key] ??= emptySummary();
    return summaries[key];
  };

  const [materialRows, attendanceRows, payrollAdjustmentRows, subcontractorRows, operationRows] = await Promise.all([
    sql`
      select project_code, material_type, coalesce(sum(quantity * price), 0)::float8 as total
      from gp_materials
      where organization_id = ${orgId} and project_code = ${projectCode}
        ${excludeArchivedCategory(sql, orgId, projectCode)}
      group by project_code, material_type
    `,
    sql`
      select project_code, coalesce(sum(total), 0)::float8 as total
      from gp_attendance
      where organization_id = ${orgId} and project_code = ${projectCode}
        ${excludeArchivedCategory(sql, orgId, projectCode)}
      group by project_code
    `,
    sql`
      select project_code, coalesce(sum(adjustment), 0)::float8 as total
      from gp_payroll_adjustments
      where organization_id = ${orgId} and project_code = ${projectCode}
        ${excludeArchivedCategory(sql, orgId, projectCode)}
      group by project_code
    `,
    sql`
      select project_code, coalesce(sum(advance), 0)::float8 as total
      from gp_subcontractors
      where organization_id = ${orgId} and project_code = ${projectCode}
        ${excludeArchivedCategory(sql, orgId, projectCode)}
      group by project_code
    `,
    sql`
      select project_code, coalesce(sum(amount), 0)::float8 as total
      from gp_operations
      where organization_id = ${orgId} and project_code = ${projectCode}
      group by project_code
    `,
  ]);

  for (const row of materialRows as Row[]) {
    const summary = get(text(row.project_code));
    const amount = number(row.total);
    const materialType = text(row.material_type);
    if (materialType === "VT Phụ") summary.materialSub += amount;
    else if (materialType === "VT MEP" || materialType === "VT MEP-HVAC") summary.materialMep += amount;
    else summary.materialMain += amount;
  }

  for (const row of attendanceRows as Row[]) get(text(row.project_code)).labor += number(row.total);
  for (const row of payrollAdjustmentRows as Row[]) get(text(row.project_code)).labor += number(row.total);
  for (const row of subcontractorRows as Row[]) get(text(row.project_code)).subcontractor += number(row.total);
  for (const row of operationRows as Row[]) get(text(row.project_code)).operations += number(row.total);

  for (const summary of Object.values(summaries)) {
    summary.total =
      summary.materialMain +
      summary.materialSub +
      summary.materialMep +
      summary.labor +
      summary.subcontractor +
      summary.operations;
  }

  return summaries;
}

async function createGiaPhuSchemaInternal() {
  const sql = getSql();

  await sql`create table if not exists gp_projects (
    id bigserial unique,
    code text primary key,
    organization_id text not null default '',
    name text not null,
    owner text not null default '',
    contact text not null default '',
    referrer text not null default '',
    start_date date,
    status text not null default 'Đang thi công',
    drive_url text not null default '',
    failure_reason text not null default '',
    pin_hash text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_catalog_items (
    id text primary key,
    organization_id text not null default '',
    project_code text not null default '',
    kind text not null,
    code text not null,
    name text not null,
    unit text not null default '',
    supplier text not null default '',
    contact text not null default '',
    note text not null default '',
    sort_order integer not null default 0,
    archived boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`drop index if exists gp_catalog_items_kind_name_idx`;
  await sql`drop index if exists gp_catalog_items_org_kind_name_idx`;
  await sql`drop index if exists gp_catalog_items_org_project_hangmuc_name_idx`;
  await sql`drop index if exists gp_catalog_items_org_kind_name_supplier_idx`;
  await sql`create unique index if not exists gp_catalog_items_org_project_hangmuc_name_idx on gp_catalog_items (organization_id, project_code, lower(name)) where archived = false and kind = 'hangMuc'`;
  await sql`create unique index if not exists gp_catalog_items_org_kind_name_idx on gp_catalog_items (organization_id, kind, lower(name)) where archived = false and kind not in ('vatTu', 'vatTuPhu', 'hangMuc')`;
  await sql`create unique index if not exists gp_catalog_items_org_kind_name_supplier_idx on gp_catalog_items (organization_id, kind, lower(name), lower(supplier)) where archived = false and kind in ('vatTu', 'vatTuPhu')`;

  await sql`create table if not exists gp_staff (
    id text primary key,
    organization_id text not null default '',
    name text not null,
    team text not null default '',
    position text not null default '',
    salary_day numeric not null default 0,
    resigned boolean not null default false,
    off_date date,
    avatar_url text not null default '',
    profile_files text not null default '',
    birth_year text not null default '',
    phone text not null default '',
    citizen_id text not null default '',
    hometown text not null default '',
    current_address text not null default '',
    main_skill text not null default '',
    internal_level text not null default '',
    referrer text not null default '',
    expected_stability text not null default '',
    ranking text not null default '',
    start_date date,
    note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_staff_skill_evaluations (
    id bigserial primary key,
    organization_id text not null default '',
    staff_id text not null default '',
    staff_name text not null default '',
    evaluation_date date,
    evaluator text not null default '',
    travel_ready text not null default '',
    status_after_review text not null default '',
    leave_date date,
    criteria jsonb not null default '{}'::jsonb,
    summary_note text not null default '',
    new_salary numeric not null default 0,
    total_score numeric not null default 0,
    rank text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_contracts (
    id bigserial primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    contract_no text not null default '',
    value numeric not null default 0,
    signed_date date,
    note text not null default '',
    file_url text not null default '',
    file_id text not null default '',
    created_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_payments (
    id bigserial primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    payment_date date,
    amount numeric not null default 0,
    note text not null default '',
    file_url text not null default '',
    file_id text not null default '',
    created_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_documents (
    id bigserial primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    doc_type text not null default '',
    file_name text not null default '',
    mime_type text not null default '',
    file_id text not null default '',
    file_url text not null default '',
    file_data text not null default '',
    file_size bigint not null default 0,
    note text not null default '',
    preview_text text not null default '',
    created_at timestamptz not null default now()
  )`;
  await ensureDocumentFileColumns();

  await sql`create table if not exists gp_materials (
    id bigserial primary key,
    work_date date,
    week text not null default '',
    shift text not null default '',
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    material_code text not null default '',
    material_name text not null default '',
    quantity numeric not null default 0,
    unit text not null default '',
    price numeric not null default 0,
    debt text not null default '',
    status text not null default '',
    payment_status text not null default 'Chưa TT',
    payment_info text not null default '',
    material_type text not null default 'VT Chính',
    supplier text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_attendance (
    id bigserial primary key,
    work_date date,
    week text not null default '',
    shift text not null default '',
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    staff_name text not null default '',
    position text not null default '',
    half_day_salary numeric not null default 0,
    allowance numeric not null default 0,
    overtime_hours numeric not null default 0,
    overtime_amount numeric not null default 0,
    total numeric not null default 0,
    status text not null default '',
    coefficient numeric not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_payroll_adjustments (
    id text primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    week text not null default '',
    category text not null default '',
    staff_name text not null default '',
    allowance numeric not null default 0,
    overtime_hours numeric not null default 0,
    overtime_amount numeric not null default 0,
    adjustment numeric not null default 0,
    note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_attendance_locks (
    lock_key text primary key,
    organization_id text not null default '',
    project_code text not null,
    week text not null,
    category text not null,
    status text not null default 'OPEN',
    closed_by text not null default '',
    closed_at timestamptz,
    opened_by text not null default '',
    opened_at timestamptz,
    note text not null default '',
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_subcontractors (
    id bigserial primary key,
    work_date date,
    week text not null default '',
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    contractor_name text not null default '',
    note text not null default '',
    advance numeric not null default 0,
    file_url text not null default '',
    file_id text not null default '',
    cumulative numeric not null default 0,
    status text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_subcontractor_contracts (
    id bigserial primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    contractor_name text not null default '',
    approved_cost numeric not null default 0,
    note text not null default '',
    file_url text not null default '',
    file_id text not null default '',
    status text not null default 'Chờ duyệt',
    approved_by text not null default '',
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`drop index if exists gp_subcontractor_contracts_project_name_idx`;
  await sql`create unique index if not exists gp_subcontractor_contracts_org_project_name_idx on gp_subcontractor_contracts (organization_id, project_code, lower(contractor_name))`;

  await sql`create table if not exists gp_operations (
    id bigserial primary key,
    work_date date,
    week text not null default '',
    organization_id text not null default '',
    project_code text not null,
    description text not null default '',
    amount numeric not null default 0,
    file_url text not null default '',
    file_id text not null default '',
    created_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_labor_norms (
    id bigserial primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    workdays numeric not null default 0,
    cost numeric not null default 0,
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_progress (
    id bigserial primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    start_date date,
    duration_days integer not null default 0,
    workdays numeric not null default 0,
    plan_end_date date,
    confirmed_end_date date,
    evaluation text not null default '',
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_activity_logs (
    id bigserial primary key,
    organization_id text not null default '',
    user_id text not null default '',
    actor_name text not null default '',
    actor_email text not null default '',
    action text not null default '',
    module text not null default '',
    entity_id text not null default '',
    project_code text not null default '',
    summary text not null default '',
    ip_address text not null default '',
    user_agent text not null default '',
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists gp_activity_logs_org_created_idx on gp_activity_logs (organization_id, created_at desc, id desc)`;
  await sql`create index if not exists gp_activity_logs_org_module_idx on gp_activity_logs (organization_id, module, created_at desc)`;

  await ensureOrganizationColumns();

  await ensureGiaPhuPerformanceIndexes();
}

async function ensureActivityLogSchema() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuActivityLogSchemaReady) return;

  state.__giaPhuActivityLogSchemaPromise ??= (async () => {
    const sql = getSql();
    await sql`create table if not exists gp_activity_logs (
      id bigserial primary key,
      organization_id text not null default '',
      user_id text not null default '',
      actor_name text not null default '',
      actor_email text not null default '',
      action text not null default '',
      module text not null default '',
      entity_id text not null default '',
      project_code text not null default '',
      summary text not null default '',
      ip_address text not null default '',
      user_agent text not null default '',
      created_at timestamptz not null default now()
    )`;
    await sql`create index if not exists gp_activity_logs_org_created_idx on gp_activity_logs (organization_id, created_at desc, id desc)`;
    await sql`create index if not exists gp_activity_logs_org_module_idx on gp_activity_logs (organization_id, module, created_at desc)`;
  })().catch((error) => {
    state.__giaPhuActivityLogSchemaPromise = undefined;
    throw error;
  });

  await state.__giaPhuActivityLogSchemaPromise;
  state.__giaPhuActivityLogSchemaReady = true;
}

export async function createGiaPhuSchema() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuSchemaReady) {
    await ensureActivityLogSchema();
    await ensureGiaPhuPerformanceIndexes();
    await ensureStaffDocumentNamespace();
    return;
  }

  const sql = getSql();
  const readinessRows = await sql`
    select
      to_regclass('public.gp_projects') as projects_table,
      to_regclass('public.gp_progress') as progress_table
  `;
  const readiness = (readinessRows as Row[])[0] ?? {};

  if (readiness.projects_table && readiness.progress_table) {
    state.__giaPhuSchemaReady = true;
    await ensureOrganizationColumns();
    await ensureGiaPhuPerformanceIndexes();
    await ensureStaffDocumentNamespace();
    return;
  }

  state.__giaPhuSchemaPromise ??= createGiaPhuSchemaInternal().catch((error) => {
    state.__giaPhuSchemaPromise = undefined;
    throw error;
  });
  await state.__giaPhuSchemaPromise;
  state.__giaPhuSchemaReady = true;
  await ensureGiaPhuPerformanceIndexes();
  await ensureStaffDocumentNamespace();
}

export async function recordGiaPhuActivity(options: GiaPhuActivityLogOptions) {
  await ensureActivityLogSchema();
  const organizationId = requireOrganizationId(options.organizationId);
  const action = limitText(options.action, 120);
  const module = limitText(options.module, 120);
  const summary = limitText(options.summary, 600);

  if (!action || !module || !summary) return;

  const sql = getSql();
  await sql`
    insert into gp_activity_logs (
      organization_id,
      user_id,
      actor_name,
      actor_email,
      action,
      module,
      entity_id,
      project_code,
      summary,
      ip_address,
      user_agent
    )
    values (
      ${organizationId},
      ${limitText(options.userId, 160)},
      ${limitText(options.actorName, 160)},
      ${limitText(options.actorEmail, 220)},
      ${action},
      ${module},
      ${limitText(options.entityId, 160)},
      ${limitText(options.projectCode, 120)},
      ${summary},
      ${limitText(options.ipAddress, 120)},
      ${limitText(options.userAgent, 500)}
    )
  `;
}

export async function getGiaPhuActivityLogs(options: GiaPhuActivityLogQueryOptions): Promise<GiaPhuActivityLogsResult> {
  await ensureActivityLogSchema();
  const sql = getSql();
  const organizationId = requireOrganizationId(options.organizationId);
  const pageIndex = normalizePageIndex(options.pageIndex);
  const pageSize = normalizePageSize(options.pageSize);
  const offset = pageIndex * pageSize;
  const search = text(options.search).trim();
  const moduleFilter = text(options.module).trim();
  const actionFilter = text(options.action).trim();
  const projectCodeFilter = text(options.projectCode).trim();
  const whereSearch = search
    ? sql`
        and (
          summary ilike ${`%${search}%`}
          or actor_name ilike ${`%${search}%`}
          or actor_email ilike ${`%${search}%`}
          or action ilike ${`%${search}%`}
          or module ilike ${`%${search}%`}
          or entity_id ilike ${`%${search}%`}
          or project_code ilike ${`%${search}%`}
        )
      `
    : sql``;
  const whereModule = moduleFilter ? sql`and module = ${moduleFilter}` : sql``;
  const whereAction = actionFilter ? sql`and action = ${actionFilter}` : sql``;
  const whereProjectCode = projectCodeFilter ? sql`and project_code = ${projectCodeFilter}` : sql``;

  const [countRows, rows] = await Promise.all([
    sql`
      select count(*)::int as total
      from gp_activity_logs
      where organization_id = ${organizationId}
        ${whereSearch}
        ${whereModule}
        ${whereAction}
        ${whereProjectCode}
    `,
    sql`
      select *
      from gp_activity_logs
      where organization_id = ${organizationId}
        ${whereSearch}
        ${whereModule}
        ${whereAction}
        ${whereProjectCode}
      order by created_at desc, id desc
      limit ${pageSize}
      offset ${offset}
    `,
  ]);

  return {
    rows: (rows as Row[]).map(activityLogFromRow),
    total: totalFromCountRows(countRows),
    pageIndex,
    pageSize,
  };
}

async function ensureOrganizationColumns() {
  const sql = getSql();

  await sql`create table if not exists gp_activity_logs (
    id bigserial primary key,
    organization_id text not null default '',
    user_id text not null default '',
    actor_name text not null default '',
    actor_email text not null default '',
    action text not null default '',
    module text not null default '',
    entity_id text not null default '',
    project_code text not null default '',
    summary text not null default '',
    ip_address text not null default '',
    user_agent text not null default '',
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists gp_activity_logs_org_created_idx on gp_activity_logs (organization_id, created_at desc, id desc)`;
  await sql`create index if not exists gp_activity_logs_org_module_idx on gp_activity_logs (organization_id, module, created_at desc)`;
  await sql`create table if not exists gp_payroll_adjustments (
    id text primary key,
    organization_id text not null default '',
    project_code text not null references gp_projects(code) on delete cascade,
    week text not null default '',
    category text not null default '',
    staff_name text not null default '',
    allowance numeric not null default 0,
    overtime_hours numeric not null default 0,
    overtime_amount numeric not null default 0,
    adjustment numeric not null default 0,
    note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`alter table gp_projects add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_projects add column if not exists id bigserial`;
  await sql`alter table gp_projects add column if not exists pin_hash text not null default ''`;
  await sql`alter table gp_catalog_items add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_catalog_items add column if not exists project_code text not null default ''`;
  await sql`alter table gp_catalog_items add column if not exists supplier text not null default ''`;
  await sql`alter table gp_catalog_items add column if not exists sort_order integer not null default 0`;
  await sql`alter table gp_catalog_items add column if not exists archived boolean not null default false`;
  await sql`alter table gp_staff add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_staff add column if not exists avatar_url text not null default ''`;
  await sql`alter table gp_staff add column if not exists profile_files text not null default ''`;
  await sql`alter table gp_staff add column if not exists birth_year text not null default ''`;
  await sql`alter table gp_staff add column if not exists phone text not null default ''`;
  await sql`alter table gp_staff add column if not exists citizen_id text not null default ''`;
  await sql`alter table gp_staff add column if not exists hometown text not null default ''`;
  await sql`alter table gp_staff add column if not exists current_address text not null default ''`;
  await sql`alter table gp_staff add column if not exists main_skill text not null default ''`;
  await sql`alter table gp_staff add column if not exists internal_level text not null default ''`;
  await sql`alter table gp_staff add column if not exists referrer text not null default ''`;
  await sql`alter table gp_staff add column if not exists expected_stability text not null default ''`;
  await sql`alter table gp_staff add column if not exists ranking text not null default ''`;
  await sql`alter table gp_staff add column if not exists start_date date`;
  await sql`alter table gp_staff add column if not exists note text not null default ''`;
  await sql`create table if not exists gp_staff_skill_evaluations (
    id bigserial primary key,
    organization_id text not null default '',
    staff_id text not null default '',
    staff_name text not null default '',
    evaluation_date date,
    evaluator text not null default '',
    travel_ready text not null default '',
    status_after_review text not null default '',
    leave_date date,
    criteria jsonb not null default '{}'::jsonb,
    summary_note text not null default '',
    new_salary numeric not null default 0,
    total_score numeric not null default 0,
    rank text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`alter table gp_contracts add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_contracts add column if not exists file_url text not null default ''`;
  await sql`alter table gp_contracts add column if not exists file_id text not null default ''`;
  await sql`alter table gp_payments add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_payments add column if not exists file_url text not null default ''`;
  await sql`alter table gp_payments add column if not exists file_id text not null default ''`;
  await sql`alter table gp_documents add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_materials add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_attendance add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_payroll_adjustments add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_payroll_adjustments add column if not exists allowance numeric not null default 0`;
  await sql`alter table gp_payroll_adjustments add column if not exists overtime_hours numeric not null default 0`;
  await sql`alter table gp_payroll_adjustments add column if not exists overtime_amount numeric not null default 0`;
  await sql`alter table gp_payroll_adjustments add column if not exists adjustment numeric not null default 0`;
  await sql`alter table gp_payroll_adjustments add column if not exists note text not null default ''`;
  await sql`alter table gp_attendance_locks add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_subcontractors add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_subcontractor_contracts add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_operations add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_labor_norms add column if not exists organization_id text not null default ''`;
  await sql`alter table gp_progress add column if not exists organization_id text not null default ''`;
  await sql`drop index if exists gp_catalog_items_kind_name_idx`;
  await sql`drop index if exists gp_catalog_items_org_kind_name_idx`;
  await sql`drop index if exists gp_catalog_items_org_project_hangmuc_name_idx`;
  await sql`drop index if exists gp_catalog_items_org_kind_name_supplier_idx`;
  await migrateProjectScopedCategories();
  await sql`create unique index if not exists gp_catalog_items_org_project_hangmuc_name_idx on gp_catalog_items (organization_id, project_code, lower(name)) where archived = false and kind = 'hangMuc'`;
  await sql`create unique index if not exists gp_catalog_items_org_kind_name_idx on gp_catalog_items (organization_id, kind, lower(name)) where archived = false and kind not in ('vatTu', 'vatTuPhu', 'hangMuc')`;
  await sql`create unique index if not exists gp_catalog_items_org_kind_name_supplier_idx on gp_catalog_items (organization_id, kind, lower(name), lower(supplier)) where archived = false and kind in ('vatTu', 'vatTuPhu')`;
  await sql`drop index if exists gp_subcontractor_contracts_project_name_idx`;
  await sql`create unique index if not exists gp_subcontractor_contracts_org_project_name_idx on gp_subcontractor_contracts (organization_id, project_code, lower(contractor_name))`;
  await sql`alter table gp_labor_norms drop constraint if exists gp_labor_norms_project_code_category_key`;
  await sql`alter table gp_progress drop constraint if exists gp_progress_project_code_category_key`;
  await sql`create unique index if not exists gp_labor_norms_org_project_category_idx on gp_labor_norms (organization_id, project_code, category)`;
  await sql`create unique index if not exists gp_progress_org_project_category_idx on gp_progress (organization_id, project_code, category)`;
}

async function migrateProjectScopedCategories() {
  const sql = getSql();

  await sql`
    insert into gp_catalog_items (
      id,
      organization_id,
      project_code,
      kind,
      code,
      name,
      unit,
      supplier,
      contact,
      note,
      sort_order,
      archived,
      created_at,
      updated_at
    )
    select
      legacy.organization_id || ':' || project.code || ':hangMuc:' || coalesce(nullif(legacy.code, ''), legacy.id),
      legacy.organization_id,
      project.code,
      legacy.kind,
      legacy.code,
      legacy.name,
      legacy.unit,
      legacy.supplier,
      legacy.contact,
      legacy.note,
      legacy.sort_order,
      legacy.archived,
      legacy.created_at,
      now()
    from gp_catalog_items legacy
    join gp_projects project
      on project.organization_id = legacy.organization_id
    where legacy.kind = 'hangMuc'
      and legacy.project_code = ''
    on conflict do nothing
  `;
}

async function cleanupOrphanDocumentReferences() {
  await ensureDocumentFileColumns();
  const sql = getSql();

  await sql`
    update gp_subcontractors target
    set file_url = '',
        file_id = '',
        updated_at = now()
    where file_id <> ''
      and not exists (
        select 1
        from gp_documents document
        where document.organization_id = target.organization_id
          and document.id::text = target.file_id
          and document.file_data <> ''
      )
  `;

  await sql`
    update gp_subcontractor_contracts target
    set file_url = '',
        file_id = '',
        updated_at = now()
    where file_id <> ''
      and not exists (
        select 1
        from gp_documents document
        where document.organization_id = target.organization_id
          and document.id::text = target.file_id
          and document.file_data <> ''
      )
  `;

  await sql`
    update gp_operations target
    set file_url = '',
        file_id = ''
    where file_id <> ''
      and not exists (
        select 1
        from gp_documents document
        where document.organization_id = target.organization_id
          and document.id::text = target.file_id
          and document.file_data <> ''
      )
  `;

  await sql`
    update gp_contracts target
    set file_url = '',
        file_id = ''
    where file_id <> ''
      and not exists (
        select 1
        from gp_documents document
        where document.organization_id = target.organization_id
          and document.id::text = target.file_id
          and document.file_data <> ''
      )
  `;

  await sql`
    update gp_payments target
    set file_url = '',
        file_id = ''
    where file_id <> ''
      and not exists (
        select 1
        from gp_documents document
        where document.organization_id = target.organization_id
          and document.id::text = target.file_id
          and document.file_data <> ''
      )
  `;

  await sql`
    delete from gp_documents document
    where document.doc_type in ('Tạm ứng thầu phụ', 'Chi phí vận hành', 'Hợp đồng công trình', 'Phiếu thu / chứng từ thu tiền')
      and document.preview_text like document.doc_type || ' ·%'
      and not exists (
        select 1 from gp_subcontractors target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_subcontractor_contracts target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_operations target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_contracts target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_payments target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
  `;
}

async function deleteAttachmentDocumentIfUnused(documentId: number, organizationId: string) {
  if (!documentId) return;
  const sql = getSql();

  await sql`
    delete from gp_documents document
    where document.organization_id = ${organizationId}
      and document.id = ${documentId}
      and document.doc_type in ('Tạm ứng thầu phụ', 'Chi phí vận hành', 'Hợp đồng thầu phụ', 'Hợp đồng công trình', 'Phiếu thu / chứng từ thu tiền')
      and not exists (
        select 1 from gp_subcontractors target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_subcontractor_contracts target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_operations target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_contracts target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
      and not exists (
        select 1 from gp_payments target
        where target.organization_id = document.organization_id
          and target.file_id = document.id::text
      )
  `;
}

function documentFileUrl(documentId: number) {
  return `/api/giaphu-erp/documents/${documentId}/file`;
}

async function syncAttachmentDocumentReference(documentId: number, organizationId: string) {
  if (!documentId) return;
  const sql = getSql();
  const fileUrl = documentFileUrl(documentId);

  await Promise.all([
    sql`
      update gp_subcontractors
      set file_url = ${fileUrl}
      where organization_id = ${organizationId}
        and file_id = ${String(documentId)}
    `,
    sql`
      update gp_subcontractor_contracts
      set file_url = ${fileUrl}
      where organization_id = ${organizationId}
        and file_id = ${String(documentId)}
    `,
    sql`
      update gp_operations
      set file_url = ${fileUrl}
      where organization_id = ${organizationId}
        and file_id = ${String(documentId)}
    `,
    sql`
      update gp_contracts
      set file_url = ${fileUrl}
      where organization_id = ${organizationId}
        and file_id = ${String(documentId)}
    `,
    sql`
      update gp_payments
      set file_url = ${fileUrl}
      where organization_id = ${organizationId}
        and file_id = ${String(documentId)}
    `,
  ]);
}

async function ensureGiaPhuPerformanceIndexes() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuPerformanceIndexesReady) return;

  const sql = getSql();
  state.__giaPhuPerformanceIndexesPromise ??= (async () => {
    await ensureOrganizationColumns();
    await cleanupOrphanDocumentReferences();
    await sql`create unique index if not exists gp_projects_id_unique_idx on gp_projects (id)`;
    await sql`create index if not exists gp_projects_org_id_idx on gp_projects (organization_id, id)`;
    await sql`create index if not exists gp_projects_org_date_idx on gp_projects (organization_id, updated_at desc, code asc)`;
    await sql`drop index if exists gp_catalog_items_org_kind_idx`;
    await sql`create index if not exists gp_catalog_items_org_kind_idx on gp_catalog_items (organization_id, kind, project_code, archived, sort_order, code, name)`;
    await sql`create index if not exists gp_catalog_items_org_kind_supplier_idx on gp_catalog_items (organization_id, kind, supplier)`;
    await sql`create index if not exists gp_staff_org_idx on gp_staff (organization_id, id asc, name asc)`;
    await sql`create index if not exists gp_staff_skill_evaluations_org_staff_idx on gp_staff_skill_evaluations (organization_id, staff_id, evaluation_date desc, id desc)`;
    await sql`create index if not exists gp_materials_project_date_idx on gp_materials (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_materials_org_project_date_idx on gp_materials (organization_id, project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_materials_project_filters_idx on gp_materials (project_code, material_type, payment_status, week, category, supplier)`;
    await sql`create index if not exists gp_materials_org_project_filters_idx on gp_materials (organization_id, project_code, material_type, payment_status, week, category, supplier)`;
    await sql`create index if not exists gp_attendance_project_date_idx on gp_attendance (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_attendance_org_project_date_idx on gp_attendance (organization_id, project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_attendance_project_filters_idx on gp_attendance (project_code, week, category, staff_name, position, shift)`;
    await sql`create index if not exists gp_attendance_org_project_filters_idx on gp_attendance (organization_id, project_code, week, category, staff_name, position, shift)`;
    await sql`create index if not exists gp_payroll_adjustments_org_project_staff_idx on gp_payroll_adjustments (organization_id, project_code, week, category, staff_name)`;
    await sql`create index if not exists gp_subcontractors_project_date_idx on gp_subcontractors (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_subcontractors_org_project_date_idx on gp_subcontractors (organization_id, project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_subcontractors_project_filters_idx on gp_subcontractors (project_code, week, category, contractor_name)`;
    await sql`create index if not exists gp_subcontractors_org_project_filters_idx on gp_subcontractors (organization_id, project_code, week, category, contractor_name)`;
    await sql`create index if not exists gp_operations_project_date_idx on gp_operations (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_operations_org_project_date_idx on gp_operations (organization_id, project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_operations_project_week_idx on gp_operations (project_code, week)`;
    await sql`create index if not exists gp_operations_org_project_week_idx on gp_operations (organization_id, project_code, week)`;
    await sql`create index if not exists gp_documents_project_date_idx on gp_documents (project_code, created_at desc, id desc)`;
    await sql`create index if not exists gp_documents_org_project_date_idx on gp_documents (organization_id, project_code, created_at desc, id desc)`;
    await sql`create index if not exists gp_documents_project_type_idx on gp_documents (project_code, doc_type)`;
    await sql`create index if not exists gp_contracts_project_date_idx on gp_contracts (project_code, signed_date desc, id desc)`;
    await sql`create index if not exists gp_contracts_org_project_date_idx on gp_contracts (organization_id, project_code, signed_date desc, id desc)`;
    await sql`create index if not exists gp_payments_project_date_idx on gp_payments (project_code, payment_date desc, id desc)`;
    await sql`create index if not exists gp_payments_org_project_date_idx on gp_payments (organization_id, project_code, payment_date desc, id desc)`;
    await sql`create index if not exists gp_labor_norms_project_category_idx on gp_labor_norms (project_code, category)`;
    await sql`create index if not exists gp_progress_project_category_idx on gp_progress (project_code, category)`;
  })().catch((error) => {
    state.__giaPhuPerformanceIndexesPromise = undefined;
    throw error;
  });

  await state.__giaPhuPerformanceIndexesPromise;
  state.__giaPhuPerformanceIndexesReady = true;
}

export async function getGiaPhuProjectList(options: { organizationId?: string } = {}): Promise<ProjectRow[]> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  if (!organizationId) return [];

  const projectRows = await sql`
    select *
    from gp_projects
    where organization_id = ${organizationId}
      and code not like 'GLOBAL\\_%' escape '\\'
    order by updated_at desc, code asc
  `;
  return (projectRows as Row[]).map(projectFromRow);
}

export async function getGiaPhuDashboardData(options: DashboardDataOptions = {}): Promise<GiaPhuDashboardData> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  if (!organizationId) return emptyDashboardData();

  const [projects, staffRows] = await Promise.all([
    getGiaPhuProjectList({ organizationId }),
    sql`select * from gp_staff where organization_id = ${organizationId} order by id asc, name asc`,
  ]);
  const requestedProject = text(options.activeProjectCode).trim();
  const activeProjectCode =
    projects.find((project) => project.code === requestedProject || project.id === requestedProject)?.code ??
    projects[0]?.code ??
    "";
  const catalogRows = activeProjectCode
    ? await sql`
        select *
        from gp_catalog_items
        where organization_id = ${organizationId}
          and (kind <> 'hangMuc' or project_code = ${activeProjectCode})
        order by kind asc, archived asc, case when sort_order > 0 then 0 else 1 end asc, sort_order asc, code asc, name asc
      `
    : await sql`
        select *
        from gp_catalog_items
        where organization_id = ${organizationId}
          and kind <> 'hangMuc'
        order by kind asc, archived asc, case when sort_order > 0 then 0 else 1 end asc, sort_order asc, code asc, name asc
      `;
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId, activeProjectCode);

  const [
    materialRows,
    attendanceRows,
    payrollAdjustmentRows,
    subcontractorRows,
    subcontractorContractRows,
    operationRows,
    laborNormRows,
    progressRows,
    paymentRows,
    contractRows,
    lockRows,
    summaries,
  ] = await Promise.all([
    activeProjectCode
      ? sql`select * from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by work_date desc nulls last, id desc limit 80`
      : sql`select * from gp_materials where false`,
    activeProjectCode
      ? sql`select * from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by work_date desc nulls last, id desc limit 280`
      : sql`select * from gp_attendance where false`,
    activeProjectCode
      ? sql`select * from gp_payroll_adjustments where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by updated_at desc`
      : sql`select * from gp_payroll_adjustments where false`,
    activeProjectCode
      ? sql`select * from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by work_date desc nulls last, id desc limit 80`
      : sql`select * from gp_subcontractors where false`,
    activeProjectCode
      ? sql`select * from gp_subcontractor_contracts where organization_id = ${organizationId} and project_code = ${activeProjectCode} order by updated_at desc, id desc limit 80`
      : sql`select * from gp_subcontractor_contracts where false`,
    activeProjectCode
      ? sql`select * from gp_operations where organization_id = ${organizationId} and (project_code = ${activeProjectCode} or project_code = 'CHUNG DOANH NGHIỆP') order by work_date desc nulls last, id desc limit 80`
      : sql`select * from gp_operations where false`,
    activeProjectCode
      ? sql`select * from gp_labor_norms where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by category asc`
      : sql`select * from gp_labor_norms where false`,
    activeProjectCode
      ? sql`select * from gp_progress where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by category asc`
      : sql`select * from gp_progress where false`,
    activeProjectCode
      ? sql`
          select
            payment.*,
            coalesce(document.file_name, '') as attachment_file_name,
            coalesce(document.mime_type, '') as attachment_mime_type,
            coalesce(document.file_size, 0) as attachment_file_size,
            coalesce(document.file_data <> '', false) as attachment_has_file
          from gp_payments payment
          left join gp_documents document
            on document.organization_id = payment.organization_id
           and document.id::text = payment.file_id
          where payment.organization_id = ${organizationId} and payment.project_code = ${activeProjectCode}
          order by payment.payment_date desc, payment.id desc
          limit 40
        `
      : sql`select * from gp_payments where false`,
    activeProjectCode
      ? sql`
          select
            contract.*,
            coalesce(document.file_name, '') as attachment_file_name,
            coalesce(document.mime_type, '') as attachment_mime_type,
            coalesce(document.file_size, 0) as attachment_file_size,
            coalesce(document.file_data <> '', false) as attachment_has_file
          from gp_contracts contract
          left join gp_documents document
            on document.organization_id = contract.organization_id
           and document.id::text = contract.file_id
          where contract.organization_id = ${organizationId} and contract.project_code = ${activeProjectCode}
          order by contract.signed_date desc, contract.id desc
          limit 40
        `
      : sql`select * from gp_contracts where false`,
    activeProjectCode
      ? sql`select * from gp_attendance_locks where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by updated_at desc`
      : sql`select * from gp_attendance_locks where false`,
    getGiaPhuSummaries(activeProjectCode, organizationId),
  ]);

  const catalogs = emptyCatalogs();

  for (const row of (catalogRows as Row[]).map(catalogFromRow)) {
    if (catalogKinds.includes(row.kind)) catalogs[row.kind].push(row);
  }

  const materials = (materialRows as Row[]).map(materialFromRow);
  const attendance = (attendanceRows as Row[]).map(attendanceFromRow);
  const subcontractors = (subcontractorRows as Row[]).map(subcontractorFromRow);
  const operations = (operationRows as Row[]).map(operationFromRow);

  return {
    projects,
    catalogs,
    staff: (staffRows as Row[]).map(staffFromRow),
    materials,
    attendance,
    payrollAdjustments: (payrollAdjustmentRows as Row[]).map(payrollAdjustmentFromRow),
    subcontractors,
    subcontractorContracts: (subcontractorContractRows as Row[]).map(subcontractorContractFromRow),
    operations,
    laborNorms: (laborNormRows as Row[]).map(laborNormFromRow),
    progress: (progressRows as Row[]).map(progressFromRow),
    payments: (paymentRows as Row[]).map(paymentFromRow),
    contracts: (contractRows as Row[]).map(contractFromRow),
    attendanceLocks: (lockRows as Row[]).map(lockFromRow),
    summaries,
  };
}
function normalizePageSize(value: unknown) {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.trunc(parsed), 5), 100);
}

function normalizePageIndex(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

function totalFromCountRows(rows: unknown) {
  const [row] = rows as Row[];
  return number(row?.total);
}

function normalizeSorting(sorting?: ErpTableSorting) {
  const sort = sorting?.find((item) => typeof item.id === "string" && item.id.trim());
  return sort ? { id: text(sort.id).trim(), desc: Boolean(sort.desc) } : undefined;
}

function pagedRowsOrderBy(sql: any, dataset: GiaPhuPagedDataset, sorting?: ErpTableSorting) {
  const sort = normalizeSorting(sorting);
  const sortId = sort?.id ?? "";

  if (sort?.desc) {
    switch (dataset) {
      case "projects":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'code' then code end desc nulls last,
            case when ${sortId} = 'name' then name end desc nulls last,
            case when ${sortId} = 'owner' then owner end desc nulls last,
            case when ${sortId} = 'contact' then contact end desc nulls last,
            case when ${sortId} = 'referrer' then referrer end desc nulls last,
            case when ${sortId} = 'startDate' then start_date end desc nulls last,
            case when ${sortId} = 'status' then status end desc nulls last,
            case when ${sortId} = 'failureReason' then failure_reason end desc nulls last,
            updated_at desc, code asc
        `;
      case "catalogs":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'kind' then kind end desc nulls last,
            case when ${sortId} = 'code' then code end desc nulls last,
            case when ${sortId} = 'name' then name end desc nulls last,
            case when ${sortId} = 'unit' then unit end desc nulls last,
            case when ${sortId} = 'archived' then archived end desc nulls last,
            case when ${sortId} = 'contact' then contact end desc nulls last,
            case when ${sortId} = 'note' then note end desc nulls last,
            kind asc, archived asc, case when sort_order > 0 then 0 else 1 end asc, sort_order asc, code asc, name asc
        `;
      case "staff":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'name' then name end desc nulls last,
            case when ${sortId} = 'team' then team end desc nulls last,
            case when ${sortId} = 'position' then position end desc nulls last,
            case when ${sortId} = 'salaryDay' then salary_day end desc nulls last,
            case when ${sortId} = 'resigned' then resigned end desc nulls last,
            case when ${sortId} = 'offDate' then off_date end desc nulls last,
            id asc, name asc
        `;
      case "contracts":
        return sql`
          order by
            case when ${sortId} = 'id' then contract.id end desc nulls last,
            case when ${sortId} = 'contractNo' then contract.contract_no end desc nulls last,
            case when ${sortId} = 'value' then contract.value end desc nulls last,
            case when ${sortId} = 'signedDate' then contract.signed_date end desc nulls last,
            case when ${sortId} = 'note' then contract.note end desc nulls last,
            contract.signed_date desc nulls last, contract.id desc
        `;
      case "payments":
        return sql`
          order by
            case when ${sortId} = 'id' then payment.id end desc nulls last,
            case when ${sortId} in ('date', 'paymentDate') then payment.payment_date end desc nulls last,
            case when ${sortId} = 'amount' then payment.amount end desc nulls last,
            case when ${sortId} = 'note' then payment.note end desc nulls last,
            payment.payment_date desc nulls last, payment.id desc
        `;
      case "documents":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'doc_type' then doc_type end desc nulls last,
            case when ${sortId} = 'file_name' then file_name end desc nulls last,
            case when ${sortId} = 'file_size' then file_size end desc nulls last,
            case when ${sortId} = 'note' then note end desc nulls last,
            case when ${sortId} = 'preview_text' then preview_text end desc nulls last,
            case when ${sortId} = 'has_file' then (file_data <> '') end desc nulls last,
            created_at desc, id desc
        `;
      case "materials":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} in ('date', 'workDate') then work_date end desc nulls last,
            case when ${sortId} = 'week' then week end desc nulls last,
            case when ${sortId} = 'shift' then shift end desc nulls last,
            case when ${sortId} = 'category' then category end desc nulls last,
            case when ${sortId} = 'materialCode' then material_code end desc nulls last,
            case when ${sortId} = 'materialName' then material_name end desc nulls last,
            case when ${sortId} = 'quantity' then quantity end desc nulls last,
            case when ${sortId} = 'unit' then unit end desc nulls last,
            case when ${sortId} = 'price' then price end desc nulls last,
            case when ${sortId} in ('amount', 'total') then quantity * price end desc nulls last,
            case when ${sortId} = 'debt' then debt end desc nulls last,
            case when ${sortId} = 'status' then status end desc nulls last,
            case when ${sortId} = 'paymentStatus' then payment_status end desc nulls last,
            case when ${sortId} = 'paymentInfo' then payment_info end desc nulls last,
            case when ${sortId} = 'materialType' then material_type end desc nulls last,
            case when ${sortId} = 'supplier' then supplier end desc nulls last,
            work_date desc nulls last, id desc
        `;
      case "attendance":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} in ('date', 'workDate') then work_date end desc nulls last,
            case when ${sortId} = 'week' then week end desc nulls last,
            case when ${sortId} = 'shift' then shift end desc nulls last,
            case when ${sortId} = 'category' then category end desc nulls last,
            case when ${sortId} = 'staffName' then staff_name end desc nulls last,
            case when ${sortId} = 'position' then position end desc nulls last,
            case when ${sortId} = 'halfDaySalary' then half_day_salary end desc nulls last,
            case when ${sortId} = 'allowance' then allowance end desc nulls last,
            case when ${sortId} = 'overtimeHours' then overtime_hours end desc nulls last,
            case when ${sortId} = 'overtimeAmount' then overtime_amount end desc nulls last,
            case when ${sortId} = 'total' then total end desc nulls last,
            case when ${sortId} = 'status' then status end desc nulls last,
            case when ${sortId} = 'coefficient' then coefficient end desc nulls last,
            work_date desc nulls last, id desc
        `;
      case "laborNorms":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'category' then category end desc nulls last,
            case when ${sortId} = 'workdays' then workdays end desc nulls last,
            case when ${sortId} = 'cost' then cost end desc nulls last,
            category asc, id desc
        `;
      case "progress":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'category' then category end desc nulls last,
            case when ${sortId} = 'startDate' then start_date end desc nulls last,
            case when ${sortId} = 'durationDays' then duration_days end desc nulls last,
            case when ${sortId} = 'workdays' then workdays end desc nulls last,
            case when ${sortId} = 'planEndDate' then plan_end_date end desc nulls last,
            case when ${sortId} = 'confirmedEndDate' then confirmed_end_date end desc nulls last,
            case when ${sortId} = 'evaluation' then evaluation end desc nulls last,
            start_date desc nulls last, category asc, id desc
        `;
      case "subcontractors":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} in ('date', 'workDate') then work_date end desc nulls last,
            case when ${sortId} = 'week' then week end desc nulls last,
            case when ${sortId} = 'category' then category end desc nulls last,
            case when ${sortId} = 'contractorName' then contractor_name end desc nulls last,
            case when ${sortId} = 'note' then note end desc nulls last,
            case when ${sortId} = 'advance' then advance end desc nulls last,
            case when ${sortId} = 'cumulative' then cumulative end desc nulls last,
            case when ${sortId} = 'status' then status end desc nulls last,
            work_date desc nulls last, id desc
        `;
      case "subcontractorContracts":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} = 'contractorName' then contractor_name end desc nulls last,
            case when ${sortId} = 'approvedCost' then approved_cost end desc nulls last,
            case when ${sortId} = 'note' then note end desc nulls last,
            case when ${sortId} = 'status' then status end desc nulls last,
            case when ${sortId} = 'approvedBy' then approved_by end desc nulls last,
            case when ${sortId} = 'approvedAt' then approved_at end desc nulls last,
            updated_at desc, id desc
        `;
      case "operations":
        return sql`
          order by
            case when ${sortId} = 'id' then id end desc nulls last,
            case when ${sortId} in ('date', 'workDate') then work_date end desc nulls last,
            case when ${sortId} = 'week' then week end desc nulls last,
            case when ${sortId} = 'description' then description end desc nulls last,
            case when ${sortId} = 'amount' then amount end desc nulls last,
            work_date desc nulls last, id desc
        `;
    }
  }

  switch (dataset) {
    case "projects":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'code' then code end asc nulls last,
          case when ${sortId} = 'name' then name end asc nulls last,
          case when ${sortId} = 'owner' then owner end asc nulls last,
          case when ${sortId} = 'contact' then contact end asc nulls last,
          case when ${sortId} = 'referrer' then referrer end asc nulls last,
          case when ${sortId} = 'startDate' then start_date end asc nulls last,
          case when ${sortId} = 'status' then status end asc nulls last,
          case when ${sortId} = 'failureReason' then failure_reason end asc nulls last,
          updated_at desc, code asc
      `;
    case "catalogs":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'kind' then kind end asc nulls last,
          case when ${sortId} = 'code' then code end asc nulls last,
          case when ${sortId} = 'name' then name end asc nulls last,
          case when ${sortId} = 'unit' then unit end asc nulls last,
          case when ${sortId} = 'archived' then archived end asc nulls last,
          case when ${sortId} = 'contact' then contact end asc nulls last,
          case when ${sortId} = 'note' then note end asc nulls last,
          kind asc, archived asc, case when sort_order > 0 then 0 else 1 end asc, sort_order asc, code asc, name asc
      `;
    case "staff":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'name' then name end asc nulls last,
          case when ${sortId} = 'team' then team end asc nulls last,
          case when ${sortId} = 'position' then position end asc nulls last,
          case when ${sortId} = 'salaryDay' then salary_day end asc nulls last,
          case when ${sortId} = 'resigned' then resigned end asc nulls last,
          case when ${sortId} = 'offDate' then off_date end asc nulls last,
          id asc, name asc
      `;
    case "contracts":
      return sql`
        order by
          case when ${sortId} = 'id' then contract.id end asc nulls last,
          case when ${sortId} = 'contractNo' then contract.contract_no end asc nulls last,
          case when ${sortId} = 'value' then contract.value end asc nulls last,
          case when ${sortId} = 'signedDate' then contract.signed_date end asc nulls last,
          case when ${sortId} = 'note' then contract.note end asc nulls last,
          contract.signed_date desc nulls last, contract.id desc
      `;
    case "payments":
      return sql`
        order by
          case when ${sortId} = 'id' then payment.id end asc nulls last,
          case when ${sortId} in ('date', 'paymentDate') then payment.payment_date end asc nulls last,
          case when ${sortId} = 'amount' then payment.amount end asc nulls last,
          case when ${sortId} = 'note' then payment.note end asc nulls last,
          payment.payment_date desc nulls last, payment.id desc
      `;
    case "documents":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'doc_type' then doc_type end asc nulls last,
          case when ${sortId} = 'file_name' then file_name end asc nulls last,
          case when ${sortId} = 'file_size' then file_size end asc nulls last,
          case when ${sortId} = 'note' then note end asc nulls last,
          case when ${sortId} = 'preview_text' then preview_text end asc nulls last,
          case when ${sortId} = 'has_file' then (file_data <> '') end asc nulls last,
          created_at desc, id desc
      `;
    case "materials":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} in ('date', 'workDate') then work_date end asc nulls last,
          case when ${sortId} = 'week' then week end asc nulls last,
          case when ${sortId} = 'shift' then shift end asc nulls last,
          case when ${sortId} = 'category' then category end asc nulls last,
          case when ${sortId} = 'materialCode' then material_code end asc nulls last,
          case when ${sortId} = 'materialName' then material_name end asc nulls last,
          case when ${sortId} = 'quantity' then quantity end asc nulls last,
          case when ${sortId} = 'unit' then unit end asc nulls last,
          case when ${sortId} = 'price' then price end asc nulls last,
          case when ${sortId} in ('amount', 'total') then quantity * price end asc nulls last,
          case when ${sortId} = 'debt' then debt end asc nulls last,
          case when ${sortId} = 'status' then status end asc nulls last,
          case when ${sortId} = 'paymentStatus' then payment_status end asc nulls last,
          case when ${sortId} = 'paymentInfo' then payment_info end asc nulls last,
          case when ${sortId} = 'materialType' then material_type end asc nulls last,
          case when ${sortId} = 'supplier' then supplier end asc nulls last,
          work_date desc nulls last, id desc
      `;
    case "attendance":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} in ('date', 'workDate') then work_date end asc nulls last,
          case when ${sortId} = 'week' then week end asc nulls last,
          case when ${sortId} = 'shift' then shift end asc nulls last,
          case when ${sortId} = 'category' then category end asc nulls last,
          case when ${sortId} = 'staffName' then staff_name end asc nulls last,
          case when ${sortId} = 'position' then position end asc nulls last,
          case when ${sortId} = 'halfDaySalary' then half_day_salary end asc nulls last,
          case when ${sortId} = 'allowance' then allowance end asc nulls last,
          case when ${sortId} = 'overtimeHours' then overtime_hours end asc nulls last,
          case when ${sortId} = 'overtimeAmount' then overtime_amount end asc nulls last,
          case when ${sortId} = 'total' then total end asc nulls last,
          case when ${sortId} = 'status' then status end asc nulls last,
          case when ${sortId} = 'coefficient' then coefficient end asc nulls last,
          work_date desc nulls last, id desc
      `;
    case "laborNorms":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'category' then category end asc nulls last,
          case when ${sortId} = 'workdays' then workdays end asc nulls last,
          case when ${sortId} = 'cost' then cost end asc nulls last,
          category asc, id desc
      `;
    case "progress":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'category' then category end asc nulls last,
          case when ${sortId} = 'startDate' then start_date end asc nulls last,
          case when ${sortId} = 'durationDays' then duration_days end asc nulls last,
          case when ${sortId} = 'workdays' then workdays end asc nulls last,
          case when ${sortId} = 'planEndDate' then plan_end_date end asc nulls last,
          case when ${sortId} = 'confirmedEndDate' then confirmed_end_date end asc nulls last,
          case when ${sortId} = 'evaluation' then evaluation end asc nulls last,
          start_date desc nulls last, category asc, id desc
      `;
    case "subcontractors":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} in ('date', 'workDate') then work_date end asc nulls last,
          case when ${sortId} = 'week' then week end asc nulls last,
          case when ${sortId} = 'category' then category end asc nulls last,
          case when ${sortId} = 'contractorName' then contractor_name end asc nulls last,
          case when ${sortId} = 'note' then note end asc nulls last,
          case when ${sortId} = 'advance' then advance end asc nulls last,
          case when ${sortId} = 'cumulative' then cumulative end asc nulls last,
          case when ${sortId} = 'status' then status end asc nulls last,
          work_date desc nulls last, id desc
      `;
    case "subcontractorContracts":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} = 'contractorName' then contractor_name end asc nulls last,
          case when ${sortId} = 'approvedCost' then approved_cost end asc nulls last,
          case when ${sortId} = 'note' then note end asc nulls last,
          case when ${sortId} = 'status' then status end asc nulls last,
          case when ${sortId} = 'approvedBy' then approved_by end asc nulls last,
          case when ${sortId} = 'approvedAt' then approved_at end asc nulls last,
          updated_at desc, id desc
      `;
    case "operations":
      return sql`
        order by
          case when ${sortId} = 'id' then id end asc nulls last,
          case when ${sortId} in ('date', 'workDate') then work_date end asc nulls last,
          case when ${sortId} = 'week' then week end asc nulls last,
          case when ${sortId} = 'description' then description end asc nulls last,
          case when ${sortId} = 'amount' then amount end asc nulls last,
          work_date desc nulls last, id desc
      `;
  }
}

function distinctOptions(rows: unknown): GiaPhuFilterOption[] {
  return (rows as Row[])
    .map((row) => text(row.value).trim())
    .filter(Boolean)
    .map((value) => ({ label: value, value }));
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonthKeys(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    return monthKey(date);
  });
}

function emptyMonthlyPoint(month: string) {
  return {
    month,
    materials: 0,
    labor: 0,
    subcontractors: 0,
    operations: 0,
    cashIn: 0,
  };
}

function buildBreakdownFromRows(rows: Row[]) {
  const labels: Record<string, string> = {
    materials: "Vật tư",
    labor: "Nhân công",
    subcontractors: "Thầu phụ",
    operations: "Vận hành",
  };
  const total = rows.reduce((sum, row) => sum + number(row.value), 0) || 1;

  return rows.map((row) => ({
    key: text(row.key),
    label: labels[text(row.key)] ?? text(row.key),
    value: number(row.value),
    rows: number(row.rows),
    share: (number(row.value) / total) * 100,
  }));
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function normalizeWeek(value: unknown) {
  return text(value) || "Chưa rõ";
}

function compareWeekDesc(a: string, b: string) {
  const [aWeek = "0", aYear = "0"] = a.split(".");
  const [bWeek = "0", bYear = "0"] = b.split(".");
  return Number(bYear) - Number(aYear) || Number(bWeek) - Number(aWeek);
}

async function resolveActiveProjectCode(activeProjectCode?: string, organizationId?: string) {
  const sql = getSql();
  const orgId = organizationIdFrom(organizationId);
  if (!orgId) return "";
  const requestedCode = text(activeProjectCode).trim();

  if (requestedCode) {
    const rows = (await sql`
      select code
      from gp_projects
      where organization_id = ${orgId} and (code = ${requestedCode} or id::text = ${requestedCode})
      limit 1
    `) as Row[];
    if (rows[0]?.code) return text(rows[0].code);
  }

  const rows = (await sql`
    select code
    from gp_projects
    where organization_id = ${orgId}
    order by updated_at desc, code asc
    limit 1
  `) as Row[];
  return text(rows[0]?.code);
}

export async function getGiaPhuOverviewInsights(options: DashboardDataOptions = {}): Promise<GiaPhuOverviewInsights> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode, organizationId);
  const monthlyKeys = lastMonthKeys(6);

  if (!activeProjectCode) {
    const monthly = monthlyKeys.map(emptyMonthlyPoint);
    return {
      monthly,
      breakdown: buildBreakdownFromRows([]),
      recentActivities: [],
      categorySpend: [],
      headline: {
        contractValue: 0,
        collectedCash: 0,
        remainingReceivable: 0,
        totalCost: 0,
        materialMainCost: 0,
        materialSubCost: 0,
        laborCost: 0,
        subcontractorCost: 0,
        operationCost: 0,
        provisionalProfit: 0,
        openMaterialDebt: 0,
        activeCategories: 0,
        activeWeeks: 0,
        costTrend: 0,
        cashTrend: 0,
      },
    };
  }
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId, activeProjectCode);

  const [
    materialBreakdown,
    materialTypeRows,
    laborBreakdown,
    subcontractorBreakdown,
    operationBreakdown,
    contractRows,
    paymentRows,
    unpaidRows,
    activeRows,
    monthlyMaterialRows,
    monthlyLaborRows,
    monthlySubcontractorRows,
    monthlyOperationRows,
    monthlyPaymentRows,
    categoryMaterialRows,
    categoryLaborRows,
    categorySubcontractorRows,
    categoryOperationRows,
    recentMaterialRows,
    recentPaymentRows,
    recentSubcontractorRows,
    recentOperationRows,
  ] = await Promise.all([
    sql`select 'materials' as key, count(*)::int as rows, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}`,
    sql`select material_type, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by material_type`,
    sql`select 'labor' as key, count(*)::int as rows, coalesce(sum(total), 0)::float8 as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}`,
    sql`select 'subcontractors' as key, count(*)::int as rows, coalesce(sum(advance), 0)::float8 as value from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}`,
    sql`select 'operations' as key, count(*)::int as rows, coalesce(sum(amount), 0)::float8 as value from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(value), 0)::float8 as total from gp_contracts where organization_id = ${organizationId} and project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(amount), 0)::float8 as total from gp_payments where organization_id = ${organizationId} and project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(quantity * price), 0)::float8 as total from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and payment_status <> 'Đã TT' ${activeCategoryOnly}`,
    sql`
      select
        (
          select count(distinct category)::int from (
            select category from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
            union all select category from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
            union all select category from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
            union all select description as category from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode}
            union all select category from gp_progress where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
          ) categories where coalesce(category, '') <> ''
        ) as active_categories,
        (
          select count(distinct week)::int from (
            select week from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
            union all select week from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
            union all select week from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}
            union all select week from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode}
          ) weeks where coalesce(week, '') <> ''
        ) as active_weeks
    `,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(total), 0)::float8 as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(advance), 0)::float8 as value from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(payment_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_payments where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(quantity * price), 0)::float8 as materials from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(total), 0)::float8 as labor from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(advance), 0)::float8 as subcontractors from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select coalesce(description, 'Khác') as category, coalesce(sum(amount), 0)::float8 as operations from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select id, material_name, material_code, supplier, category, quantity, price, work_date from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by work_date desc nulls last, id desc limit 5`,
    sql`select id, note, amount, payment_date from gp_payments where organization_id = ${organizationId} and project_code = ${activeProjectCode} order by payment_date desc nulls last, id desc limit 5`,
    sql`select id, contractor_name, category, note, advance, work_date from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} order by work_date desc nulls last, id desc limit 5`,
    sql`select id, description, amount, work_date from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} order by work_date desc nulls last, id desc limit 5`,
  ]);

  const breakdown = buildBreakdownFromRows([
    ...(materialBreakdown as Row[]),
    ...(laborBreakdown as Row[]),
    ...(subcontractorBreakdown as Row[]),
    ...(operationBreakdown as Row[]),
  ]);
  const monthlyMap = new Map(monthlyKeys.map((month) => [month, emptyMonthlyPoint(month)]));
  const addMonthly = (rows: unknown, key: "materials" | "labor" | "subcontractors" | "operations" | "cashIn") => {
    for (const row of rows as Row[]) {
      const entry = monthlyMap.get(text(row.month));
      if (entry) entry[key] += number(row.value);
    }
  };
  addMonthly(monthlyMaterialRows, "materials");
  addMonthly(monthlyLaborRows, "labor");
  addMonthly(monthlySubcontractorRows, "subcontractors");
  addMonthly(monthlyOperationRows, "operations");
  addMonthly(monthlyPaymentRows, "cashIn");

  const categoryMap = new Map<
    string,
    { category: string; total: number; materials: number; labor: number; subcontractors: number; operations: number }
  >();
  const ensureCategory = (category: string) => {
    const key = category || "Khác";
    const current = categoryMap.get(key) ?? {
      category: key,
      total: 0,
      materials: 0,
      labor: 0,
      subcontractors: 0,
      operations: 0,
    };
    categoryMap.set(key, current);
    return current;
  };
  for (const row of categoryMaterialRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.materials += number(row.materials);
    entry.total += number(row.materials);
  }
  for (const row of categoryLaborRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.labor += number(row.labor);
    entry.total += number(row.labor);
  }
  for (const row of categorySubcontractorRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.subcontractors += number(row.subcontractors);
    entry.total += number(row.subcontractors);
  }
  for (const row of categoryOperationRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.operations += number(row.operations);
    entry.total += number(row.operations);
  }

  const recentActivities = [
    ...(recentMaterialRows as Row[]).map((row) => ({
      id: `material-${number(row.id)}`,
      type: "Vật tư",
      title: text(row.material_name) || text(row.material_code) || "Phiếu vật tư",
      subtitle: text(row.supplier) || text(row.category) || "Chưa phân loại",
      amount: number(row.quantity) * number(row.price),
      date: dateOnly(row.work_date),
    })),
    ...(recentPaymentRows as Row[]).map((row) => ({
      id: `payment-${number(row.id)}`,
      type: "Thu tiền",
      title: text(row.note) || "Phiếu thu công trình",
      subtitle: activeProjectCode,
      amount: number(row.amount),
      date: dateOnly(row.payment_date),
    })),
    ...(recentSubcontractorRows as Row[]).map((row) => ({
      id: `subcontractor-${number(row.id)}`,
      type: "Thầu phụ",
      title: text(row.contractor_name) || "Tạm ứng thầu phụ",
      subtitle: text(row.category) || text(row.note) || "Chưa ghi chú",
      amount: number(row.advance),
      date: dateOnly(row.work_date),
    })),
    ...(recentOperationRows as Row[]).map((row) => ({
      id: `operation-${number(row.id)}`,
      type: "Vận hành",
      title: text(row.description) || "Chi phí vận hành",
      subtitle: activeProjectCode,
      amount: number(row.amount),
      date: dateOnly(row.work_date),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const monthly = monthlyKeys.map((month) => monthlyMap.get(month) ?? emptyMonthlyPoint(month));
  const latest = monthly.at(-1) ?? emptyMonthlyPoint(monthKey(new Date()));
  const previous = monthly.at(-2) ?? emptyMonthlyPoint(monthKey(new Date()));
  const currentCost = latest.materials + latest.labor + latest.subcontractors + latest.operations;
  const previousCost = previous.materials + previous.labor + previous.subcontractors + previous.operations;
  const totalCost = breakdown.reduce((sum, row) => sum + row.value, 0);
  const materialMainCost = (materialTypeRows as Row[])
    .filter((row) => text(row.material_type) === "VT Chính")
    .reduce((sum, row) => sum + number(row.value), 0);
  const materialSubCost = (materialTypeRows as Row[])
    .filter((row) => text(row.material_type) !== "VT Chính")
    .reduce((sum, row) => sum + number(row.value), 0);
  const laborCost = number((laborBreakdown as Row[])[0]?.value);
  const subcontractorCost = number((subcontractorBreakdown as Row[])[0]?.value);
  const operationCost = number((operationBreakdown as Row[])[0]?.value);
  const [contractTotal] = contractRows as Row[];
  const [paymentTotal] = paymentRows as Row[];
  const [unpaidTotal] = unpaidRows as Row[];
  const [activeTotals] = activeRows as Row[];

  const contractValue = number(contractTotal?.total);
  const collectedCash = number(paymentTotal?.total);

  return {
    monthly,
    breakdown,
    recentActivities,
    categorySpend: [...categoryMap.values()].sort((a, b) => b.total - a.total).slice(0, 6),
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
      openMaterialDebt: number(unpaidTotal?.total),
      activeCategories: number(activeTotals?.active_categories),
      activeWeeks: number(activeTotals?.active_weeks),
      costTrend: percentChange(currentCost, previousCost),
      cashTrend: percentChange(latest.cashIn, previous.cashIn),
    },
  };
}

export async function getGiaPhuMaterialDebtSummary(
  options: DashboardDataOptions = {},
): Promise<GiaPhuMaterialDebtSummary> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode, organizationId);

  if (!activeProjectCode) {
    return { total: 0, rows: 0, suppliers: 0 };
  }

  const [summary] = (await sql`
    select
      coalesce(sum(quantity * price), 0)::float8 as total,
      count(*)::int as rows,
      count(distinct nullif(supplier, ''))::int as suppliers
    from gp_materials
    where organization_id = ${organizationId}
      and project_code = ${activeProjectCode}
      and (payment_status <> 'Đã TT' or debt = 'Có')
      ${excludeArchivedCategory(sql, organizationId, activeProjectCode)}
  `) as Row[];

  return {
    total: number(summary?.total),
    rows: number(summary?.rows),
    suppliers: number(summary?.suppliers),
  };
}

export async function getGiaPhuReportsInsights(options: DashboardDataOptions = {}): Promise<GiaPhuReportsInsights> {
  const overview = await getGiaPhuOverviewInsights(options);
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode, organizationId);
  const monthlyKeys = lastMonthKeys(8);

  if (!activeProjectCode) {
    return {
      breakdown: overview.breakdown,
      monthly: monthlyKeys.map(emptyMonthlyPoint),
      weekly: [],
      categorySpend: [],
      headline: {
        totalCost: 0,
        contractValue: 0,
        collectedCash: 0,
        unpaidMaterials: 0,
        materialMainCost: 0,
        laborCost: 0,
        operationCost: 0,
        contractCoverage: 0,
        costCoverage: 0,
      },
    };
  }
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId, activeProjectCode);

  const [
    monthlyMaterialRows,
    monthlyLaborRows,
    monthlySubcontractorRows,
    monthlyOperationRows,
    monthlyPaymentRows,
    weeklyMaterialRows,
    weeklyLaborRows,
    weeklySubcontractorRows,
    weeklyOperationRows,
  ] = await Promise.all([
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' ${activeCategoryOnly} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(total), 0)::float8 as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select null::text as month, 0::float8 as value where false`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(payment_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_payments where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select week, coalesce(sum(quantity * price), 0)::float8 as materials from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' ${activeCategoryOnly} group by 1`,
    sql`select week, coalesce(sum(total), 0)::float8 as labor from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select null::text as week, 0::float8 as subcontractors where false`,
    sql`select week, coalesce(sum(amount), 0)::float8 as operations from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
  ]);

  const monthlyMap = new Map(monthlyKeys.map((month) => [month, emptyMonthlyPoint(month)]));
  const addMonthly = (rows: unknown, key: "materials" | "labor" | "subcontractors" | "operations" | "cashIn") => {
    for (const row of rows as Row[]) {
      const entry = monthlyMap.get(text(row.month));
      if (entry) entry[key] += number(row.value);
    }
  };
  addMonthly(monthlyMaterialRows, "materials");
  addMonthly(monthlyLaborRows, "labor");
  addMonthly(monthlySubcontractorRows, "subcontractors");
  addMonthly(monthlyOperationRows, "operations");
  addMonthly(monthlyPaymentRows, "cashIn");

  const weeklyMap = new Map<
    string,
    { week: string; materials: number; labor: number; subcontractors: number; operations: number; total: number }
  >();
  const ensureWeek = (week: unknown) => {
    const key = normalizeWeek(week);
    const current = weeklyMap.get(key) ?? {
      week: key,
      materials: 0,
      labor: 0,
      subcontractors: 0,
      operations: 0,
      total: 0,
    };
    weeklyMap.set(key, current);
    return current;
  };
  for (const row of weeklyMaterialRows as Row[]) ensureWeek(row.week).materials += number(row.materials);
  for (const row of weeklyLaborRows as Row[]) ensureWeek(row.week).labor += number(row.labor);
  for (const row of weeklySubcontractorRows as Row[]) ensureWeek(row.week).subcontractors += number(row.subcontractors);
  for (const row of weeklyOperationRows as Row[]) ensureWeek(row.week).operations += number(row.operations);
  const weekly = [...weeklyMap.values()]
    .map((row) => ({ ...row, total: row.materials + row.labor + row.subcontractors + row.operations }))
    .sort((a, b) => compareWeekDesc(a.week, b.week))
    .slice(0, 8)
    .reverse();
  const totalCost = overview.headline.materialMainCost + overview.headline.laborCost + overview.headline.operationCost;
  const breakdown = [
    {
      key: "materials",
      label: "VT Chính",
      value: overview.headline.materialMainCost,
      rows: 0,
      share: totalCost ? (overview.headline.materialMainCost / totalCost) * 100 : 0,
    },
    {
      key: "labor",
      label: "Nhân công",
      value: overview.headline.laborCost,
      rows: 0,
      share: totalCost ? (overview.headline.laborCost / totalCost) * 100 : 0,
    },
    {
      key: "operations",
      label: "Vận hành",
      value: overview.headline.operationCost,
      rows: 0,
      share: totalCost ? (overview.headline.operationCost / totalCost) * 100 : 0,
    },
  ];

  return {
    breakdown,
    monthly: monthlyKeys.map((month) => monthlyMap.get(month) ?? emptyMonthlyPoint(month)),
    weekly,
    categorySpend: overview.categorySpend.slice(0, 8),
    headline: {
      totalCost,
      contractValue: overview.headline.contractValue,
      collectedCash: overview.headline.collectedCash,
      unpaidMaterials: overview.headline.openMaterialDebt,
      materialMainCost: overview.headline.materialMainCost,
      laborCost: overview.headline.laborCost,
      operationCost: overview.headline.operationCost,
      contractCoverage: overview.headline.contractValue
        ? (overview.headline.collectedCash / overview.headline.contractValue) * 100
        : 0,
      costCoverage: totalCost ? (overview.headline.collectedCash / totalCost) * 100 : 0,
    },
  };
}

function normalizeReportTableState(state?: ReportTableState) {
  return {
    pageIndex: normalizePageIndex(state?.pageIndex),
    pageSize: normalizePageSize(state?.pageSize),
    search: text(state?.search).trim(),
    sorting: normalizeSorting(state?.sorting) ? [normalizeSorting(state?.sorting)!] : [],
    filters: state?.filters ?? {},
  };
}

function reportFilterValue(state: ReturnType<typeof normalizeReportTableState>, key: string) {
  const value = text(state.filters[key]).trim();
  return value && value !== "__all" ? value : "";
}

function optionsFromValues(values: unknown) {
  return Array.isArray(values)
    ? values
        .map((value) => text(value).trim())
        .filter(Boolean)
        .map((value) => ({ label: value, value }))
    : [];
}

function reportPagedResult<T>(
  rows: Row[],
  state: ReturnType<typeof normalizeReportTableState>,
  mapper: (row: Row) => T,
  filterOptions: GiaPhuFilterOptionsResult,
) {
  return {
    rows: rows.map(mapper),
    total: number(rows[0]?.__total),
    pageIndex: state.pageIndex,
    pageSize: state.pageSize,
    filterOptions,
  };
}

function emptyReportsInsights(monthlyKeys: string[]): GiaPhuReportsInsights {
  return {
    breakdown: [],
    monthly: monthlyKeys.map(emptyMonthlyPoint),
    weekly: [],
    categorySpend: [],
    headline: {
      totalCost: 0,
      contractValue: 0,
      collectedCash: 0,
      unpaidMaterials: 0,
      materialMainCost: 0,
      laborCost: 0,
      operationCost: 0,
      contractCoverage: 0,
      costCoverage: 0,
    },
  };
}

export async function getGiaPhuReportsData(
  options: {
    organizationId?: string;
    activeProjectCode?: string;
    tables?: {
      labor?: ReportTableState;
      materials?: ReportTableState;
      operations?: ReportTableState;
    };
  } = {},
): Promise<GiaPhuReportsData> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode, organizationId);
  const monthlyKeys = lastMonthKeys(8);
  const laborState = normalizeReportTableState(options.tables?.labor);
  const materialState = normalizeReportTableState(options.tables?.materials);
  const operationState = normalizeReportTableState(options.tables?.operations);

  if (!activeProjectCode) {
    const emptyTable = {
      rows: [],
      total: 0,
      pageIndex: 0,
      pageSize: 10,
      filterOptions: {},
    };

    return {
      activeProjectCode: "",
      insights: emptyReportsInsights(monthlyKeys),
      tables: {
        labor: emptyTable,
        materials: emptyTable,
        operations: emptyTable,
      },
    };
  }

  const laborOffset = laborState.pageIndex * laborState.pageSize;
  const materialOffset = materialState.pageIndex * materialState.pageSize;
  const operationOffset = operationState.pageIndex * operationState.pageSize;
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId, activeProjectCode);
  const laborPattern = `%${laborState.search}%`;
  const materialPattern = `%${materialState.search}%`;
  const operationPattern = `%${operationState.search}%`;
  const laborWeekFilter = reportFilterValue(laborState, "week");
  const laborCategoryFilter = reportFilterValue(laborState, "category");
  const laborStaffFilter = reportFilterValue(laborState, "staffName");
  const laborPositionFilter = reportFilterValue(laborState, "position");
  const materialWeekFilter = reportFilterValue(materialState, "week");
  const materialCategoryFilter = reportFilterValue(materialState, "category");
  const materialSupplierFilter = reportFilterValue(materialState, "supplier");
  const operationWeekFilter = reportFilterValue(operationState, "week");

  const laborWhere = sql`
    organization_id = ${organizationId}
    and project_code = ${activeProjectCode}
    ${laborState.search ? sql`and lower(concat_ws(' ', week, shift, category, staff_name, position, status)) like lower(${laborPattern})` : sql``}
    ${laborWeekFilter ? sql`and week = ${laborWeekFilter}` : sql``}
    ${laborCategoryFilter ? sql`and category = ${laborCategoryFilter}` : sql``}
    ${laborStaffFilter ? sql`and staff_name = ${laborStaffFilter}` : sql``}
    ${laborPositionFilter ? sql`and position = ${laborPositionFilter}` : sql``}
    ${activeCategoryOnly}
  `;
  const materialWhere = sql`
    organization_id = ${organizationId}
    and project_code = ${activeProjectCode}
    and material_type = 'VT Chính'
    ${materialState.search ? sql`and lower(concat_ws(' ', week, shift, category, material_code, material_name, unit, debt, status, payment_status, payment_info, supplier)) like lower(${materialPattern})` : sql``}
    ${materialWeekFilter ? sql`and week = ${materialWeekFilter}` : sql``}
    ${materialCategoryFilter ? sql`and category = ${materialCategoryFilter}` : sql``}
    ${materialSupplierFilter ? sql`and supplier = ${materialSupplierFilter}` : sql``}
    ${activeCategoryOnly}
  `;
  const operationWhere = sql`
    organization_id = ${organizationId}
    and project_code = ${activeProjectCode}
    ${operationState.search ? sql`and lower(concat_ws(' ', week, description)) like lower(${operationPattern})` : sql``}
    ${operationWeekFilter ? sql`and week = ${operationWeekFilter}` : sql``}
  `;

  const [
    materialTypeRows,
    laborTotalRows,
    operationTotalRows,
    contractRows,
    paymentRows,
    unpaidRows,
    monthlyMaterialRows,
    monthlyLaborRows,
    monthlyOperationRows,
    monthlyPaymentRows,
    weeklyMaterialRows,
    weeklyLaborRows,
    weeklyOperationRows,
    categoryMaterialRows,
    categoryLaborRows,
    categoryOperationRows,
    laborRows,
    materialRows,
    operationRows,
    laborOptionRows,
    materialOptionRows,
    operationOptionRows,
  ] = await Promise.all([
    sql`select material_type, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by material_type`,
    sql`select count(*)::int as rows, coalesce(sum(total), 0)::float8 as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly}`,
    sql`select count(*)::int as rows, coalesce(sum(amount), 0)::float8 as value from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(value), 0)::float8 as total from gp_contracts where organization_id = ${organizationId} and project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(amount), 0)::float8 as total from gp_payments where organization_id = ${organizationId} and project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(quantity * price), 0)::float8 as total from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and payment_status <> 'Đã TT' ${activeCategoryOnly}`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' ${activeCategoryOnly} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(total), 0)::float8 as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(payment_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_payments where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select week, coalesce(sum(quantity * price), 0)::float8 as materials from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' ${activeCategoryOnly} group by 1`,
    sql`select week, coalesce(sum(total), 0)::float8 as labor from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select week, coalesce(sum(amount), 0)::float8 as operations from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(quantity * price), 0)::float8 as materials from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' ${activeCategoryOnly} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(total), 0)::float8 as labor from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} group by 1`,
    sql`select coalesce(description, 'Khác') as category, coalesce(sum(amount), 0)::float8 as operations from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} group by 1`,
    sql`
      select *, count(*) over()::int as __total
      from gp_attendance
      where ${laborWhere}
      ${pagedRowsOrderBy(sql, "attendance", laborState.sorting)}
      limit ${laborState.pageSize}
      offset ${laborOffset}
    `,
    sql`
      select *, count(*) over()::int as __total
      from gp_materials
      where ${materialWhere}
      ${pagedRowsOrderBy(sql, "materials", materialState.sorting)}
      limit ${materialState.pageSize}
      offset ${materialOffset}
    `,
    sql`
      select *, count(*) over()::int as __total
      from gp_operations
      where ${operationWhere}
      ${pagedRowsOrderBy(sql, "operations", operationState.sorting)}
      limit ${operationState.pageSize}
      offset ${operationOffset}
    `,
    sql`
      select
        ARRAY(select distinct week from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and week <> '' ${activeCategoryOnly} order by week desc limit 300) as week,
        ARRAY(select distinct category from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and category <> '' ${activeCategoryOnly} order by category asc limit 300) as category,
        ARRAY(select distinct staff_name from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and staff_name <> '' ${activeCategoryOnly} order by staff_name asc limit 300) as staff_name,
        ARRAY(select distinct position from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and position <> '' ${activeCategoryOnly} order by position asc limit 300) as position
    `,
    sql`
      select
        ARRAY(select distinct week from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' and week <> '' ${activeCategoryOnly} order by week desc limit 300) as week,
        ARRAY(select distinct category from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' and category <> '' ${activeCategoryOnly} order by category asc limit 300) as category,
        ARRAY(select distinct supplier from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type = 'VT Chính' and supplier <> '' ${activeCategoryOnly} order by supplier asc limit 300) as supplier
    `,
    sql`
      select ARRAY(select distinct week from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} and week <> '' order by week desc limit 300) as week
    `,
  ]);

  const monthlyMap = new Map(monthlyKeys.map((month) => [month, emptyMonthlyPoint(month)]));
  const addMonthly = (rows: unknown, key: "materials" | "labor" | "operations" | "cashIn") => {
    for (const row of rows as Row[]) {
      const entry = monthlyMap.get(text(row.month));
      if (entry) entry[key] += number(row.value);
    }
  };
  addMonthly(monthlyMaterialRows, "materials");
  addMonthly(monthlyLaborRows, "labor");
  addMonthly(monthlyOperationRows, "operations");
  addMonthly(monthlyPaymentRows, "cashIn");

  const weeklyMap = new Map<
    string,
    { week: string; materials: number; labor: number; subcontractors: number; operations: number; total: number }
  >();
  const ensureWeek = (week: unknown) => {
    const key = normalizeWeek(week);
    const current = weeklyMap.get(key) ?? {
      week: key,
      materials: 0,
      labor: 0,
      subcontractors: 0,
      operations: 0,
      total: 0,
    };
    weeklyMap.set(key, current);
    return current;
  };
  for (const row of weeklyMaterialRows as Row[]) ensureWeek(row.week).materials += number(row.materials);
  for (const row of weeklyLaborRows as Row[]) ensureWeek(row.week).labor += number(row.labor);
  for (const row of weeklyOperationRows as Row[]) ensureWeek(row.week).operations += number(row.operations);
  const weekly = [...weeklyMap.values()]
    .map((row) => ({ ...row, total: row.materials + row.labor + row.operations }))
    .sort((a, b) => compareWeekDesc(a.week, b.week))
    .slice(0, 8)
    .reverse();

  const categoryMap = new Map<
    string,
    { category: string; total: number; materials: number; labor: number; subcontractors: number; operations: number }
  >();
  const ensureCategory = (category: string) => {
    const key = category || "Khác";
    const current = categoryMap.get(key) ?? {
      category: key,
      total: 0,
      materials: 0,
      labor: 0,
      subcontractors: 0,
      operations: 0,
    };
    categoryMap.set(key, current);
    return current;
  };
  for (const row of categoryMaterialRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.materials += number(row.materials);
    entry.total += number(row.materials);
  }
  for (const row of categoryLaborRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.labor += number(row.labor);
    entry.total += number(row.labor);
  }
  for (const row of categoryOperationRows as Row[]) {
    const entry = ensureCategory(text(row.category));
    entry.operations += number(row.operations);
    entry.total += number(row.operations);
  }

  const materialMainCost = (materialTypeRows as Row[])
    .filter((row) => text(row.material_type) === "VT Chính")
    .reduce((sum, row) => sum + number(row.value), 0);
  const laborCost = number((laborTotalRows as Row[])[0]?.value);
  const operationCost = number((operationTotalRows as Row[])[0]?.value);
  const totalCost = materialMainCost + laborCost + operationCost;
  const contractValue = number((contractRows as Row[])[0]?.total);
  const collectedCash = number((paymentRows as Row[])[0]?.total);
  const reportCostRows = [
    { key: "materials", label: "VT Chính", value: materialMainCost, rows: 0 },
    { key: "labor", label: "Nhân công", value: laborCost, rows: number((laborTotalRows as Row[])[0]?.rows) },
    {
      key: "operations",
      label: "Vận hành",
      value: operationCost,
      rows: number((operationTotalRows as Row[])[0]?.rows),
    },
  ];
  const breakdown = reportCostRows.map((row) => ({
    ...row,
    share: totalCost ? (row.value / totalCost) * 100 : 0,
  }));
  const [laborOptions = {}] = laborOptionRows as Row[];
  const [materialOptions = {}] = materialOptionRows as Row[];
  const [operationOptions = {}] = operationOptionRows as Row[];

  return {
    activeProjectCode,
    insights: {
      breakdown,
      monthly: monthlyKeys.map((month) => monthlyMap.get(month) ?? emptyMonthlyPoint(month)),
      weekly,
      categorySpend: [...categoryMap.values()].sort((a, b) => b.total - a.total).slice(0, 8),
      headline: {
        totalCost,
        contractValue,
        collectedCash,
        unpaidMaterials: number((unpaidRows as Row[])[0]?.total),
        materialMainCost,
        laborCost,
        operationCost,
        contractCoverage: contractValue ? (collectedCash / contractValue) * 100 : 0,
        costCoverage: totalCost ? (collectedCash / totalCost) * 100 : 0,
      },
    },
    tables: {
      labor: reportPagedResult(laborRows as Row[], laborState, attendanceFromRow, {
        week: optionsFromValues(laborOptions.week),
        category: optionsFromValues(laborOptions.category),
        staffName: optionsFromValues(laborOptions.staff_name),
        position: optionsFromValues(laborOptions.position),
      }),
      materials: reportPagedResult(materialRows as Row[], materialState, materialFromRow, {
        week: optionsFromValues(materialOptions.week),
        category: optionsFromValues(materialOptions.category),
        supplier: optionsFromValues(materialOptions.supplier),
      }),
      operations: reportPagedResult(operationRows as Row[], operationState, operationFromRow, {
        week: optionsFromValues(operationOptions.week),
      }),
    },
  };
}

export async function getGiaPhuPagedRows(options: GiaPhuPagedRowsOptions): Promise<GiaPhuPagedRowsResult> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode, organizationId);
  const pageSize = normalizePageSize(options.pageSize);
  const pageIndex = normalizePageIndex(options.pageIndex);
  const offset = pageIndex * pageSize;
  const search = text(options.search).trim();
  const pattern = `%${search}%`;
  const filterValue = (key: string) => text(options.filters?.[key]).trim();
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId, activeProjectCode);

  if (options.dataset === "projects") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', code, name, owner, contact, referrer, status, failure_reason)) like lower(${pattern})`
      : sql``;
    const statusFilter = filterValue("status");
    const ownerFilter = filterValue("owner");
    const whereFilters = sql`
      ${statusFilter ? sql`and status = ${statusFilter}` : sql``}
      ${ownerFilter ? sql`and owner = ${ownerFilter}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_projects where organization_id = ${organizationId} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_projects
        where organization_id = ${organizationId} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "projects", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "projects",
      rows: (rows as Row[]).map(projectFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "catalogs") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', kind, code, name, unit, supplier, contact, note)) like lower(${pattern})`
      : sql``;
    const kindFilter = filterValue("kind");
    const catalogProjectScope =
      kindFilter === "hangMuc"
        ? sql`and project_code = ${activeProjectCode}`
        : sql`and (kind <> 'hangMuc' or project_code = ${activeProjectCode})`;
    const unitFilter = filterValue("unit");
    const supplierFilter = filterValue("supplier");
    const contactFilter = filterValue("contact");
    const archivedFilter = filterValue("archived");
    const whereFilters = sql`
      ${kindFilter ? sql`and kind = ${kindFilter}` : sql``}
      ${unitFilter ? sql`and unit = ${unitFilter}` : sql``}
      ${supplierFilter ? sql`and supplier = ${supplierFilter}` : sql``}
      ${contactFilter ? sql`and contact = ${contactFilter}` : sql``}
      ${archivedFilter === "true" ? sql`and archived = true` : archivedFilter === "false" ? sql`and archived = false` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_catalog_items where organization_id = ${organizationId} ${catalogProjectScope} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_catalog_items
        where organization_id = ${organizationId} ${catalogProjectScope} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "catalogs", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "catalogs",
      rows: (rows as Row[]).map(catalogFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "staff") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', id, name, team, position)) like lower(${pattern})`
      : sql``;
    const teamFilter = filterValue("team");
    const positionFilter = filterValue("position");
    const resignedFilter = filterValue("resigned");
    const whereFilters = sql`
      ${teamFilter ? sql`and team = ${teamFilter}` : sql``}
      ${positionFilter ? sql`and position = ${positionFilter}` : sql``}
      ${resignedFilter ? sql`and resigned = ${resignedFilter === "Đã nghỉ việc"}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_staff where organization_id = ${organizationId} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_staff
        where organization_id = ${organizationId} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "staff", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "staff",
      rows: (rows as Row[]).map(staffFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (!activeProjectCode) {
    return { dataset: options.dataset, rows: [], total: 0, pageIndex, pageSize } as GiaPhuPagedRowsResult;
  }

  if (options.dataset === "contracts") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', contract.contract_no, contract.note, document.file_name)) like lower(${pattern})`
      : sql``;
    const [countRows, rows] = await Promise.all([
      sql`
        select count(*)::int as total
        from gp_contracts contract
        left join gp_documents document
          on document.organization_id = contract.organization_id
         and document.id::text = contract.file_id
        where contract.organization_id = ${organizationId} and contract.project_code = ${activeProjectCode} ${whereSearch}
      `,
      sql`
        select
          contract.*,
          coalesce(document.file_name, '') as attachment_file_name,
          coalesce(document.mime_type, '') as attachment_mime_type,
          coalesce(document.file_size, 0) as attachment_file_size,
          coalesce(document.file_data <> '', false) as attachment_has_file
        from gp_contracts contract
        left join gp_documents document
          on document.organization_id = contract.organization_id
         and document.id::text = contract.file_id
        where contract.organization_id = ${organizationId} and contract.project_code = ${activeProjectCode} ${whereSearch}
        ${pagedRowsOrderBy(sql, "contracts", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "contracts",
      rows: (rows as Row[]).map(contractFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "payments") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', payment.note, document.file_name)) like lower(${pattern})`
      : sql``;
    const [countRows, rows] = await Promise.all([
      sql`
        select count(*)::int as total
        from gp_payments payment
        left join gp_documents document
          on document.organization_id = payment.organization_id
         and document.id::text = payment.file_id
        where payment.organization_id = ${organizationId} and payment.project_code = ${activeProjectCode} ${whereSearch}
      `,
      sql`
        select
          payment.*,
          coalesce(document.file_name, '') as attachment_file_name,
          coalesce(document.mime_type, '') as attachment_mime_type,
          coalesce(document.file_size, 0) as attachment_file_size,
          coalesce(document.file_data <> '', false) as attachment_has_file
        from gp_payments payment
        left join gp_documents document
          on document.organization_id = payment.organization_id
         and document.id::text = payment.file_id
        where payment.organization_id = ${organizationId} and payment.project_code = ${activeProjectCode} ${whereSearch}
        ${pagedRowsOrderBy(sql, "payments", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "payments",
      rows: (rows as Row[]).map(paymentFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "documents") {
    await ensureDocumentFileColumns();
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', doc_type, file_name, note, preview_text)) like lower(${pattern})`
      : sql``;
    const typeFilter = filterValue("doc_type");
    const hasFileFilter = filterValue("has_file");
    const whereFilters = sql`
      ${typeFilter ? sql`and doc_type = ${typeFilter}` : sql``}
      ${hasFileFilter ? sql`and (file_data <> '') = ${hasFileFilter === "Đã tải"}` : sql``}
    `;
    const visibleDocumentsOnly = sql`
      and doc_type not in (
        ${STAFF_DOCUMENT_DOC_TYPES[0]},
        ${STAFF_DOCUMENT_DOC_TYPES[1]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[0]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[1]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[2]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[3]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[4]}
      )
    `;
    const selectDocumentFields = sql`
      id,
      project_code,
      doc_type,
      file_name,
      mime_type,
      file_size,
      note,
      preview_text,
      file_data <> '' as has_file
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_documents where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${visibleDocumentsOnly} ${whereSearch} ${whereFilters}`,
      sql`
        select ${selectDocumentFields}
        from gp_documents
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${visibleDocumentsOnly} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "documents", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "documents",
      rows: (rows as Row[]).map(documentFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "materials") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', week, shift, category, material_code, material_name, unit, debt, status, payment_status, payment_info, material_type, supplier)) like lower(${pattern})`
      : sql``;
    const weekFilter = filterValue("week");
    const materialTypeFilter = filterValue("materialType");
    const paymentStatusFilter = filterValue("paymentStatus");
    const categoryFilter = filterValue("category");
    const supplierFilter = filterValue("supplier");
    const debtOpenFilter = filterValue("debtOpen");
    const whereFilters = sql`
      ${weekFilter ? sql`and week = ${weekFilter}` : sql``}
      ${materialTypeFilter ? sql`and material_type = ${materialTypeFilter}` : sql``}
      ${paymentStatusFilter ? sql`and payment_status = ${paymentStatusFilter}` : sql``}
      ${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}
      ${supplierFilter ? sql`and supplier = ${supplierFilter}` : sql``}
      ${debtOpenFilter ? sql`and (payment_status <> 'Đã TT' or debt = 'Có')` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_materials
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "materials", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "materials",
      rows: (rows as Row[]).map(materialFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "attendance") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', week, shift, category, staff_name, position, status)) like lower(${pattern})`
      : sql``;
    const weekFilter = filterValue("week");
    const categoryFilter = filterValue("category");
    const staffNameFilter = filterValue("staffName");
    const positionFilter = filterValue("position");
    const shiftFilter = filterValue("shift");
    const whereFilters = sql`
      ${weekFilter ? sql`and week = ${weekFilter}` : sql``}
      ${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}
      ${staffNameFilter ? sql`and staff_name = ${staffNameFilter}` : sql``}
      ${positionFilter ? sql`and position = ${positionFilter}` : sql``}
      ${shiftFilter ? sql`and shift = ${shiftFilter}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_attendance
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "attendance", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "attendance",
      rows: (rows as Row[]).map(attendanceFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "laborNorms") {
    const whereSearch = search ? sql`and lower(concat_ws(' ', category)) like lower(${pattern})` : sql``;
    const categoryFilter = filterValue("category");
    const whereFilters = sql`${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}`;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_labor_norms where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_labor_norms
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "laborNorms", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "laborNorms",
      rows: (rows as Row[]).map(laborNormFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "progress") {
    const whereSearch = search ? sql`and lower(concat_ws(' ', category, evaluation)) like lower(${pattern})` : sql``;
    const categoryFilter = filterValue("category");
    const whereFilters = sql`${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}`;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_progress where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_progress
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "progress", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "progress",
      rows: (rows as Row[]).map(progressFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "subcontractors") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', week, category, contractor_name, note, status)) like lower(${pattern})`
      : sql``;
    const weekFilter = filterValue("week");
    const categoryFilter = filterValue("category");
    const contractorNameFilter = filterValue("contractorName");
    const whereFilters = sql`
      ${weekFilter ? sql`and week = ${weekFilter}` : sql``}
      ${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}
      ${contractorNameFilter ? sql`and contractor_name = ${contractorNameFilter}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}`,
      sql`
        select
          id,
          work_date,
          week,
          organization_id,
          project_code,
          category,
          contractor_name,
          note,
          advance,
          cumulative,
          status,
          created_at,
          updated_at,
          case when exists (
            select 1
            from gp_documents document
            where document.organization_id = gp_subcontractors.organization_id
              and document.id::text = gp_subcontractors.file_id
              and document.file_data <> ''
          ) then file_url else '' end as file_url,
          case when exists (
            select 1
            from gp_documents document
            where document.organization_id = gp_subcontractors.organization_id
              and document.id::text = gp_subcontractors.file_id
              and document.file_data <> ''
          ) then file_id else '' end as file_id
          ,
          coalesce((
            select document.file_name
            from gp_documents document
            where document.organization_id = gp_subcontractors.organization_id
              and document.id::text = gp_subcontractors.file_id
            limit 1
          ), '') as attachment_file_name,
          coalesce((
            select document.mime_type
            from gp_documents document
            where document.organization_id = gp_subcontractors.organization_id
              and document.id::text = gp_subcontractors.file_id
            limit 1
          ), '') as attachment_mime_type,
          coalesce((
            select document.file_size
            from gp_documents document
            where document.organization_id = gp_subcontractors.organization_id
              and document.id::text = gp_subcontractors.file_id
            limit 1
          ), 0) as attachment_file_size,
          coalesce((
            select document.file_data <> ''
            from gp_documents document
            where document.organization_id = gp_subcontractors.organization_id
              and document.id::text = gp_subcontractors.file_id
            limit 1
          ), false) as attachment_has_file
        from gp_subcontractors
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${activeCategoryOnly} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "subcontractors", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "subcontractors",
      rows: (rows as Row[]).map(subcontractorFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  if (options.dataset === "subcontractorContracts") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', contractor_name, note, status)) like lower(${pattern})`
      : sql``;
    const statusFilter = filterValue("status");
    const whereFilters = sql`${statusFilter ? sql`and status = ${statusFilter}` : sql``}`;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_subcontractor_contracts where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select
          id,
          organization_id,
          project_code,
          contractor_name,
          approved_cost,
          note,
          status,
          approved_by,
          approved_at,
          created_at,
          updated_at,
          case when exists (
            select 1
            from gp_documents document
            where document.organization_id = gp_subcontractor_contracts.organization_id
              and document.id::text = gp_subcontractor_contracts.file_id
              and document.file_data <> ''
          ) then file_url else '' end as file_url,
          case when exists (
            select 1
            from gp_documents document
            where document.organization_id = gp_subcontractor_contracts.organization_id
              and document.id::text = gp_subcontractor_contracts.file_id
              and document.file_data <> ''
          ) then file_id else '' end as file_id
        from gp_subcontractor_contracts
        where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        ${pagedRowsOrderBy(sql, "subcontractorContracts", options.sorting)}
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "subcontractorContracts",
      rows: (rows as Row[]).map(subcontractorContractFromRow),
      total: totalFromCountRows(countRows),
      pageIndex,
      pageSize,
    };
  }

  const whereSearch = search ? sql`and lower(concat_ws(' ', week, description)) like lower(${pattern})` : sql``;
  const weekFilter = filterValue("week");
  const whereFilters = sql`${weekFilter ? sql`and week = ${weekFilter}` : sql``}`;
  const [countRows, rows] = await Promise.all([
    sql`select count(*)::int as total from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
    sql`
      select
        id,
        work_date,
        week,
        organization_id,
        project_code,
        description,
        amount,
        created_at,
        case when exists (
          select 1
          from gp_documents document
          where document.organization_id = gp_operations.organization_id
            and document.id::text = gp_operations.file_id
            and document.file_data <> ''
        ) then file_url else '' end as file_url,
        case when exists (
          select 1
          from gp_documents document
          where document.organization_id = gp_operations.organization_id
            and document.id::text = gp_operations.file_id
            and document.file_data <> ''
        ) then file_id else '' end as file_id
        ,
        coalesce((
          select document.file_name
          from gp_documents document
          where document.organization_id = gp_operations.organization_id
            and document.id::text = gp_operations.file_id
          limit 1
        ), '') as attachment_file_name,
        coalesce((
          select document.mime_type
          from gp_documents document
          where document.organization_id = gp_operations.organization_id
            and document.id::text = gp_operations.file_id
          limit 1
        ), '') as attachment_mime_type,
        coalesce((
          select document.file_size
          from gp_documents document
          where document.organization_id = gp_operations.organization_id
            and document.id::text = gp_operations.file_id
          limit 1
        ), 0) as attachment_file_size,
        coalesce((
          select document.file_data <> ''
          from gp_documents document
          where document.organization_id = gp_operations.organization_id
            and document.id::text = gp_operations.file_id
          limit 1
        ), false) as attachment_has_file
      from gp_operations
      where organization_id = ${organizationId} and project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
      ${pagedRowsOrderBy(sql, "operations", options.sorting)}
      limit ${pageSize}
      offset ${offset}
    `,
  ]);

  return {
    dataset: "operations",
    rows: (rows as Row[]).map(operationFromRow),
    total: totalFromCountRows(countRows),
    pageIndex,
    pageSize,
  };
}

export async function getGiaPhuFilterOptions(options: {
  dataset: GiaPhuPagedDataset;
  organizationId?: string;
  activeProjectCode?: string;
  filters?: Record<string, string>;
}): Promise<GiaPhuFilterOptionsResult> {
  const sql = getSql();
  const organizationId = organizationIdFrom(options.organizationId);
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode, organizationId);
  const fixedFilterValue = (key: string) => text(options.filters?.[key]).trim();

  if (options.dataset === "projects") {
    const [statusRows, ownerRows] = await Promise.all([
      sql`select distinct status as value from gp_projects where organization_id = ${organizationId} and status <> '' order by status asc limit 300`,
      sql`select distinct owner as value from gp_projects where organization_id = ${organizationId} and owner <> '' order by owner asc limit 300`,
    ]);

    return {
      status: distinctOptions(statusRows),
      owner: distinctOptions(ownerRows),
    };
  }

  if (options.dataset === "catalogs") {
    const kindFilter = fixedFilterValue("kind");
    const whereKind = kindFilter ? sql`and kind = ${kindFilter}` : sql``;
    const catalogProjectScope =
      kindFilter === "hangMuc"
        ? sql`and project_code = ${activeProjectCode}`
        : sql`and (kind <> 'hangMuc' or project_code = ${activeProjectCode})`;
    const [kindRows, unitRows, supplierRows, contactRows, archivedRows] = await Promise.all([
      sql`select distinct kind as value from gp_catalog_items where organization_id = ${organizationId} and kind <> '' order by kind asc limit 300`,
      sql`select distinct unit as value from gp_catalog_items where organization_id = ${organizationId} and unit <> '' ${catalogProjectScope} ${whereKind} order by unit asc limit 300`,
      sql`select distinct supplier as value from gp_catalog_items where organization_id = ${organizationId} and supplier <> '' ${catalogProjectScope} ${whereKind} order by supplier asc limit 300`,
      sql`select distinct contact as value from gp_catalog_items where organization_id = ${organizationId} and contact <> '' ${catalogProjectScope} ${whereKind} order by contact asc limit 300`,
      sql`
        select distinct archived::text as value
        from gp_catalog_items
        where organization_id = ${organizationId} ${catalogProjectScope} ${whereKind}
        order by value asc
        limit 2
      `,
    ]);

    return {
      kind: distinctOptions(kindRows),
      unit: distinctOptions(unitRows),
      supplier: distinctOptions(supplierRows),
      contact: distinctOptions(contactRows),
      archived: distinctOptions(archivedRows).map((option) => ({
        label: option.value === "true" ? "Đã lưu trữ" : "Đang dùng",
        value: option.value,
      })),
    };
  }

  if (options.dataset === "staff") {
    const [teamRows, positionRows] = await Promise.all([
      sql`select distinct team as value from gp_staff where organization_id = ${organizationId} and team <> '' order by team asc limit 300`,
      sql`select distinct position as value from gp_staff where organization_id = ${organizationId} and position <> '' order by position asc limit 300`,
    ]);

    return {
      team: distinctOptions(teamRows),
      position: distinctOptions(positionRows),
      resigned: [
        { label: "Đang làm", value: "Đang làm" },
        { label: "Đã nghỉ việc", value: "Đã nghỉ việc" },
      ],
    };
  }

  if (!activeProjectCode) return {};
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId, activeProjectCode);

  if (options.dataset === "documents") {
    await ensureDocumentFileColumns();
    const [typeRows] = await Promise.all([
      sql`
        select distinct doc_type as value
        from gp_documents
        where organization_id = ${organizationId}
          and project_code = ${activeProjectCode}
          and doc_type <> ''
          and doc_type not in (
            ${STAFF_DOCUMENT_DOC_TYPES[0]},
            ${STAFF_DOCUMENT_DOC_TYPES[1]},
            ${ATTACHMENT_DOCUMENT_DOC_TYPES[0]},
            ${ATTACHMENT_DOCUMENT_DOC_TYPES[1]},
            ${ATTACHMENT_DOCUMENT_DOC_TYPES[2]},
            ${ATTACHMENT_DOCUMENT_DOC_TYPES[3]},
            ${ATTACHMENT_DOCUMENT_DOC_TYPES[4]}
          )
        order by doc_type asc
        limit 300
      `,
    ]);

    return {
      doc_type: distinctOptions(typeRows),
      has_file: [
        { label: "Đã tải", value: "Đã tải" },
        { label: "Thiếu tệp", value: "Thiếu tệp" },
      ],
    };
  }

  if (options.dataset === "materials") {
    const whereDebtOpen = fixedFilterValue("debtOpen") ? sql`and (payment_status <> 'Đã TT' or debt = 'Có')` : sql``;
    const [weekRows, materialTypeRows, paymentStatusRows, categoryRows, supplierRows] = await Promise.all([
      sql`select distinct week as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and week <> '' ${whereDebtOpen} ${activeCategoryOnly} order by week desc limit 300`,
      sql`select distinct material_type as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and material_type <> '' ${whereDebtOpen} ${activeCategoryOnly} order by material_type asc limit 300`,
      sql`select distinct payment_status as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and payment_status <> '' ${whereDebtOpen} ${activeCategoryOnly} order by payment_status asc limit 300`,
      sql`select distinct category as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and category <> '' ${whereDebtOpen} ${activeCategoryOnly} order by category asc limit 300`,
      sql`select distinct supplier as value from gp_materials where organization_id = ${organizationId} and project_code = ${activeProjectCode} and supplier <> '' ${whereDebtOpen} ${activeCategoryOnly} order by supplier asc limit 300`,
    ]);

    return {
      week: distinctOptions(weekRows),
      materialType: distinctOptions(materialTypeRows),
      paymentStatus: distinctOptions(paymentStatusRows),
      category: distinctOptions(categoryRows),
      supplier: distinctOptions(supplierRows),
    };
  }

  if (options.dataset === "attendance") {
    const weekFilter = fixedFilterValue("week");
    const categoryFilter = fixedFilterValue("category");
    const whereWeek = weekFilter ? sql`and week = ${weekFilter}` : sql``;
    const whereCategory = categoryFilter ? sql`and category = ${categoryFilter}` : sql``;
    const [weekRows, categoryRows, staffRows, positionRows, shiftRows] = await Promise.all([
      sql`select distinct week as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and week <> '' ${whereCategory} order by week desc limit 300`,
      sql`select distinct category as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and category <> '' ${whereWeek} order by category asc limit 300`,
      sql`select distinct staff_name as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and staff_name <> '' ${whereWeek} ${whereCategory} order by staff_name asc limit 300`,
      sql`select distinct position as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and position <> '' ${whereWeek} ${whereCategory} order by position asc limit 300`,
      sql`select distinct shift as value from gp_attendance where organization_id = ${organizationId} and project_code = ${activeProjectCode} and shift <> '' ${whereWeek} ${whereCategory} order by shift asc limit 300`,
    ]);

    return {
      week: distinctOptions(weekRows),
      category: distinctOptions(categoryRows),
      staffName: distinctOptions(staffRows),
      position: distinctOptions(positionRows),
      shift: distinctOptions(shiftRows),
    };
  }

  if (options.dataset === "laborNorms") {
    const rows =
      await sql`select distinct category as value from gp_labor_norms where organization_id = ${organizationId} and project_code = ${activeProjectCode} and category <> '' ${activeCategoryOnly} order by category asc limit 300`;
    return { category: distinctOptions(rows) };
  }

  if (options.dataset === "progress") {
    const rows =
      await sql`select distinct category as value from gp_progress where organization_id = ${organizationId} and project_code = ${activeProjectCode} and category <> '' ${activeCategoryOnly} order by category asc limit 300`;
    return { category: distinctOptions(rows) };
  }

  if (options.dataset === "subcontractors") {
    const [weekRows, categoryRows, contractorRows] = await Promise.all([
      sql`select distinct week as value from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} and week <> '' ${activeCategoryOnly} order by week desc limit 300`,
      sql`select distinct category as value from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} and category <> '' ${activeCategoryOnly} order by category asc limit 300`,
      sql`select distinct contractor_name as value from gp_subcontractors where organization_id = ${organizationId} and project_code = ${activeProjectCode} and contractor_name <> '' ${activeCategoryOnly} order by contractor_name asc limit 300`,
    ]);

    return {
      week: distinctOptions(weekRows),
      category: distinctOptions(categoryRows),
      contractorName: distinctOptions(contractorRows),
    };
  }

  if (options.dataset === "subcontractorContracts") {
    const rows =
      await sql`select distinct status as value from gp_subcontractor_contracts where organization_id = ${organizationId} and project_code = ${activeProjectCode} and status <> '' order by status asc limit 300`;
    return { status: distinctOptions(rows) };
  }

  if (options.dataset === "operations") {
    const rows =
      await sql`select distinct week as value from gp_operations where organization_id = ${organizationId} and project_code = ${activeProjectCode} and week <> '' order by week desc limit 300`;
    return { week: distinctOptions(rows) };
  }

  return {};
}

export async function saveProject(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const code = text(payload.code).trim();
  const name = text(payload.name).trim();
  if (!code || !name) throw new Error("Thiếu mã hoặc tên công trình.");
  const pinHash = await hashProjectPin(payload.pin ?? payload.projectPin);
  const originalCode = text(payload.originalCode).trim();

  if (originalCode) {
    if (originalCode.toLowerCase() !== code.toLowerCase()) {
      throw new Error("Không thể đổi mã công trình sau khi đã tạo. Vui lòng tạo công trình mới nếu cần mã khác.");
    }

    const updatedRows = (await sql`
      update gp_projects
      set name = ${name},
          owner = ${text(payload.owner)},
          contact = ${text(payload.contact)},
          referrer = ${text(payload.referrer)},
          start_date = ${dateOnly(payload.startDate) || null},
          status = ${text(payload.status) || "Đang thi công"},
          failure_reason = ${text(payload.failureReason)},
          pin_hash = case when ${pinHash} <> '' then ${pinHash} else pin_hash end,
          updated_at = now()
      where organization_id = ${organizationId} and lower(code) = lower(${originalCode})
      returning code
    `) as Row[];

    if (!updatedRows.length) {
      throw new Error("Không tìm thấy công trình cần sửa trong workspace hiện tại.");
    }

    return;
  }

  const existingRows =
    (await sql`select code, organization_id from gp_projects where lower(code) = lower(${code}) limit 1`) as Row[];
  const existingOrgId = text(existingRows[0]?.organization_id);
  if (existingRows.length) {
    if (existingOrgId === organizationId) {
      throw new Error(`Mã công trình "${code}" đã tồn tại trong workspace này. Vui lòng dùng mã khác.`);
    }

    throw new Error(`Mã công trình "${code}" đã tồn tại ở workspace khác hoặc dữ liệu cũ. Vui lòng dùng mã khác.`);
  }

  await sql`
    insert into gp_projects (code, organization_id, name, owner, contact, referrer, start_date, status, failure_reason, pin_hash, updated_at)
    values (${code}, ${organizationId}, ${name}, ${text(payload.owner)}, ${text(payload.contact)}, ${text(payload.referrer)}, ${dateOnly(payload.startDate) || null}, ${text(payload.status) || "Đang thi công"}, ${text(payload.failureReason)}, ${pinHash}, now())
  `;
}

export async function verifyProjectPin(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const projectId = text(payload.projectId || payload.id || payload.code).trim();
  if (!projectId) throw new Error("Thiếu công trình để xác thực PIN.");

  const rows = (await sql`
    select *
    from gp_projects
    where organization_id = ${organizationId}
      and (id::text = ${projectId} or code = ${projectId} or name = ${projectId})
    limit 1
  `) as Row[];
  const project = rows[0];
  if (!project) throw new Error("Không tìm thấy công trình.");

  const isValid = await verifyProjectPinHash(payload.pin, project.pin_hash);
  if (!isValid) throw new Error("Mã PIN công trình không đúng.");

  return projectFromRow(project);
}

export async function deleteProject(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const code = text(payload.code).trim();
  if (!code) throw new Error("Thiếu mã công trình để xóa.");
  await sql`delete from gp_projects where organization_id = ${organizationId} and code = ${code}`;
}

export async function saveContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const projectCode = text(payload.projectCode).trim();
  const contractNo = text(payload.contractNo).trim();
  const value = requireNonNegativeNumericInput(payload.value, "Giá trị");
  const id = number(payload.id);
  const fileId = text(payload.fileId).trim();
  const fileUrl = text(payload.fileUrl).trim() || (number(fileId) ? documentFileUrl(number(fileId)) : "");

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!contractNo) throw new Error("Thiếu số hợp đồng.");

  const duplicatedContracts =
    id > 0
      ? ((await sql`
          select id
          from gp_contracts
          where organization_id = ${organizationId}
            and project_code = ${projectCode}
            and lower(trim(contract_no)) = lower(${contractNo})
            and id <> ${id}
          limit 1
        `) as Row[])
      : ((await sql`
          select id
          from gp_contracts
          where organization_id = ${organizationId}
            and project_code = ${projectCode}
            and lower(trim(contract_no)) = lower(${contractNo})
          limit 1
        `) as Row[]);

  if (duplicatedContracts.length > 0) {
    throw new Error(`Số hợp đồng "${contractNo}" đã tồn tại. Vui lòng nhập số khác.`);
  }

  if (id > 0) {
    const [previousRow] =
      (await sql`select file_id from gp_contracts where organization_id = ${organizationId} and id = ${id}`) as Row[];
    await sql`
      update gp_contracts
      set project_code = ${projectCode},
          contract_no = ${contractNo},
          value = ${value},
          signed_date = ${dateOnly(payload.signedDate) || null},
          note = ${text(payload.note)},
          file_url = ${fileUrl},
          file_id = ${fileId}
      where organization_id = ${organizationId} and id = ${id}
    `;
    await deleteAttachmentDocumentIfUnused(number(previousRow?.file_id), organizationId);
    return;
  }

  await sql`
    insert into gp_contracts (organization_id, project_code, contract_no, value, signed_date, note, file_url, file_id)
    values (${organizationId}, ${projectCode}, ${contractNo}, ${value}, ${dateOnly(payload.signedDate) || null}, ${text(payload.note)}, ${fileUrl}, ${fileId})
  `;
}

export async function deleteContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const [row] =
    (await sql`select file_id from gp_contracts where organization_id = ${organizationId} and id = ${id}`) as Row[];
  await sql`delete from gp_contracts where organization_id = ${organizationId} and id = ${number(payload.id)}`;
  await deleteAttachmentDocumentIfUnused(number(row?.file_id), organizationId);
}

export async function savePayment(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const amount = requireNonNegativeNumericInput(payload.amount, "Số tiền");
  const fileId = text(payload.fileId).trim();
  const fileUrl = text(payload.fileUrl).trim() || (number(fileId) ? documentFileUrl(number(fileId)) : "");
  if (!projectCode) throw new Error("Thiếu công trình.");

  if (id > 0) {
    const [previousRow] =
      (await sql`select file_id from gp_payments where organization_id = ${organizationId} and id = ${id}`) as Row[];
    await sql`
      update gp_payments
      set project_code = ${projectCode},
          payment_date = ${dateOnly(payload.date) || null},
          amount = ${amount},
          note = ${text(payload.note)},
          file_url = ${fileUrl},
          file_id = ${fileId}
      where organization_id = ${organizationId} and id = ${id}
    `;
    await deleteAttachmentDocumentIfUnused(number(previousRow?.file_id), organizationId);
    return;
  }

  await sql`
    insert into gp_payments (organization_id, project_code, payment_date, amount, note, file_url, file_id)
    values (${organizationId}, ${projectCode}, ${dateOnly(payload.date) || null}, ${amount}, ${text(payload.note)}, ${fileUrl}, ${fileId})
  `;
}

export async function deletePayment(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const [row] =
    (await sql`select file_id from gp_payments where organization_id = ${organizationId} and id = ${id}`) as Row[];
  await sql`delete from gp_payments where organization_id = ${organizationId} and id = ${id}`;
  await deleteAttachmentDocumentIfUnused(number(row?.file_id), organizationId);
}

async function getNextCatalogCode(kind: CatalogItem["kind"], organizationId: string, projectCode = "") {
  const sql = getSql();
  const rows =
    kind === "hangMuc"
      ? ((await sql`
          select code
          from gp_catalog_items
          where organization_id = ${organizationId} and kind = ${kind} and project_code = ${projectCode}
        `) as Row[])
      : ((await sql`
          select code
          from gp_catalog_items
          where organization_id = ${organizationId} and kind = ${kind}
        `) as Row[]);

  return buildNextCatalogCode(
    kind,
    rows.map((row) => text(row.code)),
  );
}

async function assertUniqueCatalogItem({
  kind,
  code,
  name,
  supplier,
  originalId,
  organizationId,
  projectCode,
}: {
  kind: CatalogItem["kind"];
  code: string;
  name: string;
  supplier: string;
  originalId: string;
  organizationId: string;
  projectCode?: string;
}) {
  const sql = getSql();
  const isMaterialCatalog = kind === "vatTu" || kind === "vatTuPhu";
  const normalizedProjectCode = text(projectCode).trim();
  const duplicateRows = isMaterialCatalog
    ? ((await sql`
        select id, code, name, supplier
        from gp_catalog_items
        where organization_id = ${organizationId}
          and kind = ${kind}
          and archived = false
          and id <> ${originalId}
          and (
            (lower(code) = lower(${code}) and lower(btrim(supplier)) = lower(btrim(${supplier})))
            or (lower(btrim(name)) = lower(btrim(${name})) and lower(btrim(supplier)) = lower(btrim(${supplier})))
          )
        limit 1
      `) as Row[])
    : kind === "hangMuc"
      ? ((await sql`
          select id, code, name, supplier
          from gp_catalog_items
          where organization_id = ${organizationId}
            and kind = ${kind}
            and project_code = ${normalizedProjectCode}
            and archived = false
            and id <> ${originalId}
            and (lower(code) = lower(${code}) or lower(btrim(name)) = lower(btrim(${name})))
          limit 1
        `) as Row[])
      : ((await sql`
        select id, code, name, supplier
        from gp_catalog_items
        where organization_id = ${organizationId}
          and kind = ${kind}
          and archived = false
          and id <> ${originalId}
          and (lower(code) = lower(${code}) or lower(btrim(name)) = lower(btrim(${name})))
        limit 1
      `) as Row[]);
  const duplicate = duplicateRows[0];

  if (!duplicate) return;

  const labels = catalogFieldLabels[kind];
  const duplicateSupplier = text(duplicate.supplier).trim();

  if (isMaterialCatalog && duplicateSupplier) {
    throw new Error(`${labels.name} "${name}" đã tồn tại với NCC "${duplicateSupplier}". Vui lòng chọn NCC khác.`);
  }

  if (text(duplicate.code).toLowerCase() === code.toLowerCase()) {
    throw new Error(`${labels.code} "${code}" đã tồn tại. Vui lòng nhập mã khác.`);
  }

  throw new Error(`${labels.name} "${name}" đã tồn tại. Vui lòng nhập tên khác.`);
}

function catalogItemId({
  organizationId,
  projectCode,
  kind,
  code,
  supplier,
}: {
  organizationId: string;
  projectCode: string;
  kind: CatalogItem["kind"];
  code: string;
  supplier: string;
}) {
  if (kind === "hangMuc") return `${organizationId}:${projectCode}:hangMuc:${code}`;

  if (kind === "vatTu" || kind === "vatTuPhu") {
    const supplierKey = encodeURIComponent(text(supplier).trim().toLowerCase());
    return `${organizationId}:${kind}:${code}:${supplierKey}`;
  }

  return `${organizationId}:${kind}:${code}`;
}

async function getCatalogUsageLabels(item: CatalogItem, organizationId: string) {
  const sql = getSql();
  const normalizedName = item.name.trim();
  const normalizedCode = item.code.trim();
  const normalizedSupplier = item.supplier.trim();

  if (!normalizedName && !normalizedCode) return [];

  if (item.kind === "nhaCungCap") {
    const [materialUsage, materialCatalogUsage] = await Promise.all([
      sql`
        select count(*)::int as count
        from gp_materials
        where organization_id = ${organizationId} and lower(btrim(supplier)) = lower(${normalizedName})
      `,
      sql`
        select count(*)::int as count
        from gp_catalog_items
        where organization_id = ${organizationId}
          and kind in ('vatTu', 'vatTuPhu')
          and id <> ${item.id}
          and lower(btrim(supplier)) = lower(${normalizedName})
      `,
    ]);
    const usedInMaterials = number((materialUsage as Row[])[0]?.count);
    const usedInMaterialCatalogs = number((materialCatalogUsage as Row[])[0]?.count);

    return [
      usedInMaterials > 0 ? `Vật tư hiện tại (${usedInMaterials} dòng)` : "",
      usedInMaterialCatalogs > 0 ? `Danh mục > Vật tư (${usedInMaterialCatalogs} mục)` : "",
    ].filter(Boolean);
  }

  if (item.kind === "thauPhu") {
    const [advanceUsage, contractUsage] = await Promise.all([
      sql`
        select count(*)::int as count
        from gp_subcontractors
        where organization_id = ${organizationId}
          and lower(btrim(contractor_name)) = lower(${normalizedName})
      `,
      sql`
        select count(*)::int as count
        from gp_subcontractor_contracts
        where organization_id = ${organizationId}
          and lower(btrim(contractor_name)) = lower(${normalizedName})
      `,
    ]);
    const usedInAdvances = number((advanceUsage as Row[])[0]?.count);
    const usedInContracts = number((contractUsage as Row[])[0]?.count);

    return [
      usedInAdvances > 0 ? `Thầu phụ > Tạm ứng (${usedInAdvances} dòng)` : "",
      usedInContracts > 0 ? `Thầu phụ > Hợp đồng (${usedInContracts} dòng)` : "",
    ].filter(Boolean);
  }

  if (item.kind === "vatTu" || item.kind === "vatTuPhu") {
    const materialType = item.kind === "vatTu" ? "VT Chính" : "VT Phụ";
    const materialUsage = await sql`
      select count(*)::int as count
      from gp_materials
      where organization_id = ${organizationId}
        and material_type = ${materialType}
        and (
          lower(btrim(material_code)) = lower(${normalizedCode})
          or (
            lower(btrim(material_name)) = lower(${normalizedName})
            ${normalizedSupplier ? sql`and lower(btrim(supplier)) = lower(${normalizedSupplier})` : sql``}
          )
        )
    `;
    const usedInMaterials = number((materialUsage as Row[])[0]?.count);

    return [usedInMaterials > 0 ? `Vật tư hiện tại (${usedInMaterials} dòng)` : ""].filter(Boolean);
  }

  if (item.kind === "hangMuc") {
    const [materialUsage, attendanceUsage, payrollUsage, subcontractorUsage, laborNormUsage, progressUsage] =
      await Promise.all([
        sql`
          select count(*)::int as count
          from gp_materials
          where organization_id = ${organizationId}
            and project_code = ${item.projectCode}
            and lower(btrim(category)) = lower(${normalizedName})
        `,
        sql`
          select count(*)::int as count
          from gp_attendance
          where organization_id = ${organizationId}
            and project_code = ${item.projectCode}
            and lower(btrim(category)) = lower(${normalizedName})
        `,
        sql`
          select count(*)::int as count
          from gp_payroll_adjustments
          where organization_id = ${organizationId}
            and project_code = ${item.projectCode}
            and lower(btrim(category)) = lower(${normalizedName})
        `,
        sql`
          select count(*)::int as count
          from gp_subcontractors
          where organization_id = ${organizationId}
            and project_code = ${item.projectCode}
            and lower(btrim(category)) = lower(${normalizedName})
        `,
        sql`
          select count(*)::int as count
          from gp_labor_norms
          where organization_id = ${organizationId}
            and project_code = ${item.projectCode}
            and lower(btrim(category)) = lower(${normalizedName})
        `,
        sql`
          select count(*)::int as count
          from gp_progress
          where organization_id = ${organizationId}
            and project_code = ${item.projectCode}
            and lower(btrim(category)) = lower(${normalizedName})
        `,
      ]);
    const usedInMaterials = number((materialUsage as Row[])[0]?.count);
    const usedInAttendance = number((attendanceUsage as Row[])[0]?.count);
    const usedInPayroll = number((payrollUsage as Row[])[0]?.count);
    const usedInSubcontractors = number((subcontractorUsage as Row[])[0]?.count);
    const usedInLaborNorms = number((laborNormUsage as Row[])[0]?.count);
    const usedInProgress = number((progressUsage as Row[])[0]?.count);

    return [
      usedInMaterials > 0 ? `Vật tư (${usedInMaterials} dòng)` : "",
      usedInAttendance > 0 ? `Nhân công > Chấm công (${usedInAttendance} dòng)` : "",
      usedInPayroll > 0 ? `Nhân công > Bảng lương (${usedInPayroll} dòng)` : "",
      usedInSubcontractors > 0 ? `Thầu phụ > Tạm ứng (${usedInSubcontractors} dòng)` : "",
      usedInLaborNorms > 0 ? "Nhân công > Định mức" : "",
      usedInProgress > 0 ? "Nhân công > Tiến độ" : "",
    ].filter(Boolean);
  }

  return [];
}

export async function manageCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const kind = text(payload.kind) as CatalogItem["kind"];
  if (!catalogKinds.includes(kind)) throw new Error("Loại danh mục không hợp lệ.");
  const labels = catalogFieldLabels[kind];
  const projectCode = kind === "hangMuc" ? text(payload.projectCode).trim() : "";
  if (kind === "hangMuc" && !projectCode) throw new Error("Thiếu công trình cho hạng mục.");
  const name = text(payload.name).trim();
  if (!name) throw new Error(`Thiếu ${labels.name.toLowerCase()}.`);
  const code = normalizeCatalogCode(
    text(payload.code).trim() || (await getNextCatalogCode(kind, organizationId, projectCode)),
  );
  if (!code) throw new Error(`Thiếu ${labels.code.toLowerCase()}.`);
  const unit = text(payload.unit).trim();
  const supplier = kind === "vatTu" || kind === "vatTuPhu" ? text(payload.supplier).trim() : "";
  const contact = text(payload.contact).trim();
  const note = text(payload.note).trim();
  const sortOrder = number(payload.importOrder || payload.sortOrder);
  const archived = bool(payload.archived);

  if ((kind === "vatTu" || kind === "vatTuPhu") && !supplier) {
    throw new Error("Thiếu nhà cung cấp.");
  }

  if (kind === "thauPhu" || kind === "nhaCungCap") {
    if (!contact) throw new Error("Thiếu liên hệ.");
    if (!isValidPhoneNumber(contact)) throw new Error("Liên hệ phải là số điện thoại hợp lệ.");
  }

  const nextId = catalogItemId({ organizationId, projectCode, kind, code, supplier });
  const isExcelImport = sortOrder > 0;
  const originalId = text(payload.originalId || payload.id);
  const uniqueCheckOriginalId = originalId || (isExcelImport ? nextId : "");

  await assertUniqueCatalogItem({
    kind,
    code,
    name,
    supplier,
    originalId: uniqueCheckOriginalId,
    organizationId,
    projectCode,
  });

  if (originalId) {
    await sql`
      update gp_catalog_items
      set id = ${nextId},
          project_code = ${projectCode},
          kind = ${kind},
          code = ${code},
          name = ${name},
          unit = ${unit},
          supplier = ${supplier},
          contact = ${contact},
          note = ${note},
          archived = ${archived},
          sort_order = case when ${sortOrder} > 0 then ${sortOrder} else sort_order end,
          updated_at = now()
      where organization_id = ${organizationId} and id = ${originalId}
    `;
    return;
  }

  if (isExcelImport) {
    await sql`
      insert into gp_catalog_items (id, organization_id, project_code, kind, code, name, unit, supplier, contact, note, sort_order, archived, updated_at)
      values (${nextId}, ${organizationId}, ${projectCode}, ${kind}, ${code}, ${name}, ${unit}, ${supplier}, ${contact}, ${note}, ${sortOrder}, false, now())
      on conflict (id) do update
      set project_code = excluded.project_code,
          kind = excluded.kind,
          code = excluded.code,
          name = excluded.name,
          unit = excluded.unit,
          supplier = excluded.supplier,
          contact = excluded.contact,
          note = excluded.note,
          sort_order = excluded.sort_order,
          archived = false,
          updated_at = now()
    `;
    return;
  }

  await sql`
    insert into gp_catalog_items (id, organization_id, project_code, kind, code, name, unit, supplier, contact, note, sort_order, archived, updated_at)
    values (${nextId}, ${organizationId}, ${projectCode}, ${kind}, ${code}, ${name}, ${unit}, ${supplier}, ${contact}, ${note}, ${sortOrder}, false, now())
    on conflict (id) do update
    set project_code = excluded.project_code,
        kind = excluded.kind,
        code = excluded.code,
        name = excluded.name,
        unit = excluded.unit,
        supplier = excluded.supplier,
        contact = excluded.contact,
        note = excluded.note,
        sort_order = excluded.sort_order,
        archived = false,
        updated_at = now()
  `;
}

export async function deleteCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim();
  const rows = (await sql`
    select *
    from gp_catalog_items
    where organization_id = ${organizationId} and id = ${id}
    limit 1
  `) as Row[];
  const item = rows[0] ? catalogFromRow(rows[0]) : null;

  if (!item) throw new Error("Không tìm thấy danh mục cần xóa.");

  await sql`
    update gp_catalog_items
    set archived = true, updated_at = now()
    where organization_id = ${organizationId} and id = ${id}
  `;
}

export async function restoreCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim();
  const rows = (await sql`
    select *
    from gp_catalog_items
    where organization_id = ${organizationId} and id = ${id}
    limit 1
  `) as Row[];
  const item = rows[0] ? catalogFromRow(rows[0]) : null;

  if (!item) throw new Error("Không tìm thấy danh mục cần khôi phục.");

  await assertUniqueCatalogItem({
    kind: item.kind,
    code: item.code,
    name: item.name,
    supplier: item.supplier,
    originalId: item.id,
    organizationId,
    projectCode: item.projectCode,
  });
  await sql`
    update gp_catalog_items
    set archived = false, updated_at = now()
    where organization_id = ${organizationId} and id = ${id}
  `;
}

export async function destroyCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim();
  await sql`
    delete from gp_catalog_items
    where organization_id = ${organizationId} and id = ${id}
  `;
}

export async function manageStaff(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim() || `NV${Date.now().toString().slice(-6)}`;
  const originalId = text(payload.originalId).trim();
  const name = text(payload.name).trim();
  const resigned = bool(payload.resigned);
  const offDate = dateOnly(payload.offDate);

  if (!name) throw new Error("Thiếu tên nhân sự.");
  if (resigned && !offDate) throw new Error("Vui lòng chọn thời gian nghỉ khi đánh dấu nhân sự đã nghỉ việc.");
  if (originalId && id !== originalId) throw new Error("Không thể thay đổi mã nhân sự khi cập nhật hồ sơ.");

  const existingRows = (await sql`
    select id, organization_id
    from gp_staff
    where lower(id) = lower(${id})
    limit 1
  `) as Row[];
  const existingId = text(existingRows[0]?.id);
  const existingOrgId = text(existingRows[0]?.organization_id);
  if (existingRows.length && existingOrgId !== organizationId) {
    throw new Error("Mã nhân sự đã tồn tại ở tổ chức khác hoặc chưa được gán tổ chức. Vui lòng dùng mã khác.");
  }

  if (originalId) {
    if (!existingRows.length || existingId.toLowerCase() !== originalId.toLowerCase()) {
      throw new Error("Không tìm thấy nhân sự cần cập nhật.");
    }
  } else if (existingRows.length) {
    throw new Error(`Mã nhân sự "${id}" đã tồn tại. Vui lòng nhập mã khác.`);
  }

  await sql`
    insert into gp_staff (id, organization_id, name, team, position, salary_day, resigned, off_date, updated_at)
    values (${id}, ${organizationId}, ${name}, ${text(payload.team)}, ${text(payload.position)}, ${money(payload.salaryDay)}, ${resigned}, ${offDate || null}, now())
    on conflict (id) do update set
      organization_id = excluded.organization_id,
      name = excluded.name,
      team = excluded.team,
      position = excluded.position,
      salary_day = excluded.salary_day,
      resigned = excluded.resigned,
      off_date = excluded.off_date,
      updated_at = now()
  `;
}

function staffSkillCriteriaFromPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, raw]) => {
      const item = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      return [
        key,
        {
          score: Math.min(5, Math.max(0, number(item.score))),
          note: text(item.note).trim(),
        },
      ];
    }),
  );
}

function staffSkillRank(totalScore: number, maxScore: number) {
  if (maxScore <= 0) return "Chưa đánh giá";
  const ratio = totalScore / maxScore;
  if (ratio >= 0.9) return "Hạng A";
  if (ratio >= 0.75) return "Hạng B";
  if (ratio >= 0.6) return "Hạng C";
  return "Cần kèm";
}

export async function saveStaffProfile(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim();
  const name = text(payload.name).trim();
  const resigned = bool(payload.resigned);
  const offDate = dateOnly(payload.offDate);
  const startDate = dateOnly(payload.startDate);

  if (!id) throw new Error("Thiếu mã nhân sự.");
  if (!name) throw new Error("Thiếu họ tên công nhân.");
  if (resigned && !offDate) throw new Error("Vui lòng chọn thời gian nghỉ khi đánh dấu công nhân đã nghỉ việc.");

  const rows = (await sql`
    update gp_staff
    set name = ${name},
        team = ${text(payload.team).trim()},
        position = ${text(payload.position).trim()},
        salary_day = ${requireNonNegativeNumericInput(payload.salaryDay, "Đơn giá ngày")},
        resigned = ${resigned},
        off_date = ${offDate || null},
        avatar_url = ${text(payload.avatarUrl).trim()},
        profile_files = ${text(payload.profileFiles).trim()},
        birth_year = ${text(payload.birthYear).trim()},
        phone = ${text(payload.phone).trim()},
        citizen_id = ${text(payload.citizenId).trim()},
        hometown = ${text(payload.hometown).trim()},
        current_address = ${text(payload.currentAddress).trim()},
        main_skill = ${text(payload.mainSkill).trim()},
        internal_level = ${text(payload.internalLevel).trim()},
        referrer = ${text(payload.referrer).trim()},
        expected_stability = ${text(payload.expectedStability).trim()},
        ranking = ${text(payload.ranking).trim()},
        start_date = ${startDate || null},
        note = ${text(payload.note).trim()},
        updated_at = now()
    where organization_id = ${organizationId} and id = ${id}
    returning *
  `) as Row[];

  if (!rows.length) throw new Error("Không tìm thấy hồ sơ công nhân cần cập nhật.");
  return staffFromRow(rows[0]);
}

export async function saveStaffSkillEvaluation(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const staffId = text(payload.staffId).trim();
  const evaluationDate = dateOnly(payload.evaluationDate) || dateOnly(new Date());
  const criteria = staffSkillCriteriaFromPayload(payload.criteria);
  const totalScore = Object.values(criteria).reduce((sum, item) => sum + Number(item.score || 0), 0);
  const maxScore = Object.keys(criteria).length * 5;
  const rank = staffSkillRank(totalScore, maxScore);
  const rawNewSalary = text(payload.newSalary).trim();
  const newSalary = rawNewSalary ? requireNonNegativeNumericInput(rawNewSalary, "Mức lương mới") : 0;
  const leaveDate = dateOnly(payload.leaveDate);

  if (!staffId) throw new Error("Thiếu công nhân cần đánh giá.");
  if (!evaluationDate) throw new Error("Thiếu ngày đánh giá.");

  const [staffRow] = (await sql`
    select *
    from gp_staff
    where organization_id = ${organizationId} and id = ${staffId}
    limit 1
  `) as Row[];
  if (!staffRow) throw new Error("Không tìm thấy công nhân cần đánh giá.");

  const staff = staffFromRow(staffRow);
  const rows = (await sql`
    insert into gp_staff_skill_evaluations (
      organization_id,
      staff_id,
      staff_name,
      evaluation_date,
      evaluator,
      travel_ready,
      status_after_review,
      leave_date,
      criteria,
      summary_note,
      new_salary,
      total_score,
      rank,
      updated_at
    )
    values (
      ${organizationId},
      ${staffId},
      ${staff.name},
      ${evaluationDate},
      ${text(payload.evaluator).trim()},
      ${text(payload.travelReady).trim()},
      ${text(payload.statusAfterReview).trim() || "Còn làm"},
      ${leaveDate || null},
      (${JSON.stringify(criteria)}::text)::jsonb,
      ${text(payload.summaryNote).trim()},
      ${newSalary},
      ${totalScore},
      ${rank},
      now()
    )
    returning *
  `) as Row[];

  const statusAfterReview = text(payload.statusAfterReview).trim();
  const [updatedStaffRow] = (await sql`
    update gp_staff
    set salary_day = case when ${newSalary} > 0 then ${newSalary} else salary_day end,
        ranking = ${rank},
        resigned = case when ${statusAfterReview} in ('Nghỉ việc', 'Không gọi lại') then true else resigned end,
        off_date = case when ${statusAfterReview} in ('Nghỉ việc', 'Không gọi lại') then coalesce(${leaveDate || null}, off_date) else off_date end,
        updated_at = now()
    where organization_id = ${organizationId} and id = ${staffId}
    returning *
  `) as Row[];

  return {
    skillEvaluation: staffSkillEvaluationFromRow(rows[0]),
    staff: updatedStaffRow ? staffFromRow(updatedStaffRow) : staff,
  };
}

export async function deleteStaff(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim();
  const offDate = dateOnly(payload.offDate) || dateOnly(new Date());

  if (!id) throw new Error("Thiếu nhân sự cần lưu trữ.");

  const rows = (await sql`
    update gp_staff
    set resigned = true,
        off_date = coalesce(off_date, ${offDate || null}),
        updated_at = now()
    where organization_id = ${organizationId} and id = ${id}
    returning id
  `) as Row[];

  if (!rows.length) throw new Error("Không tìm thấy nhân sự cần lưu trữ.");
}

export async function destroyStaff(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = text(payload.id).trim();
  await sql`
    delete from gp_staff
    where organization_id = ${organizationId} and id = ${id}
  `;
}

export async function saveMaterial(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const date = dateOnly(payload.date) || dateOnly(new Date());
  const projectCode = text(payload.projectCode).trim();
  const category = text(payload.category).trim();
  const materialName = text(payload.materialName).trim();
  const quantity = requireNonNegativeNumericInput(payload.quantity, "Số lượng");
  const unit = text(payload.unit).trim();
  const price = requireNonNegativeNumericInput(payload.price, "Đơn giá");
  const materialType = text(payload.materialType).trim() || "VT Chính";
  const id = number(payload.id);

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!materialName) throw new Error("Thiếu vật tư.");
  if (!unit) throw new Error("Thiếu đơn vị.");

  if (id > 0) {
    await sql`
      update gp_materials
      set work_date = ${date},
          week = ${text(payload.week) || weekFromDate(date)},
          shift = ${text(payload.shift)},
          project_code = ${projectCode},
          category = ${category},
          material_code = ${text(payload.materialCode)},
          material_name = ${materialName},
          quantity = ${quantity},
          unit = ${unit},
          price = ${price},
          debt = ${text(payload.debt)},
          status = ${text(payload.status)},
          payment_status = ${text(payload.paymentStatus) || "Chưa TT"},
          payment_info = ${text(payload.paymentInfo)},
          material_type = ${materialType},
          supplier = ${text(payload.supplier)},
          updated_at = now()
      where organization_id = ${organizationId} and id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_materials (
      work_date, week, shift, organization_id, project_code, category, material_code, material_name, quantity, unit, price,
      debt, status, payment_status, payment_info, material_type, supplier
    )
    values (
      ${date}, ${text(payload.week) || weekFromDate(date)}, ${text(payload.shift)}, ${organizationId}, ${projectCode}, ${category},
      ${text(payload.materialCode)}, ${materialName}, ${quantity}, ${unit}, ${price},
      ${text(payload.debt)}, ${text(payload.status)}, ${text(payload.paymentStatus) || "Chưa TT"}, ${text(payload.paymentInfo)},
      ${materialType}, ${text(payload.supplier)}
    )
  `;
}

export async function saveZaloMaterialBreakdown(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const projectCode = text(payload.projectCode).trim();
  const materialType = text(payload.materialType).trim() || "VT Chính";
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!rows.length) throw new Error("Chưa có dòng phân rã Zalo hợp lệ.");
  if (rows.length > 500) throw new Error("Mỗi lần chỉ nên nhập tối đa 500 dòng để hệ thống xử lý ổn định.");

  if (materialType === "VT Chính") {
    const catalogRows =
      await sql`select name from gp_catalog_items where organization_id = ${organizationId} and kind = 'vatTu'`;
    const catalogKeys = new Set((catalogRows as Row[]).map((row) => materialCatalogKey(row.name)).filter(Boolean));
    const missingMaterials = rows
      .map((rawRow) => (rawRow && typeof rawRow === "object" ? (rawRow as Record<string, unknown>) : {}))
      .map((row) => text(row.materialName).trim())
      .filter((materialName) => materialName && !catalogKeys.has(materialCatalogKey(materialName)));

    if (missingMaterials.length) {
      throw new Error(`Vật tư chính chưa khớp danh mục công ty: ${missingMaterials.slice(0, 5).join(", ")}`);
    }
  }

  const preparedRows: Array<{
    date: string;
    week: string;
    shift: string;
    category: string;
    material_code: string;
    material_name: string;
    quantity: number;
    unit: string;
    price: number;
    debt: string;
    status: string;
    payment_status: string;
    payment_info: string;
    supplier: string;
  }> = [];

  for (const rawRow of rows) {
    const row = rawRow && typeof rawRow === "object" ? (rawRow as Record<string, unknown>) : {};
    const date = dateOnly(row.date) || dateOnly(payload.date) || dateOnly(new Date());
    const materialName = text(row.materialName).trim();
    const quantity = decimal(row.quantity);
    const category = text(row.category) || text(payload.category);
    const unit = text(row.unit) || text(payload.unit);

    if (!materialName) continue;
    if (quantity <= 0) continue;
    if (!category) throw new Error(`Thiếu hạng mục cho vật tư ${materialName}.`);
    if (!unit) throw new Error(`Thiếu đơn vị cho vật tư ${materialName}.`);

    preparedRows.push({
      date,
      week: text(row.week) || text(payload.week) || weekFromDate(date),
      shift: text(row.shift) || text(payload.shift),
      category,
      material_code: text(row.materialCode),
      material_name: materialName,
      quantity,
      unit,
      price: money(row.price),
      debt: text(row.debt),
      status: text(row.status) || "Nhập từ phân rã Zalo",
      payment_status: text(row.paymentStatus) || text(payload.paymentStatus) || "Chưa TT",
      payment_info: text(row.paymentInfo) || text(payload.paymentInfo),
      supplier: text(row.supplier) || text(payload.supplier),
    });
  }

  if (!preparedRows.length) return;

  await sql`
    insert into gp_materials (
      work_date, week, shift, organization_id, project_code, category, material_code, material_name, quantity, unit, price,
      debt, status, payment_status, payment_info, material_type, supplier
    )
    select
      x.date,
      x.week,
      x.shift,
      ${organizationId},
      ${projectCode},
      x.category,
      x.material_code,
      x.material_name,
      x.quantity,
      x.unit,
      x.price,
      x.debt,
      x.status,
      x.payment_status,
      x.payment_info,
      ${materialType},
      x.supplier
    from jsonb_to_recordset((${JSON.stringify(preparedRows)}::text)::jsonb) as x(
      date date,
      week text,
      shift text,
      category text,
      material_code text,
      material_name text,
      quantity numeric,
      unit text,
      price numeric,
      debt text,
      status text,
      payment_status text,
      payment_info text,
      supplier text
    )
  `;
}

export async function deleteMaterial(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  await sql`delete from gp_materials where organization_id = ${organizationId} and id = ${number(payload.id)}`;
}

export async function updateMaterialPrice(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  await sql`
    update gp_materials
    set price = ${money(payload.price)}, updated_at = now()
    where organization_id = ${organizationId} and id = ${number(payload.id)}
  `;
}

export async function markMaterialPaid(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const ids = Array.isArray(payload.ids)
    ? payload.ids.map(number).filter(Boolean)
    : [number(payload.id)].filter(Boolean);
  if (!ids.length) return;

  await sql`
    update gp_materials
    set payment_status = 'Đã TT',
        debt = 'Không',
        payment_info = ${text(payload.paymentInfo) || `Đã TT · ${dateOnly(new Date())}`},
        updated_at = now()
    where organization_id = ${organizationId} and id = any(${ids})
  `;
}

export async function saveWeeklyAttendance(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const rows = Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : [payload];
  const savedRows: AttendanceRow[] = [];
  const firstDate = requireDateInput(rows[0]?.date ?? payload.date, "Ngày chấm công");
  const projectCode = text(payload.projectCode || rows[0]?.projectCode).trim();
  const category = text(payload.category || rows[0]?.category).trim();
  const week = weekFromDate(firstDate);

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!week) throw new Error("Tuần chấm công không hợp lệ.");

  const lockKey = attendanceLockKey(organizationId, projectCode, week, category);
  const [lock] =
    (await sql`select status from gp_attendance_locks where organization_id = ${organizationId} and lock_key = ${lockKey}`) as Row[];
  if (text(lock?.status) === "CLOSED") throw new Error("Tuần/hạng mục đã kết sổ, không thể sửa chấm công.");

  if (Array.isArray(payload.rows)) {
    await sql`delete from gp_attendance where organization_id = ${organizationId} and project_code = ${projectCode} and week = ${week} and category = ${category}`;
  }

  for (const row of rows) {
    const date = requireDateInput(row.date, "Ngày chấm công");
    const rowWeek = weekFromDate(date);
    const shift = text(row.shift).trim();
    const staffName = text(row.staffName).trim();
    const position = text(row.position).trim();
    const status = text(row.status).trim();
    const halfDaySalary = requireNumericInput(row.halfDaySalary, "Lương 1/2 ngày");
    const coefficient = requireNumericInput(row.coefficient, "Hệ số");
    const allowance = requireNumericInput(row.allowance, "Phụ cấp");
    const overtimeHours = requireNumericInput(row.overtimeHours, "OT giờ");
    const overtimeAmount = requireNumericInput(row.overtimeAmount, "OT tiền");
    const total = money(row.total) || halfDaySalary * coefficient + allowance + overtimeAmount;
    const id = number(row.id);

    if (rowWeek !== week) throw new Error("Các dòng chấm công phải cùng tuần.");
    if (!shift) throw new Error("Thiếu ca.");
    if (!staffName) throw new Error("Thiếu nhân sự.");
    if (!position) throw new Error("Thiếu chức vụ.");
    if (!status) throw new Error("Thiếu trạng thái.");

    if (id > 0) {
      const [savedRow] = (await sql`
        update gp_attendance
        set work_date = ${date},
            week = ${week},
            shift = ${shift},
            organization_id = ${organizationId},
            project_code = ${projectCode},
            category = ${category},
            staff_name = ${staffName},
            position = ${position},
            half_day_salary = ${halfDaySalary},
            allowance = ${allowance},
            overtime_hours = ${overtimeHours},
            overtime_amount = ${overtimeAmount},
            total = ${total},
            status = ${status},
            coefficient = ${coefficient},
            updated_at = now()
        where organization_id = ${organizationId} and id = ${id}
        returning *
      `) as Row[];
      if (savedRow) savedRows.push(attendanceFromRow(savedRow));
      continue;
    }

    const [savedRow] = (await sql`
      insert into gp_attendance (
        work_date, week, shift, organization_id, project_code, category, staff_name, position, half_day_salary,
        allowance, overtime_hours, overtime_amount, total, status, coefficient
      )
      values (
        ${date}, ${week}, ${shift}, ${organizationId}, ${projectCode}, ${category}, ${staffName}, ${position},
        ${halfDaySalary}, ${allowance}, ${overtimeHours}, ${overtimeAmount}, ${total}, ${status}, ${coefficient}
      )
      returning *
    `) as Row[];
    if (savedRow) savedRows.push(attendanceFromRow(savedRow));
  }

  return savedRows;
}

export async function saveStaffWeeklyAttendance(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const rows = Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : [];
  const projectCode = text(payload.projectCode).trim();
  const week = text(payload.week).trim();
  const category = text(payload.category).trim();
  const staffName = text(payload.staffName).trim();
  const preparedRows = rows.map((row) => {
    const date = requireDateInput(row.date, "Ngày chấm công");
    const rowWeek = weekFromDate(date);
    const shift = text(row.shift).trim();
    const position = text(row.position).trim();
    const status = text(row.status).trim();
    const halfDaySalary = requireNumericInput(row.halfDaySalary, "Lương ngày");
    const coefficient = requireNumericInput(row.coefficient, "Hệ số");
    const allowance = requireNumericInput(row.allowance, "Phụ cấp");
    const overtimeHours = requireNumericInput(row.overtimeHours, "OT giờ");
    const overtimeAmount = requireNumericInput(row.overtimeAmount, "OT tiền");
    const total = money(row.total) || halfDaySalary * coefficient + allowance + overtimeAmount;

    if (rowWeek !== week) throw new Error("Các dòng chấm công phải cùng tuần.");
    if (!shift) throw new Error("Thiếu ca.");
    if (!position) throw new Error("Thiếu chức vụ.");
    if (!status) throw new Error("Thiếu trạng thái.");

    return {
      date,
      shift,
      position,
      status,
      halfDaySalary,
      coefficient,
      allowance,
      overtimeHours,
      overtimeAmount,
      total,
    };
  });

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!week) throw new Error("Tuần chấm công không hợp lệ.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!staffName) throw new Error("Thiếu nhân sự.");

  async function persist(database: ReturnType<typeof getSql>) {
    const savedRows: AttendanceRow[] = [];
    const lockKey = attendanceLockKey(organizationId, projectCode, week, category);
    const [lock] =
      (await database`select status from gp_attendance_locks where organization_id = ${organizationId} and lock_key = ${lockKey}`) as Row[];
    if (text(lock?.status) === "CLOSED") throw new Error("Tuần/hạng mục đã kết sổ, không thể sửa chấm công.");

    const existingRows = (await database`
      select id
      from gp_attendance
      where organization_id = ${organizationId}
        and project_code = ${projectCode}
        and week = ${week}
        and category = ${category}
        and staff_name = ${staffName}
    `) as Row[];
    const deletedIds = existingRows.map((row) => number(row.id)).filter(Boolean);

    await database`
      delete from gp_attendance
      where organization_id = ${organizationId}
        and project_code = ${projectCode}
        and week = ${week}
        and category = ${category}
        and staff_name = ${staffName}
    `;

    if (!preparedRows.length) return { savedRows, deletedIds };

    const insertRows = preparedRows.map((row) => ({
      date: row.date,
      shift: row.shift,
      position: row.position,
      half_day_salary: row.halfDaySalary,
      allowance: row.allowance,
      overtime_hours: row.overtimeHours,
      overtime_amount: row.overtimeAmount,
      total: row.total,
      status: row.status,
      coefficient: row.coefficient,
    }));

    const insertedRows = (await database`
      insert into gp_attendance (
        work_date, week, shift, organization_id, project_code, category, staff_name, position, half_day_salary,
        allowance, overtime_hours, overtime_amount, total, status, coefficient
      )
      select
        x.date,
        ${week},
        x.shift,
        ${organizationId},
        ${projectCode},
        ${category},
        ${staffName},
        x.position,
        x.half_day_salary,
        x.allowance,
        x.overtime_hours,
        x.overtime_amount,
        x.total,
        x.status,
        x.coefficient
      from jsonb_to_recordset((${JSON.stringify(insertRows)}::text)::jsonb) as x(
        date date,
        shift text,
        position text,
        half_day_salary numeric,
        allowance numeric,
        overtime_hours numeric,
        overtime_amount numeric,
        total numeric,
        status text,
        coefficient numeric
      )
      returning *
    `) as Row[];

    savedRows.push(...insertedRows.map(attendanceFromRow));

    return { savedRows, deletedIds };
  }

  if (typeof sql.begin === "function") {
    return sql.begin((transactionSql: ReturnType<typeof getSql>) => persist(transactionSql));
  }

  return persist(sql);
}

export async function savePayrollAdjustment(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const projectCode = text(payload.projectCode).trim();
  const week = text(payload.week).trim();
  const category = text(payload.category).trim();
  const originalCategory = text(payload.originalCategory).trim() || category;
  const staffName = text(payload.staffName).trim();
  const allowance = requireNonNegativeNumericInput(payload.allowance, "Phụ cấp");
  const overtimeHours = requireNonNegativeNumericInput(payload.overtimeHours, "OT giờ");
  const overtimeAmount = requireNonNegativeNumericInput(payload.overtimeAmount, "OT tiền");
  const adjustment = requireNumericInput(payload.adjustment ?? 0, "Điều chỉnh lương");
  const note = text(payload.note).trim();

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!week) throw new Error("Thiếu tuần.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!originalCategory) throw new Error("Thiếu hạng mục gốc.");
  if (!staffName) throw new Error("Thiếu nhân sự.");

  async function persist(database: ReturnType<typeof getSql>) {
    const lockKeys = Array.from(
      new Set([
        attendanceLockKey(organizationId, projectCode, week, originalCategory),
        attendanceLockKey(organizationId, projectCode, week, category),
      ]),
    );
    const locks =
      (await database`select status from gp_attendance_locks where organization_id = ${organizationId} and lock_key = any(${lockKeys})`) as Row[];
    if (locks.some((lock) => text(lock.status) === "CLOSED")) {
      throw new Error("Tuần/hạng mục đã kết sổ, không thể sửa bảng lương.");
    }

    const rows = (await database`
      select *
      from gp_attendance
      where organization_id = ${organizationId}
        and project_code = ${projectCode}
        and week = ${week}
        and category = ${originalCategory}
        and staff_name = ${staffName}
      order by work_date asc nulls last, id asc
    `) as Row[];

    if (!rows.length) throw new Error("Không tìm thấy chấm công tương ứng để cập nhật bảng lương.");

    const savedRows: AttendanceRow[] = [];

    for (const [index, row] of rows.entries()) {
      const rowAllowance = index === 0 ? allowance : 0;
      const rowOvertimeHours = index === 0 ? overtimeHours : 0;
      const rowOvertimeAmount = index === 0 ? overtimeAmount : 0;
      const baseSalary = Math.max(0, number(row.total) - number(row.allowance) - number(row.overtime_amount));
      const nextTotal = baseSalary + rowAllowance + rowOvertimeAmount;
      const [savedRow] = (await database`
        update gp_attendance
        set category = ${category},
            allowance = ${rowAllowance},
            overtime_hours = ${rowOvertimeHours},
            overtime_amount = ${rowOvertimeAmount},
            total = ${nextTotal},
            updated_at = now()
        where organization_id = ${organizationId} and id = ${number(row.id)}
        returning *
      `) as Row[];

      if (savedRow) savedRows.push(attendanceFromRow(savedRow));
    }

    const adjustmentId = payrollAdjustmentId(organizationId, projectCode, week, category, staffName);
    const deletedAdjustmentIds: string[] = [];
    const originalAdjustmentId = payrollAdjustmentId(organizationId, projectCode, week, originalCategory, staffName);

    if (originalAdjustmentId !== adjustmentId) {
      await database`delete from gp_payroll_adjustments where organization_id = ${organizationId} and id = ${originalAdjustmentId}`;
      deletedAdjustmentIds.push(originalAdjustmentId);
    }

    const [savedAdjustment] = (await database`
      insert into gp_payroll_adjustments (
        id, organization_id, project_code, week, category, staff_name,
        allowance, overtime_hours, overtime_amount, adjustment, note, updated_at
      )
      values (
        ${adjustmentId}, ${organizationId}, ${projectCode}, ${week}, ${category}, ${staffName},
        ${allowance}, ${overtimeHours}, ${overtimeAmount}, ${adjustment}, ${note}, now()
      )
      on conflict (id) do update set
        allowance = excluded.allowance,
        overtime_hours = excluded.overtime_hours,
        overtime_amount = excluded.overtime_amount,
        adjustment = excluded.adjustment,
        note = excluded.note,
        updated_at = now()
      returning *
    `) as Row[];

    return { savedRows, adjustment: payrollAdjustmentFromRow(savedAdjustment), deletedAdjustmentIds };
  }

  if (typeof sql.begin === "function") {
    return sql.begin((transactionSql: ReturnType<typeof getSql>) => persist(transactionSql));
  }

  return persist(sql);
}

export async function deleteAttendanceRow(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  if (!id) throw new Error("Thiếu dòng chấm công để xóa.");
  const [row] =
    (await sql`select project_code, week, category from gp_attendance where organization_id = ${organizationId} and id = ${id}`) as Row[];
  if (!row) return;
  const lockKey = attendanceLockKey(organizationId, text(row.project_code), text(row.week), text(row.category));
  const [lock] =
    (await sql`select status from gp_attendance_locks where organization_id = ${organizationId} and lock_key = ${lockKey}`) as Row[];
  if (text(lock?.status) === "CLOSED") throw new Error("Tuần/hạng mục đã kết sổ, không thể xóa chấm công.");
  await sql`delete from gp_attendance where organization_id = ${organizationId} and id = ${id}`;
  return [id];
}

function attendanceLockKey(organizationId: string, projectCode: string, week: string, category: string) {
  return [organizationId, projectCode, week, category || "ALL"].join("::").toLowerCase();
}

function payrollAdjustmentId(
  organizationId: string,
  projectCode: string,
  week: string,
  category: string,
  staffName: string,
) {
  return [organizationId, projectCode, week, category, staffName].map((part) => encodeURIComponent(part)).join("::");
}

export async function closeAttendance(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const projectCode = text(payload.projectCode);
  const week = text(payload.week);
  const category = text(payload.category);
  await sql`
    insert into gp_attendance_locks (lock_key, organization_id, project_code, week, category, status, closed_by, closed_at, note, updated_at)
    values (${attendanceLockKey(organizationId, projectCode, week, category)}, ${organizationId}, ${projectCode}, ${week}, ${category}, 'CLOSED', ${text(payload.by) || "Admin"}, now(), ${text(payload.note)}, now())
    on conflict (lock_key) do update set
      status = 'CLOSED',
      closed_by = excluded.closed_by,
      closed_at = now(),
      note = excluded.note,
      updated_at = now()
  `;
}

export async function reopenAttendance(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  await sql`
    update gp_attendance_locks
    set status = 'OPEN', opened_by = ${text(payload.by) || "Admin"}, opened_at = now(), note = ${text(payload.note)}, updated_at = now()
    where organization_id = ${organizationId} and lock_key = ${attendanceLockKey(organizationId, text(payload.projectCode), text(payload.week), text(payload.category))}
  `;
}

export async function saveSubcontractor(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const date = dateOnly(payload.date) || dateOnly(new Date());
  const projectCode = text(payload.projectCode).trim();
  const category = text(payload.category).trim();
  const contractorName = text(payload.contractorName).trim();
  const advance = requireNonNegativeNumericInput(payload.advance, "Tạm ứng");
  const id = number(payload.id);

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!contractorName) throw new Error("Thiếu thầu phụ.");

  if (id > 0) {
    const [previousRow] =
      (await sql`select file_id from gp_subcontractors where organization_id = ${organizationId} and id = ${id}`) as Row[];
    await sql`
      update gp_subcontractors
      set work_date = ${date},
          week = ${text(payload.week) || weekFromDate(date)},
          organization_id = ${organizationId},
          project_code = ${projectCode},
          category = ${category},
          contractor_name = ${contractorName},
          note = ${text(payload.note)},
          advance = ${advance},
          file_url = ${text(payload.fileUrl)},
          file_id = ${text(payload.fileId)},
          status = ${text(payload.status)},
          updated_at = now()
      where organization_id = ${organizationId} and id = ${id}
    `;
    await recomputeSubcontractorCumulative(projectCode, contractorName, organizationId);
    await deleteAttachmentDocumentIfUnused(number(previousRow?.file_id), organizationId);
    return;
  }

  await sql`
    insert into gp_subcontractors (work_date, week, organization_id, project_code, category, contractor_name, note, advance, file_url, file_id, cumulative, status)
    values (${date}, ${text(payload.week) || weekFromDate(date)}, ${organizationId}, ${projectCode}, ${category}, ${contractorName}, ${text(payload.note)}, ${advance}, ${text(payload.fileUrl)}, ${text(payload.fileId)}, 0, ${text(payload.status)})
  `;
  await recomputeSubcontractorCumulative(projectCode, contractorName, organizationId);
}

async function recomputeSubcontractorCumulative(projectCode: string, contractorName: string, organizationId: string) {
  const sql = getSql();
  await sql`
    with ordered as (
      select
        id,
        sum(advance) over (order by work_date asc nulls last, id asc) as next_cumulative
      from gp_subcontractors
      where organization_id = ${organizationId}
        and project_code = ${projectCode}
        and lower(contractor_name) = lower(${contractorName})
    )
    update gp_subcontractors target
    set cumulative = ordered.next_cumulative,
        updated_at = now()
    from ordered
    where target.organization_id = ${organizationId}
      and target.id = ordered.id
  `;
}

export async function deleteSubcontractor(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  if (!id) throw new Error("Thiếu dòng tạm ứng thầu phụ để lưu trữ.");
  await sql`
    update gp_subcontractors
    set status = 'Đã lưu trữ',
        updated_at = now()
    where organization_id = ${organizationId} and id = ${id}
  `;
}

export async function saveSubcontractorContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const contractorName = text(payload.contractorName).trim();
  const approvedCost = requireNonNegativeNumericInput(payload.approvedCost, "Tổng chi phí dự kiến");

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!contractorName) throw new Error("Thiếu thầu phụ.");

  if (id > 0) {
    const [previousRow] =
      (await sql`select file_id from gp_subcontractor_contracts where organization_id = ${organizationId} and id = ${id}`) as Row[];
    await sql`
      update gp_subcontractor_contracts
      set organization_id = ${organizationId},
          project_code = ${projectCode},
          contractor_name = ${contractorName},
          approved_cost = ${approvedCost},
          note = ${text(payload.note)},
          file_url = ${text(payload.fileUrl)},
          file_id = ${text(payload.fileId)},
          status = ${text(payload.status) || "Chờ duyệt"},
          updated_at = now()
      where organization_id = ${organizationId} and id = ${id}
    `;
    await deleteAttachmentDocumentIfUnused(number(previousRow?.file_id), organizationId);
    return;
  }

  const [previousRow] = (await sql`
      select file_id
      from gp_subcontractor_contracts
      where organization_id = ${organizationId}
        and project_code = ${projectCode}
        and lower(contractor_name) = lower(${contractorName})
      limit 1
    `) as Row[];

  await sql`
    insert into gp_subcontractor_contracts (organization_id, project_code, contractor_name, approved_cost, note, file_url, file_id, status, updated_at)
    values (${organizationId}, ${projectCode}, ${contractorName}, ${approvedCost}, ${text(payload.note)}, ${text(payload.fileUrl)}, ${text(payload.fileId)}, ${text(payload.status) || "Chờ duyệt"}, now())
    on conflict (organization_id, project_code, lower(contractor_name)) do update set
      approved_cost = excluded.approved_cost,
      note = excluded.note,
      file_url = excluded.file_url,
      file_id = excluded.file_id,
      status = excluded.status,
      updated_at = now()
  `;
  await deleteAttachmentDocumentIfUnused(number(previousRow?.file_id), organizationId);
}

export async function deleteSubcontractorContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  if (!id) throw new Error("Thiếu hợp đồng thầu phụ để lưu trữ.");
  await sql`
    update gp_subcontractor_contracts
    set status = 'Đã lưu trữ',
        updated_at = now()
    where organization_id = ${organizationId} and id = ${id}
  `;
}

export async function approveSubcontractorContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  await sql`
    update gp_subcontractor_contracts
    set status = 'Đã duyệt', approved_by = ${text(payload.by) || "Admin"}, approved_at = now(), updated_at = now()
    where organization_id = ${organizationId} and project_code = ${text(payload.projectCode)} and lower(contractor_name) = lower(${text(payload.contractorName)})
  `;
}

export async function saveOperation(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const date = dateOnly(payload.date) || dateOnly(new Date());
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const description = text(payload.description).trim();
  const amount = requireNonNegativeNumericInput(payload.amount, "Số tiền");

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!description) throw new Error("Thiếu diễn giải.");

  if (id > 0) {
    const [previousRow] =
      (await sql`select file_id from gp_operations where organization_id = ${organizationId} and id = ${id}`) as Row[];
    await sql`
      update gp_operations
      set work_date = ${date},
          week = ${text(payload.week) || weekFromDate(date)},
          project_code = ${projectCode},
          description = ${description},
          amount = ${amount},
          file_url = ${text(payload.fileUrl)},
          file_id = ${text(payload.fileId)}
      where organization_id = ${organizationId} and id = ${id}
    `;
    await deleteAttachmentDocumentIfUnused(number(previousRow?.file_id), organizationId);
    return;
  }

  await sql`
    insert into gp_operations (work_date, week, organization_id, project_code, description, amount, file_url, file_id)
    values (${date}, ${text(payload.week) || weekFromDate(date)}, ${organizationId}, ${projectCode}, ${description}, ${amount}, ${text(payload.fileUrl)}, ${text(payload.fileId)})
  `;
}

export async function deleteOperation(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const [row] =
    (await sql`select file_id from gp_operations where organization_id = ${organizationId} and id = ${id}`) as Row[];
  await sql`delete from gp_operations where organization_id = ${organizationId} and id = ${id}`;
  await deleteAttachmentDocumentIfUnused(number(row?.file_id), organizationId);
}

export async function saveLaborNorm(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const category = text(payload.category).trim();
  const workdays = requireNumericInput(payload.workdays, "Số công định mức");
  const cost = requireNumericInput(payload.cost, "Chi phí định mức");

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");

  if (id > 0) {
    await sql`
      update gp_labor_norms
      set organization_id = ${organizationId},
          project_code = ${projectCode},
          category = ${category},
          workdays = ${workdays},
          cost = ${cost},
          updated_at = now()
      where organization_id = ${organizationId} and id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_labor_norms (organization_id, project_code, category, workdays, cost, updated_at)
    values (${organizationId}, ${projectCode}, ${category}, ${workdays}, ${cost}, now())
    on conflict (organization_id, project_code, category) do update set
      workdays = excluded.workdays,
      cost = excluded.cost,
      updated_at = now()
  `;
}

export async function deleteLaborNorm(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  await sql`delete from gp_labor_norms where organization_id = ${organizationId} and id = ${number(payload.id)}`;
}

export async function saveProgress(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const category = text(payload.category).trim();
  const startDate = requireDateInput(payload.startDate, "Ngày bắt đầu");
  const durationDays = Math.round(requireNumericInput(payload.durationDays, "Số ngày"));
  const workdays = requireNumericInput(payload.workdays, "Số công");
  const planEndDate = requireDateInput(payload.planEndDate, "Ngày HT dự kiến");
  const confirmedEndDate = requireDateInput(payload.confirmedEndDate, "Ngày HT xác nhận");
  const evaluation = text(payload.evaluation).trim();

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (durationDays <= 0) throw new Error("Số ngày phải lớn hơn 0.");
  if (workdays <= 0) throw new Error("Số công phải lớn hơn 0.");

  assertProgressDateRules(startDate, planEndDate, confirmedEndDate);

  if (id > 0) {
    await sql`
      update gp_progress
      set organization_id = ${organizationId},
          project_code = ${projectCode},
          category = ${category},
          start_date = ${startDate},
          duration_days = ${durationDays},
          workdays = ${workdays},
          plan_end_date = ${planEndDate},
          confirmed_end_date = ${confirmedEndDate},
          evaluation = ${evaluation},
          updated_at = now()
      where organization_id = ${organizationId} and id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_progress (organization_id, project_code, category, start_date, duration_days, workdays, plan_end_date, confirmed_end_date, evaluation, updated_at)
    values (${organizationId}, ${projectCode}, ${category}, ${startDate}, ${durationDays}, ${workdays}, ${planEndDate}, ${confirmedEndDate}, ${evaluation}, now())
    on conflict (organization_id, project_code, category) do update set
      start_date = excluded.start_date,
      duration_days = excluded.duration_days,
      workdays = excluded.workdays,
      plan_end_date = excluded.plan_end_date,
      confirmed_end_date = excluded.confirmed_end_date,
      evaluation = excluded.evaluation,
      updated_at = now()
  `;
}

export async function deleteProgress(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  await sql`delete from gp_progress where organization_id = ${organizationId} and id = ${number(payload.id)}`;
}

async function ensureDocumentFileColumns() {
  const sql = getSql();

  await sql`alter table gp_documents add column if not exists file_data text not null default ''`;
  await sql`alter table gp_documents add column if not exists file_size bigint not null default 0`;
}

async function ensureStaffDocumentNamespace() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuStaffDocumentNamespaceReady) return;

  state.__giaPhuStaffDocumentNamespacePromise ??= (async () => {
    const sql = getSql();

    await sql`
      insert into gp_projects (code, organization_id, name, owner, contact, referrer, status, drive_url, failure_reason, pin_hash)
      values (${STAFF_DOCUMENT_PROJECT_CODE}, '', 'Hồ sơ nhân sự', '', '', '', 'Đã lưu trữ', '', '', '')
      on conflict (code) do nothing
    `;

    await sql`
      insert into gp_projects (code, organization_id, name, owner, contact, referrer, status, drive_url, failure_reason, pin_hash)
      values (${ATTACHMENT_DOCUMENT_PROJECT_CODE}, '', 'Hồ sơ nghiệp vụ', '', '', '', 'Đã lưu trữ', '', '', '')
      on conflict (code) do nothing
    `;

    await sql`
      update gp_documents
      set project_code = ${STAFF_DOCUMENT_PROJECT_CODE}
      where doc_type in (${STAFF_DOCUMENT_DOC_TYPES[0]}, ${STAFF_DOCUMENT_DOC_TYPES[1]})
        and project_code <> ${STAFF_DOCUMENT_PROJECT_CODE}
    `;

    await sql`
      update gp_documents
      set project_code = ${ATTACHMENT_DOCUMENT_PROJECT_CODE}
      where doc_type in (
          ${ATTACHMENT_DOCUMENT_DOC_TYPES[0]},
          ${ATTACHMENT_DOCUMENT_DOC_TYPES[1]},
          ${ATTACHMENT_DOCUMENT_DOC_TYPES[2]},
          ${ATTACHMENT_DOCUMENT_DOC_TYPES[3]},
          ${ATTACHMENT_DOCUMENT_DOC_TYPES[4]}
        )
        and project_code <> ${ATTACHMENT_DOCUMENT_PROJECT_CODE}
    `;
  })().catch((error) => {
    state.__giaPhuStaffDocumentNamespacePromise = undefined;
    throw error;
  });

  await state.__giaPhuStaffDocumentNamespacePromise;
  state.__giaPhuStaffDocumentNamespaceReady = true;
}

export async function saveDocument(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const docType = text(payload.docType).trim();
  const fileName = text(payload.fileName).trim();
  const fileData = text(payload.fileData);
  const hasFileData = fileData.length > 0;
  const mimeType = text(payload.mimeType).trim() || "application/octet-stream";
  const fileSize = number(payload.fileSize);
  const fileId = text(payload.fileId).trim();
  const note = text(payload.note).trim();
  const previewText = text(payload.previewText).trim();

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!docType) throw new Error("Thiếu loại hồ sơ.");
  if (!fileName) throw new Error("Thiếu tên file.");
  if (id <= 0 && !hasFileData) throw new Error("Vui lòng chọn tệp hồ sơ.");

  if (id > 0) {
    if (hasFileData) {
      await sql`
        update gp_documents
        set organization_id = ${organizationId},
            project_code = ${projectCode},
            doc_type = ${docType},
            file_name = ${fileName},
            mime_type = ${mimeType},
            file_id = ${fileId},
            file_url = ${documentFileUrl(id)},
            file_data = ${fileData},
            file_size = ${fileSize},
            note = ${note},
            preview_text = ${previewText}
        where organization_id = ${organizationId} and id = ${id}
      `;
      await syncAttachmentDocumentReference(id, organizationId);
      return id;
    }

    await sql`
      update gp_documents
      set organization_id = ${organizationId},
          project_code = ${projectCode},
          doc_type = ${docType},
          file_name = ${fileName},
          file_url = ${documentFileUrl(id)},
          note = ${note},
          preview_text = ${previewText}
      where organization_id = ${organizationId} and id = ${id}
    `;
    await syncAttachmentDocumentReference(id, organizationId);
    return id;
  }

  const rows = (await sql`
    insert into gp_documents (organization_id, project_code, doc_type, file_name, mime_type, file_id, file_url, note, preview_text)
    values (${organizationId}, ${projectCode}, ${docType}, ${fileName}, ${mimeType}, ${fileId}, '', ${note}, ${previewText})
    returning id
  `) as Row[];
  const nextId = number(rows[0]?.id);

  await sql`
    update gp_documents
    set file_url = ${documentFileUrl(nextId)},
        file_data = ${fileData},
        file_size = ${fileSize}
    where organization_id = ${organizationId} and id = ${nextId}
  `;

  return nextId;
}

export async function deleteDocument(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const documentId = number(payload.id);
  if (!documentId) return;
  const fileUrl = documentFileUrl(documentId);

  await Promise.all([
    sql`
      update gp_subcontractors
      set file_url = '',
          file_id = '',
          updated_at = now()
      where organization_id = ${organizationId}
        and (file_id = ${String(documentId)} or file_url = ${fileUrl})
    `,
    sql`
      update gp_subcontractor_contracts
      set file_url = '',
          file_id = '',
          updated_at = now()
      where organization_id = ${organizationId}
        and (file_id = ${String(documentId)} or file_url = ${fileUrl})
    `,
    sql`
      update gp_operations
      set file_url = '',
          file_id = ''
      where organization_id = ${organizationId}
        and (file_id = ${String(documentId)} or file_url = ${fileUrl})
    `,
  ]);

  await sql`delete from gp_documents where organization_id = ${organizationId} and id = ${documentId}`;
}

export async function queryDocuments(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const keyword = `%${text(payload.keyword)}%`;
  const rows = await sql`
    select id,
           project_code,
           doc_type,
           file_name,
           mime_type,
           file_id,
           file_url,
           file_size,
           note,
           preview_text,
           created_at,
           file_data <> '' as has_file
    from gp_documents
    where organization_id = ${organizationId}
      and project_code = ${text(payload.projectCode)}
      and doc_type not in (
        ${STAFF_DOCUMENT_DOC_TYPES[0]},
        ${STAFF_DOCUMENT_DOC_TYPES[1]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[0]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[1]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[2]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[3]},
        ${ATTACHMENT_DOCUMENT_DOC_TYPES[4]}
      )
      and (${text(payload.keyword)} = '' or file_name ilike ${keyword} or doc_type ilike ${keyword} or note ilike ${keyword} or preview_text ilike ${keyword})
    order by created_at desc
    limit 50
  `;
  return rows;
}

export async function getDocumentDetail(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const rows = (await sql`
    select id,
           project_code,
           doc_type,
           file_name,
           mime_type,
           file_id,
           file_url,
           file_size,
           note,
           preview_text,
           created_at,
           file_data <> '' as has_file
    from gp_documents
    where organization_id = ${organizationId} and id = ${number(payload.id)}
    limit 1
  `) as Row[];

  return rows[0] ?? null;
}

export async function getStaffDetailData(payload: Record<string, unknown>) {
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const activeProjectCode = text(payload.activeProjectCode).trim();
  const staffId = text(payload.staffId).trim();
  const [staffRow] = (await sql`
    select *
    from gp_staff
    where organization_id = ${organizationId} and id = ${staffId}
    limit 1
  `) as Row[];

  if (!staffRow) return null;

  const staff = staffFromRow(staffRow);
  const activeCategoryOnly = excludeArchivedCategory(sql, organizationId);
  const [attendanceRows, payrollAdjustmentRows, evaluationRows] = await Promise.all([
    activeProjectCode
      ? sql`
          select *
          from gp_attendance
          where organization_id = ${organizationId}
            and project_code = ${activeProjectCode}
            and staff_name = ${staff.name}
            ${activeCategoryOnly}
          order by work_date desc nulls last, id desc
        `
      : sql`select * from gp_attendance where false`,
    activeProjectCode
      ? sql`
          select *
          from gp_payroll_adjustments
          where organization_id = ${organizationId}
            and project_code = ${activeProjectCode}
            and staff_name = ${staff.name}
            ${activeCategoryOnly}
          order by updated_at desc
        `
      : sql`select * from gp_payroll_adjustments where false`,
    sql`
      select *
      from gp_staff_skill_evaluations
      where organization_id = ${organizationId}
        and staff_id = ${staff.id}
      order by evaluation_date desc nulls last, id desc
      limit 50
    `,
  ]);

  return {
    staff,
    attendance: (attendanceRows as Row[]).map(attendanceFromRow),
    payrollAdjustments: (payrollAdjustmentRows as Row[]).map(payrollAdjustmentFromRow),
    skillEvaluations: (evaluationRows as Row[]).map(staffSkillEvaluationFromRow),
  };
}

export async function getDocumentFile(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
  const organizationId = requireOrganizationId(payload.organizationId);
  const rows = (await sql`
    select id, file_name, mime_type, file_data, file_size
    from gp_documents
    where organization_id = ${organizationId} and id = ${number(payload.id)}
    limit 1
  `) as Row[];
  const document = rows[0];

  if (!document) throw new Error("Không tìm thấy hồ sơ.");

  const fileData = text(document.file_data);
  if (!fileData) throw new Error("Hồ sơ này chưa có tệp đính kèm. Vui lòng tải tệp lên lại.");

  return {
    fileName: text(document.file_name) || "ho-so",
    mimeType: text(document.mime_type) || "application/octet-stream",
    fileData,
    fileSize: number(document.file_size),
  };
}
