import { getSql } from "../db/neon";
import { buildNextCatalogCode, catalogKinds, normalizeCatalogCode } from "./catalog-codes";
import { isValidPhoneNumber } from "./phone";
import type {
  AttendanceLockRow,
  AttendanceRow,
  CatalogItem,
  ContractRow,
  CostSummary,
  DocumentRow,
  GiaPhuDashboardData,
  GiaPhuOverviewInsights,
  GiaPhuPagedDataset,
  GiaPhuReportsInsights,
  LaborNormRow,
  MaterialNormRow,
  MaterialRow,
  OperationRow,
  PaymentRow,
  ProgressRow,
  ProjectRow,
  StaffRow,
  SubcontractorContractRow,
  SubcontractorRow,
} from "./types";

type Row = Record<string, unknown>;
type DashboardDataOptions = {
  activeProjectCode?: string;
};

export type GiaPhuPagedRowsOptions = {
  dataset: GiaPhuPagedDataset;
  activeProjectCode?: string;
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string>;
};

export type GiaPhuFilterOption = { label: string; value: string };
export type GiaPhuFilterOptionsResult = Record<string, GiaPhuFilterOption[]>;

export type GiaPhuPagedRowsResult =
  | { dataset: "projects"; rows: ProjectRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "catalogs"; rows: CatalogItem[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "staff"; rows: StaffRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "contracts"; rows: ContractRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "payments"; rows: PaymentRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "documents"; rows: DocumentRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "materials"; rows: MaterialRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "attendance"; rows: AttendanceRow[]; total: number; pageIndex: number; pageSize: number }
  | { dataset: "materialNorms"; rows: MaterialNormRow[]; total: number; pageIndex: number; pageSize: number }
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
  __giaPhuPerformanceIndexesPromise?: Promise<void>;
  __giaPhuPerformanceIndexesReady?: boolean;
};

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
  const today = dateInputTime(dateOnly(new Date()));
  const planEnd = dateInputTime(planEndDate);
  const confirmedEnd = dateInputTime(confirmedEndDate);

  if (start == null || today == null || planEnd == null || confirmedEnd == null) return;

  if (start < today) {
    throw new Error("Ngày bắt đầu không được nhỏ hơn ngày hiện tại.");
  }

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
    code: text(row.code),
    name: text(row.name),
    owner: text(row.owner),
    contact: text(row.contact),
    referrer: text(row.referrer),
    startDate: dateOnly(row.start_date),
    status: text(row.status),
    failureReason: text(row.failure_reason),
  };
}

function catalogFromRow(row: Row): CatalogItem {
  return {
    id: text(row.id),
    kind: text(row.kind) as CatalogItem["kind"],
    code: text(row.code),
    name: text(row.name),
    unit: text(row.unit),
    contact: text(row.contact),
    note: text(row.note),
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
  };
}

function materialNormFromRow(row: Row): MaterialNormRow {
  return {
    id: number(row.id),
    projectCode: text(row.project_code),
    category: text(row.category),
    materialName: text(row.material_name),
    unit: text(row.unit),
    dailyNorm: number(row.daily_norm),
    weeklyNorm: number(row.weekly_norm),
    warningPercent: number(row.warning_percent),
    materialType: (text(row.material_type) || "VT Chính") as MaterialNormRow["materialType"],
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

function buildSummaries(data: {
  materials: MaterialRow[];
  attendance: AttendanceRow[];
  subcontractors: SubcontractorRow[];
  operations: OperationRow[];
}) {
  const summaries: Record<string, CostSummary> = {};
  const get = (code: string) => {
    const key = code || "CHUNG";
    summaries[key] ??= emptySummary();
    return summaries[key];
  };

  for (const row of data.materials) {
    const summary = get(row.projectCode);
    const amount = row.quantity * row.price;
    if (row.materialType === "VT Phụ") summary.materialSub += amount;
    else if (row.materialType === "VT MEP" || row.materialType === "VT MEP-HVAC") summary.materialMep += amount;
    else summary.materialMain += amount;
  }

  for (const row of data.attendance) get(row.projectCode).labor += row.total;
  for (const row of data.subcontractors) get(row.projectCode).subcontractor += row.advance;
  for (const row of data.operations) get(row.projectCode).operations += row.amount;

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
    code text primary key,
    name text not null,
    owner text not null default '',
    contact text not null default '',
    referrer text not null default '',
    start_date date,
    status text not null default 'Đang thi công',
    drive_url text not null default '',
    failure_reason text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_catalog_items (
    id text primary key,
    kind text not null,
    code text not null,
    name text not null,
    unit text not null default '',
    contact text not null default '',
    note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create unique index if not exists gp_catalog_items_kind_name_idx on gp_catalog_items (kind, lower(name))`;

  await sql`create table if not exists gp_staff (
    id text primary key,
    name text not null,
    team text not null default '',
    position text not null default '',
    salary_day numeric not null default 0,
    resigned boolean not null default false,
    off_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_contracts (
    id bigserial primary key,
    project_code text not null references gp_projects(code) on delete cascade,
    contract_no text not null default '',
    value numeric not null default 0,
    signed_date date,
    note text not null default '',
    created_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_payments (
    id bigserial primary key,
    project_code text not null references gp_projects(code) on delete cascade,
    payment_date date,
    amount numeric not null default 0,
    note text not null default '',
    created_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_documents (
    id bigserial primary key,
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

  await sql`create table if not exists gp_attendance_locks (
    lock_key text primary key,
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

  await sql`create unique index if not exists gp_subcontractor_contracts_project_name_idx on gp_subcontractor_contracts (project_code, lower(contractor_name))`;

  await sql`create table if not exists gp_operations (
    id bigserial primary key,
    work_date date,
    week text not null default '',
    project_code text not null,
    description text not null default '',
    amount numeric not null default 0,
    file_url text not null default '',
    file_id text not null default '',
    created_at timestamptz not null default now()
  )`;

  await sql`create table if not exists gp_material_norms (
    id bigserial primary key,
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    material_name text not null default '',
    unit text not null default '',
    daily_norm numeric not null default 0,
    weekly_norm numeric not null default 0,
    warning_percent numeric not null default 0,
    material_type text not null default 'VT Chính',
    updated_at timestamptz not null default now()
  )`;

  await sql`create unique index if not exists gp_material_norms_scope_idx on gp_material_norms (project_code, category, lower(material_name), material_type)`;

  await sql`create table if not exists gp_labor_norms (
    id bigserial primary key,
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    workdays numeric not null default 0,
    cost numeric not null default 0,
    updated_at timestamptz not null default now(),
    unique(project_code, category)
  )`;

  await sql`create table if not exists gp_progress (
    id bigserial primary key,
    project_code text not null references gp_projects(code) on delete cascade,
    category text not null default '',
    start_date date,
    duration_days integer not null default 0,
    workdays numeric not null default 0,
    plan_end_date date,
    confirmed_end_date date,
    evaluation text not null default '',
    updated_at timestamptz not null default now(),
    unique(project_code, category)
  )`;

  await ensureGiaPhuPerformanceIndexes();
}

export async function createGiaPhuSchema() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuSchemaReady) {
    await ensureGiaPhuPerformanceIndexes();
    return;
  }

  const sql = getSql();
  const readinessRows = await sql`
    select
      to_regclass('public.gp_projects') as projects_table,
      to_regclass('public.gp_material_norms') as material_norms_table,
      to_regclass('public.gp_progress') as progress_table
  `;
  const readiness = (readinessRows as Row[])[0] ?? {};

  if (readiness.projects_table && readiness.material_norms_table && readiness.progress_table) {
    state.__giaPhuSchemaReady = true;
    return;
  }

  state.__giaPhuSchemaPromise ??= createGiaPhuSchemaInternal().catch((error) => {
    state.__giaPhuSchemaPromise = undefined;
    throw error;
  });
  await state.__giaPhuSchemaPromise;
  state.__giaPhuSchemaReady = true;
  await ensureGiaPhuPerformanceIndexes();
}

async function ensureGiaPhuPerformanceIndexes() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuPerformanceIndexesReady) return;

  const sql = getSql();
  state.__giaPhuPerformanceIndexesPromise ??= (async () => {
    await sql`create index if not exists gp_materials_project_date_idx on gp_materials (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_attendance_project_date_idx on gp_attendance (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_subcontractors_project_date_idx on gp_subcontractors (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_operations_project_date_idx on gp_operations (project_code, work_date desc, id desc)`;
    await sql`create index if not exists gp_documents_project_date_idx on gp_documents (project_code, created_at desc, id desc)`;
  })().catch((error) => {
    state.__giaPhuPerformanceIndexesPromise = undefined;
    throw error;
  });

  await state.__giaPhuPerformanceIndexesPromise;
  state.__giaPhuPerformanceIndexesReady = true;
}

export async function getGiaPhuProjectList(): Promise<ProjectRow[]> {
  const sql = getSql();
  const projectRows = await sql`select * from gp_projects order by updated_at desc, code asc`;
  return (projectRows as Row[]).map(projectFromRow);
}

export async function getGiaPhuDashboardData(options: DashboardDataOptions = {}): Promise<GiaPhuDashboardData> {
  const sql = getSql();
  const [projects, catalogRows, staffRows] = await Promise.all([
    getGiaPhuProjectList(),
    sql`select * from gp_catalog_items order by kind asc, name asc`,
    sql`select * from gp_staff order by id asc, name asc`,
  ]);
  const activeProjectCode = projects.some((project) => project.code === options.activeProjectCode)
    ? (options.activeProjectCode ?? "")
    : (projects[0]?.code ?? "");

  const [
    materialRows,
    attendanceRows,
    subcontractorRows,
    subcontractorContractRows,
    operationRows,
    materialNormRows,
    laborNormRows,
    progressRows,
    paymentRows,
    contractRows,
    lockRows,
  ] = await Promise.all([
    activeProjectCode
      ? sql`select * from gp_materials where project_code = ${activeProjectCode} order by coalesce(work_date, created_at::date) desc, id desc limit 240`
      : sql`select * from gp_materials order by coalesce(work_date, created_at::date) desc, id desc limit 80`,
    activeProjectCode
      ? sql`select * from gp_attendance where project_code = ${activeProjectCode} order by coalesce(work_date, created_at::date) desc, id desc limit 280`
      : sql`select * from gp_attendance order by coalesce(work_date, created_at::date) desc, id desc limit 80`,
    activeProjectCode
      ? sql`select * from gp_subcontractors where project_code = ${activeProjectCode} order by coalesce(work_date, created_at::date) desc, id desc limit 220`
      : sql`select * from gp_subcontractors order by coalesce(work_date, created_at::date) desc, id desc limit 80`,
    activeProjectCode
      ? sql`select * from gp_subcontractor_contracts where project_code = ${activeProjectCode} order by updated_at desc, id desc`
      : sql`select * from gp_subcontractor_contracts order by updated_at desc, id desc limit 40`,
    activeProjectCode
      ? sql`select * from gp_operations where project_code = ${activeProjectCode} or project_code = 'CHUNG DOANH NGHIỆP' order by coalesce(work_date, created_at::date) desc, id desc limit 160`
      : sql`select * from gp_operations order by coalesce(work_date, created_at::date) desc, id desc limit 60`,
    activeProjectCode
      ? sql`select * from gp_material_norms where project_code = ${activeProjectCode} order by category asc, material_name asc`
      : sql`select * from gp_material_norms order by category asc, material_name asc limit 60`,
    activeProjectCode
      ? sql`select * from gp_labor_norms where project_code = ${activeProjectCode} order by category asc`
      : sql`select * from gp_labor_norms order by category asc limit 60`,
    activeProjectCode
      ? sql`select * from gp_progress where project_code = ${activeProjectCode} order by category asc`
      : sql`select * from gp_progress order by category asc limit 60`,
    activeProjectCode
      ? sql`select * from gp_payments where project_code = ${activeProjectCode} order by payment_date desc, id desc`
      : sql`select * from gp_payments order by payment_date desc, id desc limit 60`,
    activeProjectCode
      ? sql`select * from gp_contracts where project_code = ${activeProjectCode} order by signed_date desc, id desc`
      : sql`select * from gp_contracts order by signed_date desc, id desc limit 60`,
    activeProjectCode
      ? sql`select * from gp_attendance_locks where project_code = ${activeProjectCode} order by updated_at desc`
      : sql`select * from gp_attendance_locks order by updated_at desc limit 60`,
  ]);

  const catalogs = {
    hangMuc: [] as CatalogItem[],
    vatTu: [] as CatalogItem[],
    vatTuPhu: [] as CatalogItem[],
    thauPhu: [] as CatalogItem[],
    nhaCungCap: [] as CatalogItem[],
  };

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
    subcontractors,
    subcontractorContracts: (subcontractorContractRows as Row[]).map(subcontractorContractFromRow),
    operations,
    materialNorms: (materialNormRows as Row[]).map(materialNormFromRow),
    laborNorms: (laborNormRows as Row[]).map(laborNormFromRow),
    progress: (progressRows as Row[]).map(progressFromRow),
    payments: (paymentRows as Row[]).map(paymentFromRow),
    contracts: (contractRows as Row[]).map(contractFromRow),
    attendanceLocks: (lockRows as Row[]).map(lockFromRow),
    summaries: buildSummaries({ materials, attendance, subcontractors, operations }),
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

async function resolveActiveProjectCode(activeProjectCode?: string) {
  const projects = await getGiaPhuProjectList();
  return projects.some((project) => project.code === activeProjectCode)
    ? (activeProjectCode ?? "")
    : (projects[0]?.code ?? "");
}

export async function getGiaPhuOverviewInsights(options: DashboardDataOptions = {}): Promise<GiaPhuOverviewInsights> {
  const sql = getSql();
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode);
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
    sql`select 'materials' as key, count(*)::int as rows, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where project_code = ${activeProjectCode}`,
    sql`select material_type, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where project_code = ${activeProjectCode} group by material_type`,
    sql`select 'labor' as key, count(*)::int as rows, coalesce(sum(total), 0)::float8 as value from gp_attendance where project_code = ${activeProjectCode}`,
    sql`select 'subcontractors' as key, count(*)::int as rows, coalesce(sum(advance), 0)::float8 as value from gp_subcontractors where project_code = ${activeProjectCode}`,
    sql`select 'operations' as key, count(*)::int as rows, coalesce(sum(amount), 0)::float8 as value from gp_operations where project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(value), 0)::float8 as total from gp_contracts where project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(amount), 0)::float8 as total from gp_payments where project_code = ${activeProjectCode}`,
    sql`select coalesce(sum(quantity * price), 0)::float8 as total from gp_materials where project_code = ${activeProjectCode} and payment_status <> 'Đã TT'`,
    sql`
      select
        (
          select count(distinct category)::int from (
            select category from gp_materials where project_code = ${activeProjectCode}
            union all select category from gp_attendance where project_code = ${activeProjectCode}
            union all select category from gp_subcontractors where project_code = ${activeProjectCode}
            union all select description as category from gp_operations where project_code = ${activeProjectCode}
            union all select category from gp_progress where project_code = ${activeProjectCode}
          ) categories where coalesce(category, '') <> ''
        ) as active_categories,
        (
          select count(distinct week)::int from (
            select week from gp_materials where project_code = ${activeProjectCode}
            union all select week from gp_attendance where project_code = ${activeProjectCode}
            union all select week from gp_subcontractors where project_code = ${activeProjectCode}
            union all select week from gp_operations where project_code = ${activeProjectCode}
          ) weeks where coalesce(week, '') <> ''
        ) as active_weeks
    `,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(total), 0)::float8 as value from gp_attendance where project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(advance), 0)::float8 as value from gp_subcontractors where project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_operations where project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(payment_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_payments where project_code = ${activeProjectCode} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(quantity * price), 0)::float8 as materials from gp_materials where project_code = ${activeProjectCode} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(total), 0)::float8 as labor from gp_attendance where project_code = ${activeProjectCode} group by 1`,
    sql`select coalesce(category, 'Khác') as category, coalesce(sum(advance), 0)::float8 as subcontractors from gp_subcontractors where project_code = ${activeProjectCode} group by 1`,
    sql`select coalesce(description, 'Khác') as category, coalesce(sum(amount), 0)::float8 as operations from gp_operations where project_code = ${activeProjectCode} group by 1`,
    sql`select id, material_name, material_code, supplier, category, quantity, price, work_date from gp_materials where project_code = ${activeProjectCode} order by coalesce(work_date, created_at::date) desc, id desc limit 5`,
    sql`select id, note, amount, payment_date from gp_payments where project_code = ${activeProjectCode} order by coalesce(payment_date, created_at::date) desc, id desc limit 5`,
    sql`select id, contractor_name, category, note, advance, work_date from gp_subcontractors where project_code = ${activeProjectCode} order by coalesce(work_date, created_at::date) desc, id desc limit 5`,
    sql`select id, description, amount, work_date from gp_operations where project_code = ${activeProjectCode} order by coalesce(work_date, created_at::date) desc, id desc limit 5`,
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

export async function getGiaPhuReportsInsights(options: DashboardDataOptions = {}): Promise<GiaPhuReportsInsights> {
  const overview = await getGiaPhuOverviewInsights(options);
  const sql = getSql();
  const activeProjectCode = await resolveActiveProjectCode(options.activeProjectCode);
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
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(quantity * price), 0)::float8 as value from gp_materials where project_code = ${activeProjectCode} and material_type = 'VT Chính' group by 1`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(total), 0)::float8 as value from gp_attendance where project_code = ${activeProjectCode} group by 1`,
    sql`select null::text as month, 0::float8 as value where false`,
    sql`select to_char(coalesce(work_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_operations where project_code = ${activeProjectCode} group by 1`,
    sql`select to_char(coalesce(payment_date, created_at::date), 'YYYY-MM') as month, coalesce(sum(amount), 0)::float8 as value from gp_payments where project_code = ${activeProjectCode} group by 1`,
    sql`select week, coalesce(sum(quantity * price), 0)::float8 as materials from gp_materials where project_code = ${activeProjectCode} and material_type = 'VT Chính' group by 1`,
    sql`select week, coalesce(sum(total), 0)::float8 as labor from gp_attendance where project_code = ${activeProjectCode} group by 1`,
    sql`select null::text as week, 0::float8 as subcontractors where false`,
    sql`select week, coalesce(sum(amount), 0)::float8 as operations from gp_operations where project_code = ${activeProjectCode} group by 1`,
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

export async function getGiaPhuPagedRows(options: GiaPhuPagedRowsOptions): Promise<GiaPhuPagedRowsResult> {
  const sql = getSql();
  const projects = await getGiaPhuProjectList();
  const activeProjectCode = projects.some((project) => project.code === options.activeProjectCode)
    ? (options.activeProjectCode ?? "")
    : (projects[0]?.code ?? "");
  const pageSize = normalizePageSize(options.pageSize);
  const pageIndex = normalizePageIndex(options.pageIndex);
  const offset = pageIndex * pageSize;
  const search = text(options.search).trim();
  const pattern = `%${search}%`;
  const filterValue = (key: string) => text(options.filters?.[key]).trim();

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
      sql`select count(*)::int as total from gp_projects where true ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_projects
        where true ${whereSearch} ${whereFilters}
        order by updated_at desc, code asc
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
      ? sql`and lower(concat_ws(' ', kind, code, name, unit, contact, note)) like lower(${pattern})`
      : sql``;
    const kindFilter = filterValue("kind");
    const unitFilter = filterValue("unit");
    const contactFilter = filterValue("contact");
    const whereFilters = sql`
      ${kindFilter ? sql`and kind = ${kindFilter}` : sql``}
      ${unitFilter ? sql`and unit = ${unitFilter}` : sql``}
      ${contactFilter ? sql`and contact = ${contactFilter}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_catalog_items where true ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_catalog_items
        where true ${whereSearch} ${whereFilters}
        order by kind asc, name asc
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
      sql`select count(*)::int as total from gp_staff where true ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_staff
        where true ${whereSearch} ${whereFilters}
        order by id asc, name asc
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
    const whereSearch = search ? sql`and lower(concat_ws(' ', contract_no, note)) like lower(${pattern})` : sql``;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_contracts where project_code = ${activeProjectCode} ${whereSearch}`,
      sql`
        select *
        from gp_contracts
        where project_code = ${activeProjectCode} ${whereSearch}
        order by signed_date desc, id desc
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
    const whereSearch = search ? sql`and lower(concat_ws(' ', note)) like lower(${pattern})` : sql``;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_payments where project_code = ${activeProjectCode} ${whereSearch}`,
      sql`
        select *
        from gp_payments
        where project_code = ${activeProjectCode} ${whereSearch}
        order by payment_date desc, id desc
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
      sql`select count(*)::int as total from gp_documents where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select ${selectDocumentFields}
        from gp_documents
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by created_at desc, id desc
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
    const whereFilters = sql`
      ${weekFilter ? sql`and week = ${weekFilter}` : sql``}
      ${materialTypeFilter ? sql`and material_type = ${materialTypeFilter}` : sql``}
      ${paymentStatusFilter ? sql`and payment_status = ${paymentStatusFilter}` : sql``}
      ${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}
      ${supplierFilter ? sql`and supplier = ${supplierFilter}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_materials where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_materials
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by coalesce(work_date, created_at::date) desc, id desc
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
      sql`select count(*)::int as total from gp_attendance where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_attendance
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by coalesce(work_date, created_at::date) desc, id desc
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

  if (options.dataset === "materialNorms") {
    const whereSearch = search
      ? sql`and lower(concat_ws(' ', category, material_name, unit, material_type)) like lower(${pattern})`
      : sql``;
    const categoryFilter = filterValue("category");
    const materialTypeFilter = filterValue("materialType");
    const whereFilters = sql`
      ${categoryFilter ? sql`and category = ${categoryFilter}` : sql``}
      ${materialTypeFilter ? sql`and material_type = ${materialTypeFilter}` : sql``}
    `;
    const [countRows, rows] = await Promise.all([
      sql`select count(*)::int as total from gp_material_norms where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_material_norms
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by category asc, material_name asc, id desc
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

    return {
      dataset: "materialNorms",
      rows: (rows as Row[]).map(materialNormFromRow),
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
      sql`select count(*)::int as total from gp_labor_norms where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_labor_norms
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by category asc, id desc
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
      sql`select count(*)::int as total from gp_progress where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_progress
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by start_date desc nulls last, category asc, id desc
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
      sql`select count(*)::int as total from gp_subcontractors where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_subcontractors
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by coalesce(work_date, created_at::date) desc, id desc
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
      sql`select count(*)::int as total from gp_subcontractor_contracts where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
      sql`
        select *
        from gp_subcontractor_contracts
        where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
        order by updated_at desc, id desc
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
    sql`select count(*)::int as total from gp_operations where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}`,
    sql`
      select *
      from gp_operations
      where project_code = ${activeProjectCode} ${whereSearch} ${whereFilters}
      order by coalesce(work_date, created_at::date) desc, id desc
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
  activeProjectCode?: string;
  filters?: Record<string, string>;
}): Promise<GiaPhuFilterOptionsResult> {
  const sql = getSql();
  const projects = await getGiaPhuProjectList();
  const activeProjectCode = projects.some((project) => project.code === options.activeProjectCode)
    ? (options.activeProjectCode ?? "")
    : (projects[0]?.code ?? "");
  const fixedFilterValue = (key: string) => text(options.filters?.[key]).trim();

  if (options.dataset === "projects") {
    const [statusRows, ownerRows] = await Promise.all([
      sql`select distinct status as value from gp_projects where status <> '' order by status asc limit 300`,
      sql`select distinct owner as value from gp_projects where owner <> '' order by owner asc limit 300`,
    ]);

    return {
      status: distinctOptions(statusRows),
      owner: distinctOptions(ownerRows),
    };
  }

  if (options.dataset === "catalogs") {
    const kindFilter = fixedFilterValue("kind");
    const whereKind = kindFilter ? sql`and kind = ${kindFilter}` : sql``;
    const [kindRows, unitRows, contactRows] = await Promise.all([
      sql`select distinct kind as value from gp_catalog_items where kind <> '' order by kind asc limit 300`,
      sql`select distinct unit as value from gp_catalog_items where unit <> '' ${whereKind} order by unit asc limit 300`,
      sql`select distinct contact as value from gp_catalog_items where contact <> '' ${whereKind} order by contact asc limit 300`,
    ]);

    return {
      kind: distinctOptions(kindRows),
      unit: distinctOptions(unitRows),
      contact: distinctOptions(contactRows),
    };
  }

  if (options.dataset === "staff") {
    const [teamRows, positionRows] = await Promise.all([
      sql`select distinct team as value from gp_staff where team <> '' order by team asc limit 300`,
      sql`select distinct position as value from gp_staff where position <> '' order by position asc limit 300`,
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

  if (options.dataset === "documents") {
    await ensureDocumentFileColumns();
    const [typeRows] = await Promise.all([
      sql`select distinct doc_type as value from gp_documents where project_code = ${activeProjectCode} and doc_type <> '' order by doc_type asc limit 300`,
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
    const [weekRows, materialTypeRows, paymentStatusRows, categoryRows, supplierRows] = await Promise.all([
      sql`select distinct week as value from gp_materials where project_code = ${activeProjectCode} and week <> '' order by week desc limit 300`,
      sql`select distinct material_type as value from gp_materials where project_code = ${activeProjectCode} and material_type <> '' order by material_type asc limit 300`,
      sql`select distinct payment_status as value from gp_materials where project_code = ${activeProjectCode} and payment_status <> '' order by payment_status asc limit 300`,
      sql`select distinct category as value from gp_materials where project_code = ${activeProjectCode} and category <> '' order by category asc limit 300`,
      sql`select distinct supplier as value from gp_materials where project_code = ${activeProjectCode} and supplier <> '' order by supplier asc limit 300`,
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
    const [weekRows, categoryRows, staffRows, positionRows, shiftRows] = await Promise.all([
      sql`select distinct week as value from gp_attendance where project_code = ${activeProjectCode} and week <> '' order by week desc limit 300`,
      sql`select distinct category as value from gp_attendance where project_code = ${activeProjectCode} and category <> '' order by category asc limit 300`,
      sql`select distinct staff_name as value from gp_attendance where project_code = ${activeProjectCode} and staff_name <> '' order by staff_name asc limit 300`,
      sql`select distinct position as value from gp_attendance where project_code = ${activeProjectCode} and position <> '' order by position asc limit 300`,
      sql`select distinct shift as value from gp_attendance where project_code = ${activeProjectCode} and shift <> '' order by shift asc limit 300`,
    ]);

    return {
      week: distinctOptions(weekRows),
      category: distinctOptions(categoryRows),
      staffName: distinctOptions(staffRows),
      position: distinctOptions(positionRows),
      shift: distinctOptions(shiftRows),
    };
  }

  if (options.dataset === "materialNorms") {
    const [categoryRows, materialTypeRows] = await Promise.all([
      sql`select distinct category as value from gp_material_norms where project_code = ${activeProjectCode} and category <> '' order by category asc limit 300`,
      sql`select distinct material_type as value from gp_material_norms where project_code = ${activeProjectCode} and material_type <> '' order by material_type asc limit 300`,
    ]);

    return {
      category: distinctOptions(categoryRows),
      materialType: distinctOptions(materialTypeRows),
    };
  }

  if (options.dataset === "laborNorms") {
    const rows =
      await sql`select distinct category as value from gp_labor_norms where project_code = ${activeProjectCode} and category <> '' order by category asc limit 300`;
    return { category: distinctOptions(rows) };
  }

  if (options.dataset === "progress") {
    const rows =
      await sql`select distinct category as value from gp_progress where project_code = ${activeProjectCode} and category <> '' order by category asc limit 300`;
    return { category: distinctOptions(rows) };
  }

  if (options.dataset === "subcontractors") {
    const [weekRows, categoryRows, contractorRows] = await Promise.all([
      sql`select distinct week as value from gp_subcontractors where project_code = ${activeProjectCode} and week <> '' order by week desc limit 300`,
      sql`select distinct category as value from gp_subcontractors where project_code = ${activeProjectCode} and category <> '' order by category asc limit 300`,
      sql`select distinct contractor_name as value from gp_subcontractors where project_code = ${activeProjectCode} and contractor_name <> '' order by contractor_name asc limit 300`,
    ]);

    return {
      week: distinctOptions(weekRows),
      category: distinctOptions(categoryRows),
      contractorName: distinctOptions(contractorRows),
    };
  }

  if (options.dataset === "subcontractorContracts") {
    const rows =
      await sql`select distinct status as value from gp_subcontractor_contracts where project_code = ${activeProjectCode} and status <> '' order by status asc limit 300`;
    return { status: distinctOptions(rows) };
  }

  if (options.dataset === "operations") {
    const rows =
      await sql`select distinct week as value from gp_operations where project_code = ${activeProjectCode} and week <> '' order by week desc limit 300`;
    return { week: distinctOptions(rows) };
  }

  return {};
}

export async function saveProject(payload: Record<string, unknown>) {
  const sql = getSql();
  const code = text(payload.code).trim();
  const name = text(payload.name).trim();
  if (!code || !name) throw new Error("Thiếu mã hoặc tên công trình.");

  await sql`
    insert into gp_projects (code, name, owner, contact, referrer, start_date, status, failure_reason, updated_at)
    values (${code}, ${name}, ${text(payload.owner)}, ${text(payload.contact)}, ${text(payload.referrer)}, ${dateOnly(payload.startDate) || null}, ${text(payload.status) || "Đang thi công"}, ${text(payload.failureReason)}, now())
    on conflict (code) do update set
      name = excluded.name,
      owner = excluded.owner,
      contact = excluded.contact,
      referrer = excluded.referrer,
      start_date = excluded.start_date,
      status = excluded.status,
      failure_reason = excluded.failure_reason,
      updated_at = now()
  `;
}

export async function deleteProject(payload: Record<string, unknown>) {
  const sql = getSql();
  const code = text(payload.code).trim();
  if (!code) throw new Error("Thiếu mã công trình để xóa.");
  await sql`delete from gp_projects where code = ${code}`;
}

export async function saveContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_contracts
      set project_code = ${text(payload.projectCode)},
          contract_no = ${text(payload.contractNo)},
          value = ${money(payload.value)},
          signed_date = ${dateOnly(payload.signedDate) || null},
          note = ${text(payload.note)}
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_contracts (project_code, contract_no, value, signed_date, note)
    values (${text(payload.projectCode)}, ${text(payload.contractNo)}, ${money(payload.value)}, ${dateOnly(payload.signedDate) || null}, ${text(payload.note)})
  `;
}

export async function deleteContract(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_contracts where id = ${number(payload.id)}`;
}

export async function savePayment(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_payments
      set project_code = ${text(payload.projectCode)},
          payment_date = ${dateOnly(payload.date) || null},
          amount = ${money(payload.amount)},
          note = ${text(payload.note)}
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_payments (project_code, payment_date, amount, note)
    values (${text(payload.projectCode)}, ${dateOnly(payload.date) || null}, ${money(payload.amount)}, ${text(payload.note)})
  `;
}

export async function deletePayment(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_payments where id = ${number(payload.id)}`;
}

async function getNextCatalogCode(kind: CatalogItem["kind"]) {
  const sql = getSql();
  const rows = (await sql`
    select code
    from gp_catalog_items
    where kind = ${kind}
  `) as Row[];

  return buildNextCatalogCode(
    kind,
    rows.map((row) => text(row.code)),
  );
}

async function assertUniqueCatalogItem({
  kind,
  code,
  name,
  originalId,
}: {
  kind: CatalogItem["kind"];
  code: string;
  name: string;
  originalId: string;
}) {
  const sql = getSql();
  const duplicateRows = (await sql`
    select id, code, name
    from gp_catalog_items
    where kind = ${kind}
      and id <> ${originalId}
      and (lower(code) = lower(${code}) or lower(name) = lower(${name}))
    limit 1
  `) as Row[];
  const duplicate = duplicateRows[0];

  if (!duplicate) return;

  const labels = catalogFieldLabels[kind];
  if (text(duplicate.code).toLowerCase() === code.toLowerCase()) {
    throw new Error(`${labels.code} "${code}" đã tồn tại. Vui lòng nhập mã khác.`);
  }

  throw new Error(`${labels.name} "${name}" đã tồn tại. Vui lòng nhập tên khác.`);
}

async function assertCatalogCanBeDeleted(item: CatalogItem) {
  if (item.kind !== "hangMuc") return;

  const sql = getSql();
  const [laborNormUsage, progressUsage] = await Promise.all([
    sql`
      select count(*)::int as count
      from gp_labor_norms
      where lower(category) = lower(${item.name})
    `,
    sql`
      select count(*)::int as count
      from gp_progress
      where lower(category) = lower(${item.name})
    `,
  ]);
  const usedInLaborNorms = number((laborNormUsage as Row[])[0]?.count);
  const usedInProgress = number((progressUsage as Row[])[0]?.count);
  const usedIn = [
    usedInLaborNorms > 0 ? "Nhân công > Định mức" : "",
    usedInProgress > 0 ? "Nhân công > Tiến độ" : "",
  ].filter(Boolean);

  if (!usedIn.length) return;

  throw new Error(`Không thể xóa hạng mục "${item.name}" vì đang được sử dụng ở ${usedIn.join(" và ")}.`);
}

export async function manageCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const kind = text(payload.kind) as CatalogItem["kind"];
  if (!catalogKinds.includes(kind)) throw new Error("Loại danh mục không hợp lệ.");
  const labels = catalogFieldLabels[kind];
  const name = text(payload.name).trim();
  if (!name) throw new Error(`Thiếu ${labels.name.toLowerCase()}.`);
  const code = normalizeCatalogCode(text(payload.code).trim() || (await getNextCatalogCode(kind)));
  if (!code) throw new Error(`Thiếu ${labels.code.toLowerCase()}.`);
  const unit = text(payload.unit).trim();
  const contact = text(payload.contact).trim();
  const note = text(payload.note).trim();

  if ((kind === "vatTu" || kind === "vatTuPhu") && !unit) {
    throw new Error("Thiếu đơn vị.");
  }

  if (kind === "thauPhu" || kind === "nhaCungCap") {
    if (!contact) throw new Error("Thiếu liên hệ.");
    if (!isValidPhoneNumber(contact)) throw new Error("Liên hệ phải là số điện thoại hợp lệ.");
  }

  const nextId = `${kind}:${code}`;
  const originalId = text(payload.originalId || payload.id);

  await assertUniqueCatalogItem({ kind, code, name, originalId });

  if (originalId) {
    await sql`
      update gp_catalog_items
      set id = ${nextId},
          kind = ${kind},
          code = ${code},
          name = ${name},
          unit = ${unit},
          contact = ${contact},
          note = ${note},
          updated_at = now()
      where id = ${originalId}
    `;
    return;
  }

  await sql`
    insert into gp_catalog_items (id, kind, code, name, unit, contact, note, updated_at)
    values (${nextId}, ${kind}, ${code}, ${name}, ${unit}, ${contact}, ${note}, now())
  `;
}

export async function deleteCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = text(payload.id).trim();
  const rows = (await sql`
    select *
    from gp_catalog_items
    where id = ${id}
    limit 1
  `) as Row[];
  const item = rows[0] ? catalogFromRow(rows[0]) : null;

  if (!item) throw new Error("Không tìm thấy danh mục cần xóa.");

  await assertCatalogCanBeDeleted(item);
  await sql`delete from gp_catalog_items where id = ${id}`;
}

export async function manageStaff(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = text(payload.id).trim() || `NV${Date.now().toString().slice(-6)}`;
  const name = text(payload.name).trim();
  const resigned = bool(payload.resigned);
  const offDate = dateOnly(payload.offDate);

  if (!name) throw new Error("Thiếu tên nhân sự.");
  if (resigned && !offDate) throw new Error("Vui lòng chọn thời gian nghỉ khi đánh dấu nhân sự đã nghỉ việc.");

  await sql`
    insert into gp_staff (id, name, team, position, salary_day, resigned, off_date, updated_at)
    values (${id}, ${name}, ${text(payload.team)}, ${text(payload.position)}, ${money(payload.salaryDay)}, ${resigned}, ${offDate || null}, now())
    on conflict (id) do update set
      name = excluded.name,
      team = excluded.team,
      position = excluded.position,
      salary_day = excluded.salary_day,
      resigned = excluded.resigned,
      off_date = excluded.off_date,
      updated_at = now()
  `;
}

export async function deleteStaff(_payload: Record<string, unknown>) {
  throw new Error("Không thể xóa nhân sự. Hãy đánh dấu Đã nghỉ việc và chọn thời gian nghỉ để lưu trữ hồ sơ nhân sự.");
}

export async function saveMaterial(payload: Record<string, unknown>) {
  const sql = getSql();
  const date = dateOnly(payload.date) || dateOnly(new Date());
  const quantity = decimal(payload.quantity);
  const price = money(payload.price);
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_materials
      set work_date = ${date},
          week = ${text(payload.week) || weekFromDate(date)},
          shift = ${text(payload.shift)},
          project_code = ${text(payload.projectCode)},
          category = ${text(payload.category)},
          material_code = ${text(payload.materialCode)},
          material_name = ${text(payload.materialName)},
          quantity = ${quantity},
          unit = ${text(payload.unit)},
          price = ${price},
          debt = ${text(payload.debt)},
          status = ${text(payload.status)},
          payment_status = ${text(payload.paymentStatus) || "Chưa TT"},
          payment_info = ${text(payload.paymentInfo)},
          material_type = ${text(payload.materialType) || "VT Chính"},
          supplier = ${text(payload.supplier)},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_materials (
      work_date, week, shift, project_code, category, material_code, material_name, quantity, unit, price,
      debt, status, payment_status, payment_info, material_type, supplier
    )
    values (
      ${date}, ${text(payload.week) || weekFromDate(date)}, ${text(payload.shift)}, ${text(payload.projectCode)}, ${text(payload.category)},
      ${text(payload.materialCode)}, ${text(payload.materialName)}, ${quantity}, ${text(payload.unit)}, ${price},
      ${text(payload.debt)}, ${text(payload.status)}, ${text(payload.paymentStatus) || "Chưa TT"}, ${text(payload.paymentInfo)},
      ${text(payload.materialType) || "VT Chính"}, ${text(payload.supplier)}
    )
  `;
}

export async function deleteMaterial(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_materials where id = ${number(payload.id)}`;
}

export async function updateMaterialPrice(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`
    update gp_materials
    set price = ${money(payload.price)}, updated_at = now()
    where id = ${number(payload.id)}
  `;
}

export async function markMaterialPaid(payload: Record<string, unknown>) {
  const sql = getSql();
  const ids = Array.isArray(payload.ids)
    ? payload.ids.map(number).filter(Boolean)
    : [number(payload.id)].filter(Boolean);
  for (const id of ids) {
    await sql`
      update gp_materials
      set payment_status = 'Đã TT',
          payment_info = ${text(payload.paymentInfo) || `Đã TT · ${dateOnly(new Date())}`},
          updated_at = now()
      where id = ${id}
    `;
  }
}

export async function saveWeeklyAttendance(payload: Record<string, unknown>) {
  const sql = getSql();
  const rows = Array.isArray(payload.rows) ? (payload.rows as Record<string, unknown>[]) : [payload];
  const savedRows: AttendanceRow[] = [];
  const firstDate = requireDateInput(rows[0]?.date ?? payload.date, "Ngày chấm công");
  const projectCode = text(payload.projectCode || rows[0]?.projectCode).trim();
  const category = text(payload.category || rows[0]?.category).trim();
  const week = weekFromDate(firstDate);

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!week) throw new Error("Tuần chấm công không hợp lệ.");

  const lockKey = attendanceLockKey(projectCode, week, category);
  const [lock] = (await sql`select status from gp_attendance_locks where lock_key = ${lockKey}`) as Row[];
  if (text(lock?.status) === "CLOSED") throw new Error("Tuần/hạng mục đã kết sổ, không thể sửa chấm công.");

  if (Array.isArray(payload.rows)) {
    await sql`delete from gp_attendance where project_code = ${projectCode} and week = ${week} and category = ${category}`;
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
        where id = ${id}
        returning *
      `) as Row[];
      if (savedRow) savedRows.push(attendanceFromRow(savedRow));
      continue;
    }

    const [savedRow] = (await sql`
      insert into gp_attendance (
        work_date, week, shift, project_code, category, staff_name, position, half_day_salary,
        allowance, overtime_hours, overtime_amount, total, status, coefficient
      )
      values (
        ${date}, ${week}, ${shift}, ${projectCode}, ${category}, ${staffName}, ${position},
        ${halfDaySalary}, ${allowance}, ${overtimeHours}, ${overtimeAmount}, ${total}, ${status}, ${coefficient}
      )
      returning *
    `) as Row[];
    if (savedRow) savedRows.push(attendanceFromRow(savedRow));
  }

  return savedRows;
}

export async function deleteAttendanceRow(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  if (!id) throw new Error("Thiếu dòng chấm công để xóa.");
  const [row] = (await sql`select project_code, week, category from gp_attendance where id = ${id}`) as Row[];
  if (!row) return;
  const lockKey = attendanceLockKey(text(row.project_code), text(row.week), text(row.category));
  const [lock] = (await sql`select status from gp_attendance_locks where lock_key = ${lockKey}`) as Row[];
  if (text(lock?.status) === "CLOSED") throw new Error("Tuần/hạng mục đã kết sổ, không thể xóa chấm công.");
  await sql`delete from gp_attendance where id = ${id}`;
  return [id];
}

function attendanceLockKey(projectCode: string, week: string, category: string) {
  return [projectCode, week, category || "ALL"].join("::").toLowerCase();
}

export async function closeAttendance(payload: Record<string, unknown>) {
  const sql = getSql();
  const projectCode = text(payload.projectCode);
  const week = text(payload.week);
  const category = text(payload.category);
  await sql`
    insert into gp_attendance_locks (lock_key, project_code, week, category, status, closed_by, closed_at, note, updated_at)
    values (${attendanceLockKey(projectCode, week, category)}, ${projectCode}, ${week}, ${category}, 'CLOSED', ${text(payload.by) || "Admin"}, now(), ${text(payload.note)}, now())
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
  await sql`
    update gp_attendance_locks
    set status = 'OPEN', opened_by = ${text(payload.by) || "Admin"}, opened_at = now(), note = ${text(payload.note)}, updated_at = now()
    where lock_key = ${attendanceLockKey(text(payload.projectCode), text(payload.week), text(payload.category))}
  `;
}

export async function saveSubcontractor(payload: Record<string, unknown>) {
  const sql = getSql();
  const date = dateOnly(payload.date) || dateOnly(new Date());
  const projectCode = text(payload.projectCode);
  const contractorName = text(payload.contractorName);
  const advance = money(payload.advance);
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_subcontractors
      set work_date = ${date},
          week = ${text(payload.week) || weekFromDate(date)},
          project_code = ${projectCode},
          category = ${text(payload.category)},
          contractor_name = ${contractorName},
          note = ${text(payload.note)},
          advance = ${advance},
          file_url = ${text(payload.fileUrl)},
          file_id = ${text(payload.fileId)},
          status = ${text(payload.status)},
          updated_at = now()
      where id = ${id}
    `;
    await recomputeSubcontractorCumulative(projectCode, contractorName);
    return;
  }

  await sql`
    insert into gp_subcontractors (work_date, week, project_code, category, contractor_name, note, advance, file_url, file_id, cumulative, status)
    values (${date}, ${text(payload.week) || weekFromDate(date)}, ${projectCode}, ${text(payload.category)}, ${contractorName}, ${text(payload.note)}, ${advance}, ${text(payload.fileUrl)}, ${text(payload.fileId)}, 0, ${text(payload.status)})
  `;
  await recomputeSubcontractorCumulative(projectCode, contractorName);
}

async function recomputeSubcontractorCumulative(projectCode: string, contractorName: string) {
  const sql = getSql();
  const rows = (await sql`
    select id, advance
    from gp_subcontractors
    where project_code = ${projectCode} and lower(contractor_name) = lower(${contractorName})
    order by work_date asc nulls last, id asc
  `) as Row[];

  let cumulative = 0;
  for (const row of rows) {
    cumulative += number(row.advance);
    await sql`update gp_subcontractors set cumulative = ${cumulative}, updated_at = now() where id = ${number(row.id)}`;
  }
}

export async function deleteSubcontractor(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  const [row] = (await sql`select project_code, contractor_name from gp_subcontractors where id = ${id}`) as Row[];
  if (!row) return;
  await sql`delete from gp_subcontractors where id = ${id}`;
  await recomputeSubcontractorCumulative(text(row.project_code), text(row.contractor_name));
}

export async function saveSubcontractorContract(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_subcontractor_contracts
      set project_code = ${text(payload.projectCode)},
          contractor_name = ${text(payload.contractorName)},
          approved_cost = ${money(payload.approvedCost)},
          note = ${text(payload.note)},
          file_url = ${text(payload.fileUrl)},
          file_id = ${text(payload.fileId)},
          status = ${text(payload.status) || "Chờ duyệt"},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_subcontractor_contracts (project_code, contractor_name, approved_cost, note, file_url, file_id, status, updated_at)
    values (${text(payload.projectCode)}, ${text(payload.contractorName)}, ${money(payload.approvedCost)}, ${text(payload.note)}, ${text(payload.fileUrl)}, ${text(payload.fileId)}, ${text(payload.status) || "Chờ duyệt"}, now())
    on conflict (project_code, lower(contractor_name)) do update set
      approved_cost = excluded.approved_cost,
      note = excluded.note,
      file_url = excluded.file_url,
      file_id = excluded.file_id,
      status = excluded.status,
      updated_at = now()
  `;
}

export async function deleteSubcontractorContract(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_subcontractor_contracts where id = ${number(payload.id)}`;
}

export async function approveSubcontractorContract(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`
    update gp_subcontractor_contracts
    set status = 'Đã duyệt', approved_by = ${text(payload.by) || "Admin"}, approved_at = now(), updated_at = now()
    where project_code = ${text(payload.projectCode)} and lower(contractor_name) = lower(${text(payload.contractorName)})
  `;
}

export async function saveOperation(payload: Record<string, unknown>) {
  const sql = getSql();
  const date = dateOnly(payload.date) || dateOnly(new Date());
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_operations
      set work_date = ${date},
          week = ${text(payload.week) || weekFromDate(date)},
          project_code = ${text(payload.projectCode)},
          description = ${text(payload.description)},
          amount = ${money(payload.amount)},
          file_url = ${text(payload.fileUrl)},
          file_id = ${text(payload.fileId)}
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_operations (work_date, week, project_code, description, amount, file_url, file_id)
    values (${date}, ${text(payload.week) || weekFromDate(date)}, ${text(payload.projectCode)}, ${text(payload.description)}, ${money(payload.amount)}, ${text(payload.fileUrl)}, ${text(payload.fileId)})
  `;
}

export async function deleteOperation(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_operations where id = ${number(payload.id)}`;
}

export async function saveMaterialNorm(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  const projectCode = text(payload.projectCode).trim();
  const category = text(payload.category).trim();
  const materialName = text(payload.materialName).trim();
  const unit = text(payload.unit).trim();
  const materialType = text(payload.materialType).trim() || "VT Chính";
  const dailyNorm = requireNumericInput(payload.dailyNorm, "Định mức ngày");
  const weeklyNorm = requireNumericInput(payload.weeklyNorm, "Định mức tuần");
  const warningPercent = requireNumericInput(payload.warningPercent, "Cảnh báo %");

  if (!projectCode) throw new Error("Thiếu công trình.");
  if (!category) throw new Error("Thiếu hạng mục.");
  if (!materialName) throw new Error("Thiếu vật tư.");
  if (!unit) throw new Error("Thiếu đơn vị.");

  if (id > 0) {
    await sql`
      update gp_material_norms
      set project_code = ${projectCode},
          category = ${category},
          material_name = ${materialName},
          unit = ${unit},
          daily_norm = ${dailyNorm},
          weekly_norm = ${weeklyNorm},
          warning_percent = ${warningPercent},
          material_type = ${materialType},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_material_norms (project_code, category, material_name, unit, daily_norm, weekly_norm, warning_percent, material_type, updated_at)
    values (${projectCode}, ${category}, ${materialName}, ${unit}, ${dailyNorm}, ${weeklyNorm}, ${warningPercent}, ${materialType}, now())
    on conflict (project_code, category, lower(material_name), material_type) do update set
      unit = excluded.unit,
      daily_norm = excluded.daily_norm,
      weekly_norm = excluded.weekly_norm,
      warning_percent = excluded.warning_percent,
      updated_at = now()
  `;
}

export async function deleteMaterialNorm(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_material_norms where id = ${number(payload.id)}`;
}

export async function saveLaborNorm(payload: Record<string, unknown>) {
  const sql = getSql();
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
      set project_code = ${projectCode},
          category = ${category},
          workdays = ${workdays},
          cost = ${cost},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_labor_norms (project_code, category, workdays, cost, updated_at)
    values (${projectCode}, ${category}, ${workdays}, ${cost}, now())
    on conflict (project_code, category) do update set
      workdays = excluded.workdays,
      cost = excluded.cost,
      updated_at = now()
  `;
}

export async function deleteLaborNorm(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_labor_norms where id = ${number(payload.id)}`;
}

export async function saveProgress(payload: Record<string, unknown>) {
  const sql = getSql();
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
      set project_code = ${projectCode},
          category = ${category},
          start_date = ${startDate},
          duration_days = ${durationDays},
          workdays = ${workdays},
          plan_end_date = ${planEndDate},
          confirmed_end_date = ${confirmedEndDate},
          evaluation = ${evaluation},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_progress (project_code, category, start_date, duration_days, workdays, plan_end_date, confirmed_end_date, evaluation, updated_at)
    values (${projectCode}, ${category}, ${startDate}, ${durationDays}, ${workdays}, ${planEndDate}, ${confirmedEndDate}, ${evaluation}, now())
    on conflict (project_code, category) do update set
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
  await sql`delete from gp_progress where id = ${number(payload.id)}`;
}

async function ensureDocumentFileColumns() {
  const sql = getSql();

  await sql`alter table gp_documents add column if not exists file_data text not null default ''`;
  await sql`alter table gp_documents add column if not exists file_size bigint not null default 0`;
}

export async function saveDocument(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
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
        set project_code = ${projectCode},
            doc_type = ${docType},
            file_name = ${fileName},
            mime_type = ${mimeType},
            file_id = ${fileId},
            file_url = '',
            file_data = ${fileData},
            file_size = ${fileSize},
            note = ${note},
            preview_text = ${previewText}
        where id = ${id}
      `;
      return id;
    }

    await sql`
      update gp_documents
      set project_code = ${projectCode},
          doc_type = ${docType},
          file_name = ${fileName},
          note = ${note},
          preview_text = ${previewText}
      where id = ${id}
    `;
    return id;
  }

  const rows = (await sql`
    insert into gp_documents (project_code, doc_type, file_name, mime_type, file_id, file_url, note, preview_text)
    values (${projectCode}, ${docType}, ${fileName}, ${mimeType}, ${fileId}, '', ${note}, ${previewText})
    returning id
  `) as Row[];
  const nextId = number(rows[0]?.id);

  await sql`
    update gp_documents
    set file_url = ${`/api/giaphu-erp/documents/${nextId}/file`},
        file_data = ${fileData},
        file_size = ${fileSize}
    where id = ${nextId}
  `;

  return nextId;
}

export async function deleteDocument(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_documents where id = ${number(payload.id)}`;
}

export async function queryDocuments(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
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
    where project_code = ${text(payload.projectCode)}
      and (${text(payload.keyword)} = '' or file_name ilike ${keyword} or doc_type ilike ${keyword} or note ilike ${keyword} or preview_text ilike ${keyword})
    order by created_at desc
    limit 50
  `;
  return rows;
}

export async function getDocumentDetail(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
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
    where id = ${number(payload.id)}
    limit 1
  `) as Row[];

  return rows[0] ?? null;
}

export async function getDocumentFile(payload: Record<string, unknown>) {
  await ensureDocumentFileColumns();
  const sql = getSql();
  const rows = (await sql`
    select id, file_name, mime_type, file_data, file_size
    from gp_documents
    where id = ${number(payload.id)}
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
