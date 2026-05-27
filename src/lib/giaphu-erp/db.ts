import { getSql } from "../db/neon";
import type {
  AttendanceLockRow,
  AttendanceRow,
  CatalogItem,
  ContractRow,
  CostSummary,
  GiaPhuDashboardData,
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

type GlobalSchemaState = typeof globalThis & {
  __giaPhuSchemaPromise?: Promise<void>;
  __giaPhuSchemaReady?: boolean;
};

const catalogPrefixes: Record<CatalogItem["kind"], string> = {
  hangMuc: "HM",
  vatTu: "VT",
  vatTuPhu: "VTP",
  thauPhu: "TP",
  nhaCungCap: "NCC",
};

const catalogKinds = Object.keys(catalogPrefixes) as CatalogItem["kind"][];

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

function parseLocalizedNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = text(value).trim();
  if (!raw) return 0;

  const sanitized = raw.replace(/[^\d,.\-]/g, "");
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
      commaCount === 1 && digits.length - lastComma - 1 !== 3
        ? digits.replace(",", ".")
        : digits.replaceAll(",", "");
  } else if (lastDot >= 0) {
    const dotCount = (digits.match(/\./g) ?? []).length;
    normalized =
      dotCount === 1 && digits.length - lastDot - 1 !== 3
        ? digits
        : digits.replaceAll(".", "");
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
    note text not null default '',
    preview_text text not null default '',
    created_at timestamptz not null default now()
  )`;

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
}

export async function createGiaPhuSchema() {
  const state = globalThis as GlobalSchemaState;
  if (state.__giaPhuSchemaReady) {
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
    ? options.activeProjectCode ?? ""
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

export async function manageCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  const kind = text(payload.kind) as CatalogItem["kind"];
  if (!catalogKinds.includes(kind)) throw new Error("Loại danh mục không hợp lệ.");
  const name = text(payload.name).trim();
  if (!name) throw new Error("Thiếu tên danh mục.");
  const code = text(payload.code).trim() || `${catalogPrefixes[kind]}${Date.now().toString().slice(-6)}`;
  const nextId = `${kind}:${code}`;
  const originalId = text(payload.originalId || payload.id);

  if (originalId) {
    await sql`
      update gp_catalog_items
      set id = ${nextId},
          kind = ${kind},
          code = ${code},
          name = ${name},
          unit = ${text(payload.unit)},
          contact = ${text(payload.contact)},
          note = ${text(payload.note)},
          updated_at = now()
      where id = ${originalId}
    `;
    return;
  }

  await sql`
    insert into gp_catalog_items (id, kind, code, name, unit, contact, note, updated_at)
    values (${nextId}, ${kind}, ${code}, ${name}, ${text(payload.unit)}, ${text(payload.contact)}, ${text(payload.note)}, now())
    on conflict (kind, lower(name)) do update set
      code = excluded.code,
      unit = excluded.unit,
      contact = excluded.contact,
      note = excluded.note,
      updated_at = now()
  `;
}

export async function deleteCatalog(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_catalog_items where id = ${text(payload.id)}`;
}

export async function manageStaff(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = text(payload.id).trim() || `NV${Date.now().toString().slice(-6)}`;
  const name = text(payload.name).trim();
  if (!name) throw new Error("Thiếu tên nhân sự.");

  await sql`
    insert into gp_staff (id, name, team, position, salary_day, resigned, off_date, updated_at)
    values (${id}, ${name}, ${text(payload.team)}, ${text(payload.position)}, ${money(payload.salaryDay)}, ${bool(payload.resigned)}, ${dateOnly(payload.offDate) || null}, now())
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

export async function deleteStaff(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_staff where id = ${text(payload.id)}`;
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
  const projectCode = text(payload.projectCode || rows[0]?.projectCode);
  const category = text(payload.category || rows[0]?.category);
  const week = text(payload.week || rows[0]?.week);
  if (!projectCode || !category || !week) throw new Error("Thiếu công trình, hạng mục hoặc tuần.");
  const lockKey = attendanceLockKey(projectCode, week, category);
  const [lock] = (await sql`select status from gp_attendance_locks where lock_key = ${lockKey}`) as Row[];
  if (text(lock?.status) === "CLOSED") throw new Error("Tuần/hạng mục đã kết sổ, không thể sửa chấm công.");

  if (Array.isArray(payload.rows)) {
    await sql`delete from gp_attendance where project_code = ${projectCode} and week = ${week} and category = ${category}`;
  }

  for (const row of rows) {
    const date = dateOnly(row.date) || dateOnly(new Date());
    const halfDaySalary = money(row.halfDaySalary);
    const coefficient = decimal(row.coefficient || 1);
    const allowance = money(row.allowance);
    const overtimeHours = decimal(row.overtimeHours);
    const overtimeAmount = money(row.overtimeAmount);
    const total = money(row.total) || halfDaySalary * coefficient + allowance + overtimeAmount;
    const id = number(row.id);
    if (id > 0) {
      await sql`
        update gp_attendance
        set work_date = ${date},
            week = ${week},
            shift = ${text(row.shift)},
            project_code = ${projectCode},
            category = ${category},
            staff_name = ${text(row.staffName)},
            position = ${text(row.position)},
            half_day_salary = ${halfDaySalary},
            allowance = ${allowance},
            overtime_hours = ${overtimeHours},
            overtime_amount = ${overtimeAmount},
            total = ${total},
            status = ${text(row.status)},
            coefficient = ${coefficient},
            updated_at = now()
        where id = ${id}
      `;
      continue;
    }

    await sql`
      insert into gp_attendance (
        work_date, week, shift, project_code, category, staff_name, position, half_day_salary,
        allowance, overtime_hours, overtime_amount, total, status, coefficient
      )
      values (
        ${date}, ${week}, ${text(row.shift)}, ${projectCode}, ${category}, ${text(row.staffName)}, ${text(row.position)},
        ${halfDaySalary}, ${allowance}, ${overtimeHours}, ${overtimeAmount}, ${total}, ${text(row.status)}, ${coefficient}
      )
    `;
  }
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
  if (id > 0) {
    await sql`
      update gp_material_norms
      set project_code = ${text(payload.projectCode)},
          category = ${text(payload.category)},
          material_name = ${text(payload.materialName)},
          unit = ${text(payload.unit)},
          daily_norm = ${decimal(payload.dailyNorm)},
          weekly_norm = ${decimal(payload.weeklyNorm)},
          warning_percent = ${decimal(payload.warningPercent)},
          material_type = ${text(payload.materialType) || "VT Chính"},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_material_norms (project_code, category, material_name, unit, daily_norm, weekly_norm, warning_percent, material_type, updated_at)
    values (${text(payload.projectCode)}, ${text(payload.category)}, ${text(payload.materialName)}, ${text(payload.unit)}, ${decimal(payload.dailyNorm)}, ${decimal(payload.weeklyNorm)}, ${decimal(payload.warningPercent)}, ${text(payload.materialType) || "VT Chính"}, now())
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
  if (id > 0) {
    await sql`
      update gp_labor_norms
      set project_code = ${text(payload.projectCode)},
          category = ${text(payload.category)},
          workdays = ${decimal(payload.workdays)},
          cost = ${money(payload.cost)},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_labor_norms (project_code, category, workdays, cost, updated_at)
    values (${text(payload.projectCode)}, ${text(payload.category)}, ${decimal(payload.workdays)}, ${money(payload.cost)}, now())
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
  if (id > 0) {
    await sql`
      update gp_progress
      set project_code = ${text(payload.projectCode)},
          category = ${text(payload.category)},
          start_date = ${dateOnly(payload.startDate) || null},
          duration_days = ${Math.round(number(payload.durationDays))},
          workdays = ${decimal(payload.workdays)},
          plan_end_date = ${dateOnly(payload.planEndDate) || null},
          confirmed_end_date = ${dateOnly(payload.confirmedEndDate) || null},
          evaluation = ${text(payload.evaluation)},
          updated_at = now()
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_progress (project_code, category, start_date, duration_days, workdays, plan_end_date, confirmed_end_date, evaluation, updated_at)
    values (${text(payload.projectCode)}, ${text(payload.category)}, ${dateOnly(payload.startDate) || null}, ${Math.round(number(payload.durationDays))}, ${decimal(payload.workdays)}, ${dateOnly(payload.planEndDate) || null}, ${dateOnly(payload.confirmedEndDate) || null}, ${text(payload.evaluation)}, now())
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

export async function saveDocument(payload: Record<string, unknown>) {
  const sql = getSql();
  const id = number(payload.id);
  if (id > 0) {
    await sql`
      update gp_documents
      set project_code = ${text(payload.projectCode)},
          doc_type = ${text(payload.docType)},
          file_name = ${text(payload.fileName)},
          mime_type = ${text(payload.mimeType)},
          file_id = ${text(payload.fileId)},
          file_url = ${text(payload.fileUrl)},
          note = ${text(payload.note)},
          preview_text = ${text(payload.previewText)}
      where id = ${id}
    `;
    return;
  }

  await sql`
    insert into gp_documents (project_code, doc_type, file_name, mime_type, file_id, file_url, note, preview_text)
    values (${text(payload.projectCode)}, ${text(payload.docType)}, ${text(payload.fileName)}, ${text(payload.mimeType)}, ${text(payload.fileId)}, ${text(payload.fileUrl)}, ${text(payload.note)}, ${text(payload.previewText)})
  `;
}

export async function deleteDocument(payload: Record<string, unknown>) {
  const sql = getSql();
  await sql`delete from gp_documents where id = ${number(payload.id)}`;
}

export async function queryDocuments(payload: Record<string, unknown>) {
  const sql = getSql();
  const keyword = `%${text(payload.keyword)}%`;
  const rows = await sql`
    select *
    from gp_documents
    where project_code = ${text(payload.projectCode)}
      and (${text(payload.keyword)} = '' or file_name ilike ${keyword} or doc_type ilike ${keyword} or note ilike ${keyword} or preview_text ilike ${keyword})
    order by created_at desc
    limit 50
  `;
  return rows;
}
