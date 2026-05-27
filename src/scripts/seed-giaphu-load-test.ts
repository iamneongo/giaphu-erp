import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { getSql } from "../lib/db/neon";
import { createGiaPhuSchema } from "../lib/giaphu-erp/db";

const PROJECT_PREFIX = "LOAD26-";
const CATALOG_PREFIX = "L26";
const STAFF_PREFIX = "LOAD26-";
const HOT_PROJECT_CODE = `${PROJECT_PREFIX}001`;

const PROJECT_COUNT = 36;
const HOT_PROJECT_COUNTS = {
  contracts: 120,
  payments: 800,
  documents: 400,
  materials: 12000,
  attendance: 8000,
  subcontractors: 3000,
  subcontractorContracts: 28,
  operations: 2200,
  materialNorms: 320,
  laborNorms: 18,
  progress: 18,
  attendanceLocks: 42,
};
const DEFAULT_PROJECT_COUNTS = {
  contracts: 18,
  payments: 90,
  documents: 32,
  materials: 1200,
  attendance: 700,
  subcontractors: 220,
  subcontractorContracts: 12,
  operations: 140,
  materialNorms: 72,
  laborNorms: 18,
  progress: 18,
  attendanceLocks: 10,
};

type ProjectSeed = {
  code: string;
  name: string;
  owner: string;
  contact: string;
  referrer: string;
  startDate: string;
  status: string;
};

type CatalogSeed = {
  id: string;
  kind: string;
  code: string;
  name: string;
  unit: string;
  contact: string;
  note: string;
};

type StaffSeed = {
  id: string;
  name: string;
  team: string;
  position: string;
  salaryDay: number;
  resigned: boolean;
  offDate: string | null;
};

type ContractSeed = {
  projectCode: string;
  contractNo: string;
  value: number;
  signedDate: string;
  note: string;
};

type PaymentSeed = {
  projectCode: string;
  paymentDate: string;
  amount: number;
  note: string;
};

type DocumentSeed = {
  projectCode: string;
  docType: string;
  fileName: string;
  mimeType: string;
  fileId: string;
  fileUrl: string;
  note: string;
  previewText: string;
};

type MaterialSeed = {
  workDate: string;
  week: string;
  shift: string;
  projectCode: string;
  category: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  price: number;
  debt: string;
  status: string;
  paymentStatus: string;
  paymentInfo: string;
  materialType: string;
  supplier: string;
};

type AttendanceSeed = {
  workDate: string;
  week: string;
  shift: string;
  projectCode: string;
  category: string;
  staffName: string;
  position: string;
  halfDaySalary: number;
  allowance: number;
  overtimeHours: number;
  overtimeAmount: number;
  total: number;
  status: string;
  coefficient: number;
};

type SubcontractorSeed = {
  workDate: string;
  week: string;
  projectCode: string;
  category: string;
  contractorName: string;
  note: string;
  advance: number;
  fileUrl: string;
  fileId: string;
  cumulative: number;
  status: string;
};

type SubcontractorContractSeed = {
  projectCode: string;
  contractorName: string;
  approvedCost: number;
  note: string;
  fileUrl: string;
  fileId: string;
  status: string;
  approvedBy: string;
  approvedAt: string | null;
};

type OperationSeed = {
  workDate: string;
  week: string;
  projectCode: string;
  description: string;
  amount: number;
  fileUrl: string;
  fileId: string;
};

type MaterialNormSeed = {
  projectCode: string;
  category: string;
  materialName: string;
  unit: string;
  dailyNorm: number;
  weeklyNorm: number;
  warningPercent: number;
  materialType: string;
};

type LaborNormSeed = {
  projectCode: string;
  category: string;
  workdays: number;
  cost: number;
};

type ProgressSeed = {
  projectCode: string;
  category: string;
  startDate: string;
  durationDays: number;
  workdays: number;
  planEndDate: string;
  confirmedEndDate: string | null;
  evaluation: string;
};

type AttendanceLockSeed = {
  lockKey: string;
  projectCode: string;
  week: string;
  category: string;
  status: string;
  closedBy: string;
  closedAt: string | null;
  openedBy: string;
  openedAt: string | null;
  note: string;
};

const PROJECT_NAME_PREFIXES = [
  "Nha pho",
  "Biet thu",
  "Can ho",
  "Van phong",
  "Nha xuong",
  "Showroom",
  "Khach san mini",
  "Truong mam non",
  "Kho logistics",
  "Toa nha da nang",
];
const LOCATIONS = [
  "Quan 7",
  "Thu Duc",
  "Binh Thanh",
  "Tan Phu",
  "Da Nang",
  "Bien Hoa",
  "Thu Dau Mot",
  "Nha Trang",
  "Can Tho",
  "Hai Phong",
];
const OWNER_NAMES = [
  "Nguyen Minh Tam",
  "Tran Quoc Bao",
  "Le Hoang Nam",
  "Pham Gia Han",
  "Vo Thanh Tung",
  "Doan Thi Yen",
  "Nguyen Lan Anh",
  "Le Quoc Dat",
  "Bui Thi Thu",
  "Tran Duc Thinh",
  "Pham Bao Chau",
  "Hoang Minh Khoa",
];
const REFERRERS = ["Khach cu gioi thieu", "Zalo OA", "Website", "Facebook", "Doi tac kien truc", "Sales noi bo"];
const PROJECT_STATUSES = ["Đang thi công", "Sắp bàn giao", "Tạm dừng", "Bảo hành"];
const CATEGORY_NAMES = [
  "Mong",
  "Cot tang tret",
  "San tang tret",
  "Cau thang",
  "Tang 1",
  "Tang 2",
  "Tang 3",
  "Mai",
  "MEP am tuong",
  "Hoan thien son nuoc",
  "Lat gach",
  "Tran thach cao",
  "Cua nhom kinh",
  "Phong ngu master",
  "Bep + an",
  "San vuon",
  "Cong rao",
  "Canh quan",
  "Phong tho",
  "WC",
];
const MATERIAL_TYPE_OPTIONS = ["VT Chính", "VT Phụ", "VT MEP", "VT MEP-HVAC"];
const MATERIAL_UNITS = ["bao", "cay", "kg", "m2", "m3", "bo", "cuon"];
const SHIFT_OPTIONS = ["Sang", "Chieu", "Toi"];
const TEAMS = ["Thi cong 1", "Thi cong 2", "Hoan thien", "MEP", "Giam sat", "Van hanh"];
const POSITIONS = ["Tho xay", "Tho sat", "Tho dien", "Tho nuoc", "Giam sat", "Ky su", "To truong"];
const DOCUMENT_TYPES = ["Báo giá", "Hợp đồng", "Bản vẽ", "Nghiệm thu", "Báo cáo ngày", "Phụ lục"];
const SUPPLIER_PREFIXES = ["NCC xi mang", "NCC sat thep", "NCC gach da", "NCC son nuoc", "NCC MEP", "NCC thiet bi"];
const CONTRACTOR_PREFIXES = ["To cop pha", "To sat", "To nhan cong", "To son", "To op lat", "To dien nuoc"];
const FILE_BASE_URL = "https://storage.giaphu.local/load-test";

for (const envFile of [".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number, size = 2) {
  return String(value).padStart(size, "0");
}

function isoDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function weekFromDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${pad(week)}.${utc.getUTCFullYear()}`;
}

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length]!;
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function money(value: number) {
  return Math.round(value);
}

function attendanceLockKey(projectCode: string, week: string, category: string) {
  return [projectCode, week, category || "ALL"].join("::").toLowerCase();
}

function projectVolume(projectCode: string) {
  return projectCode === HOT_PROJECT_CODE ? HOT_PROJECT_COUNTS : DEFAULT_PROJECT_COUNTS;
}

function buildProjects() {
  return range(PROJECT_COUNT).map<ProjectSeed>((index) => {
    const code = `${PROJECT_PREFIX}${pad(index + 1, 3)}`;
    const startDate = isoDate(addDays(new Date(Date.UTC(2024, 0, 15)), index * 9));
    return {
      code,
      name: `${pick(PROJECT_NAME_PREFIXES, index)} ${pick(LOCATIONS, index)} ${index + 1}`,
      owner: pick(OWNER_NAMES, index),
      contact: `09${pad((index * 731) % 100000000, 8)}`,
      referrer: pick(REFERRERS, index),
      startDate,
      status: pick(PROJECT_STATUSES, index),
    };
  });
}

function buildCatalogs() {
  const categories = range(120).map<CatalogSeed>((index) => ({
    id: `hangMuc:${CATALOG_PREFIX}HM${pad(index + 1, 3)}`,
    kind: "hangMuc",
    code: `${CATALOG_PREFIX}HM${pad(index + 1, 3)}`,
    name: `${pick(CATEGORY_NAMES, index)} ${pad(index + 1, 3)}`,
    unit: "hang muc",
    contact: "",
    note: "Danh muc hang muc load test",
  }));
  const materials = range(480).map<CatalogSeed>((index) => ({
    id: `vatTu:${CATALOG_PREFIX}VT${pad(index + 1, 4)}`,
    kind: "vatTu",
    code: `${CATALOG_PREFIX}VT${pad(index + 1, 4)}`,
    name: `Vat tu chinh ${pad(index + 1, 4)}`,
    unit: pick(MATERIAL_UNITS, index),
    contact: "",
    note: "Vat tu chinh load test",
  }));
  const subMaterials = range(220).map<CatalogSeed>((index) => ({
    id: `vatTuPhu:${CATALOG_PREFIX}VP${pad(index + 1, 4)}`,
    kind: "vatTuPhu",
    code: `${CATALOG_PREFIX}VP${pad(index + 1, 4)}`,
    name: `Vat tu phu ${pad(index + 1, 4)}`,
    unit: pick(MATERIAL_UNITS, index + 2),
    contact: "",
    note: "Vat tu phu load test",
  }));
  const contractors = range(140).map<CatalogSeed>((index) => ({
    id: `thauPhu:${CATALOG_PREFIX}TP${pad(index + 1, 3)}`,
    kind: "thauPhu",
    code: `${CATALOG_PREFIX}TP${pad(index + 1, 3)}`,
    name: `${pick(CONTRACTOR_PREFIXES, index)} ${pad(index + 1, 3)}`,
    unit: "doi",
    contact: `098${pad((index * 913) % 10000000, 7)}`,
    note: "Thau phu load test",
  }));
  const suppliers = range(160).map<CatalogSeed>((index) => ({
    id: `nhaCungCap:${CATALOG_PREFIX}NCC${pad(index + 1, 3)}`,
    kind: "nhaCungCap",
    code: `${CATALOG_PREFIX}NCC${pad(index + 1, 3)}`,
    name: `${pick(SUPPLIER_PREFIXES, index)} ${pad(index + 1, 3)}`,
    unit: "",
    contact: `090${pad((index * 577) % 10000000, 7)}`,
    note: "Nha cung cap load test",
  }));
  return {
    all: [...categories, ...materials, ...subMaterials, ...contractors, ...suppliers],
    categories: categories.map((item) => item.name),
    materials: materials.map((item) => ({ code: item.code, name: item.name, unit: item.unit })),
    suppliers: suppliers.map((item) => item.name),
    contractors: contractors.map((item) => item.name),
  };
}

function buildStaff() {
  return range(220).map<StaffSeed>((index) => ({
    id: `${STAFF_PREFIX}NV${pad(index + 1, 4)}`,
    name: `Nhan su ${pad(index + 1, 4)}`,
    team: pick(TEAMS, index),
    position: pick(POSITIONS, index),
    salaryDay: money(380000 + (index % 11) * 25000),
    resigned: false,
    offDate: null,
  }));
}

function buildProjectData(projects: ProjectSeed[], staff: StaffSeed[], catalogs: ReturnType<typeof buildCatalogs>) {
  const contracts: ContractSeed[] = [];
  const payments: PaymentSeed[] = [];
  const documents: DocumentSeed[] = [];
  const materials: MaterialSeed[] = [];
  const attendance: AttendanceSeed[] = [];
  const subcontractors: SubcontractorSeed[] = [];
  const subcontractorContracts: SubcontractorContractSeed[] = [];
  const operations: OperationSeed[] = [];
  const materialNorms: MaterialNormSeed[] = [];
  const laborNorms: LaborNormSeed[] = [];
  const progress: ProgressSeed[] = [];
  const attendanceLocks: AttendanceLockSeed[] = [];

  for (const [projectIndex, project] of projects.entries()) {
    const volume = projectVolume(project.code);
    const rng = createRng(projectIndex + 1001);
    const projectStart = new Date(`${project.startDate}T00:00:00Z`);
    const contractorCount = volume.subcontractorContracts;
    const projectContractors = range(contractorCount).map((index) => pick(catalogs.contractors, projectIndex * 7 + index));
    const projectCategories = range(18).map((index) => pick(catalogs.categories, projectIndex * 5 + index));

    for (const rowIndex of range(volume.contracts)) {
      const signedDate = isoDate(addDays(projectStart, rowIndex * 11));
      contracts.push({
        projectCode: project.code,
        contractNo: `${project.code}-HD-${pad(rowIndex + 1, 4)}`,
        value: money(950_000_000 + rowIndex * 21_500_000 + projectIndex * 15_000_000),
        signedDate,
        note: `Hop dong giai doan ${rowIndex + 1} cho ${project.name}`,
      });
    }

    for (const rowIndex of range(volume.payments)) {
      const paymentDate = isoDate(addDays(projectStart, rowIndex * 3));
      payments.push({
        projectCode: project.code,
        paymentDate,
        amount: money(25_000_000 + (rowIndex % 18) * 6_500_000 + projectIndex * 325_000),
        note: `Thu tien dot ${rowIndex + 1} - ${project.code}`,
      });
    }

    for (const rowIndex of range(volume.documents)) {
      const docType = pick(DOCUMENT_TYPES, rowIndex);
      documents.push({
        projectCode: project.code,
        docType,
        fileName: `${docType.replaceAll(" ", "_").toLowerCase()}_${project.code}_${pad(rowIndex + 1, 4)}.pdf`,
        mimeType: "application/pdf",
        fileId: `${project.code}-DOC-${pad(rowIndex + 1, 5)}`,
        fileUrl: `${FILE_BASE_URL}/${project.code}/documents/${pad(rowIndex + 1, 5)}.pdf`,
        note: `Tai lieu ${docType.toLowerCase()} phuc vu kiem tra tai ${project.code}`,
        previewText: `Tai lieu ${docType} cua ${project.name}, dot ${rowIndex + 1}, noi dung duoc mo phong de test tim kiem va tai du lieu.`,
      });
    }

    for (const rowIndex of range(volume.materials)) {
      const material = pick(catalogs.materials, projectIndex * 17 + rowIndex);
      const workDate = isoDate(addDays(projectStart, rowIndex % 540));
      const quantity = Number((1 + rng() * 39).toFixed(2));
      const priceBase = 85_000 + (rowIndex % 33) * 17_500 + (projectIndex % 8) * 9_000;
      const paymentStatus = rowIndex % 4 === 0 ? "Đã TT" : "Chưa TT";
      materials.push({
        workDate,
        week: weekFromDate(workDate),
        shift: pick(SHIFT_OPTIONS, rowIndex),
        projectCode: project.code,
        category: pick(projectCategories, rowIndex),
        materialCode: material.code,
        materialName: material.name,
        quantity,
        unit: material.unit,
        price: money(priceBase + quantity * 1350),
        debt: rowIndex % 5 === 0 ? "Công nợ 15 ngày" : "",
        status: rowIndex % 3 === 0 ? "Đã nhập kho" : "Chờ đối chiếu",
        paymentStatus,
        paymentInfo: paymentStatus === "Đã TT" ? `Đã TT ${weekFromDate(workDate)}` : "",
        materialType: pick(MATERIAL_TYPE_OPTIONS, rowIndex),
        supplier: pick(catalogs.suppliers, projectIndex * 13 + rowIndex),
      });
    }

    for (const rowIndex of range(volume.attendance)) {
      const staffRow = pick(staff, projectIndex * 19 + rowIndex);
      const workDate = isoDate(addDays(projectStart, rowIndex % 520));
      const coefficient = Number((0.5 + (rowIndex % 4) * 0.5).toFixed(1));
      const allowance = money((rowIndex % 6) * 75_000);
      const overtimeHours = Number((rowIndex % 5 === 0 ? 2.5 : rowIndex % 3 === 0 ? 1 : 0).toFixed(1));
      const overtimeAmount = money(overtimeHours * 95_000);
      const halfDaySalary = money(staffRow.salaryDay / 2);
      const total = money(halfDaySalary * coefficient + allowance + overtimeAmount);
      attendance.push({
        workDate,
        week: weekFromDate(workDate),
        shift: pick(SHIFT_OPTIONS, rowIndex + 1),
        projectCode: project.code,
        category: pick(projectCategories, rowIndex + 2),
        staffName: staffRow.name,
        position: staffRow.position,
        halfDaySalary,
        allowance,
        overtimeHours,
        overtimeAmount,
        total,
        status: rowIndex % 4 === 0 ? "Đối chiếu" : "Hợp lệ",
        coefficient,
      });
    }

    for (const contractorName of projectContractors) {
      subcontractorContracts.push({
        projectCode: project.code,
        contractorName,
        approvedCost: money(180_000_000 + rng() * 620_000_000),
        note: `Han muc giao khoan cho ${contractorName} tai ${project.code}`,
        fileUrl: "",
        fileId: "",
        status: rng() > 0.18 ? "Đã duyệt" : "Chờ duyệt",
        approvedBy: rng() > 0.18 ? "nttantts@gmail.com" : "",
        approvedAt: rng() > 0.18 ? `${isoDate(addDays(projectStart, Math.floor(rng() * 240)))}T09:00:00.000Z` : null,
      });
    }

    const cumulativeByContractor = new Map<string, number>();
    for (const rowIndex of range(volume.subcontractors)) {
      const contractorName = pick(projectContractors, rowIndex);
      const workDate = isoDate(addDays(projectStart, rowIndex % 500));
      const advance = money(8_000_000 + rng() * 54_000_000);
      const cumulative = (cumulativeByContractor.get(contractorName) ?? 0) + advance;
      cumulativeByContractor.set(contractorName, cumulative);
      subcontractors.push({
        workDate,
        week: weekFromDate(workDate),
        projectCode: project.code,
        category: pick(projectCategories, rowIndex + 5),
        contractorName,
        note: `Tam ung dot ${rowIndex + 1} cho ${contractorName}`,
        advance,
        fileUrl: "",
        fileId: "",
        cumulative,
        status: rowIndex % 5 === 0 ? "Chờ đối chiếu" : "Hợp lệ",
      });
    }

    for (const rowIndex of range(volume.operations)) {
      const workDate = isoDate(addDays(projectStart, rowIndex % 540));
      operations.push({
        workDate,
        week: weekFromDate(workDate),
        projectCode: project.code,
        description: `Chi phi van hanh ${rowIndex + 1} - may moc, van chuyen, bao ho`,
        amount: money(1_200_000 + rng() * 22_000_000),
        fileUrl: "",
        fileId: "",
      });
    }

    for (const rowIndex of range(volume.materialNorms)) {
      const material = pick(catalogs.materials, projectIndex * 29 + rowIndex);
      const dailyNorm = Number((1 + rng() * 11).toFixed(2));
      materialNorms.push({
        projectCode: project.code,
        category: pick(projectCategories, rowIndex),
        materialName: material.name,
        unit: material.unit,
        dailyNorm,
        weeklyNorm: Number((dailyNorm * (5 + (rowIndex % 3))).toFixed(2)),
        warningPercent: 5 + (rowIndex % 4) * 5,
        materialType: pick(MATERIAL_TYPE_OPTIONS, rowIndex),
      });
    }

    for (const rowIndex of range(volume.laborNorms)) {
      const workdays = Number((2 + rng() * 18).toFixed(1));
      laborNorms.push({
        projectCode: project.code,
        category: pick(projectCategories, rowIndex),
        workdays,
        cost: money(workdays * (650_000 + (rowIndex % 6) * 120_000)),
      });
    }

    for (const rowIndex of range(volume.progress)) {
      const startDate = isoDate(addDays(projectStart, rowIndex * 4));
      const durationDays = 8 + (rowIndex % 11) * 4;
      const planEndDate = isoDate(addDays(new Date(`${startDate}T00:00:00Z`), durationDays));
      progress.push({
        projectCode: project.code,
        category: pick(projectCategories, rowIndex),
        startDate,
        durationDays,
        workdays: Number((3 + rng() * 26).toFixed(1)),
        planEndDate,
        confirmedEndDate: rowIndex % 4 === 0 ? isoDate(addDays(new Date(`${planEndDate}T00:00:00Z`), rowIndex % 3)) : null,
        evaluation: rowIndex % 5 === 0 ? "Cần bổ sung nhân lực" : "Đạt tiến độ",
      });
    }

    const uniqueWeeks = new Set<string>();
    for (let rowIndex = 0; rowIndex < volume.attendanceLocks; rowIndex += 1) {
      const week = weekFromDate(isoDate(addDays(projectStart, rowIndex * 7)));
      const category = pick(projectCategories, rowIndex);
      const uniqueKey = `${week}-${category}`;
      if (uniqueWeeks.has(uniqueKey)) {
        continue;
      }
      uniqueWeeks.add(uniqueKey);
      attendanceLocks.push({
        lockKey: attendanceLockKey(project.code, week, category),
        projectCode: project.code,
        week,
        category,
        status: rowIndex % 4 === 0 ? "CLOSED" : "OPEN",
        closedBy: rowIndex % 4 === 0 ? "nttantts@gmail.com" : "",
        closedAt: rowIndex % 4 === 0 ? `${isoDate(addDays(projectStart, rowIndex * 7))}T17:30:00.000Z` : null,
        openedBy: "",
        openedAt: null,
        note: rowIndex % 4 === 0 ? "Khóa để đối chiếu cuối tuần" : "",
      });
    }
  }

  return {
    contracts,
    payments,
    documents,
    materials,
    attendance,
    subcontractors,
    subcontractorContracts,
    operations,
    materialNorms,
    laborNorms,
    progress,
    attendanceLocks,
  };
}

async function insertProjects(projects: ProjectSeed[]) {
  const sql = getSql();
  await sql.query(
    `
      insert into gp_projects (code, name, owner, contact, referrer, start_date, status, failure_reason, updated_at)
      select * from unnest(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::text[],
        $6::date[],
        $7::text[],
        $8::text[],
        $9::timestamptz[]
      )
    `,
    [
      projects.map((row) => row.code),
      projects.map((row) => row.name),
      projects.map((row) => row.owner),
      projects.map((row) => row.contact),
      projects.map((row) => row.referrer),
      projects.map((row) => row.startDate),
      projects.map((row) => row.status),
      projects.map(() => ""),
      projects.map(() => new Date().toISOString()),
    ],
  );
}

async function insertCatalogs(catalogs: CatalogSeed[]) {
  const sql = getSql();
  await sql.query(
    `
      insert into gp_catalog_items (id, kind, code, name, unit, contact, note, updated_at)
      select * from unnest(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::text[],
        $6::text[],
        $7::text[],
        $8::timestamptz[]
      )
    `,
    [
      catalogs.map((row) => row.id),
      catalogs.map((row) => row.kind),
      catalogs.map((row) => row.code),
      catalogs.map((row) => row.name),
      catalogs.map((row) => row.unit),
      catalogs.map((row) => row.contact),
      catalogs.map((row) => row.note),
      catalogs.map(() => new Date().toISOString()),
    ],
  );
}

async function insertStaff(staff: StaffSeed[]) {
  const sql = getSql();
  await sql.query(
    `
      insert into gp_staff (id, name, team, position, salary_day, resigned, off_date, updated_at)
      select * from unnest(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::numeric[],
        $6::boolean[],
        $7::date[],
        $8::timestamptz[]
      )
    `,
    [
      staff.map((row) => row.id),
      staff.map((row) => row.name),
      staff.map((row) => row.team),
      staff.map((row) => row.position),
      staff.map((row) => row.salaryDay),
      staff.map((row) => row.resigned),
      staff.map((row) => row.offDate),
      staff.map(() => new Date().toISOString()),
    ],
  );
}

async function insertContracts(rows: ContractSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 3000)) {
    await sql.query(
      `
        insert into gp_contracts (project_code, contract_no, value, signed_date, note)
        select * from unnest($1::text[], $2::text[], $3::numeric[], $4::date[], $5::text[])
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.contractNo),
        batch.map((row) => row.value),
        batch.map((row) => row.signedDate),
        batch.map((row) => row.note),
      ],
    );
  }
}

async function insertPayments(rows: PaymentSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 5000)) {
    await sql.query(
      `
        insert into gp_payments (project_code, payment_date, amount, note)
        select * from unnest($1::text[], $2::date[], $3::numeric[], $4::text[])
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.paymentDate),
        batch.map((row) => row.amount),
        batch.map((row) => row.note),
      ],
    );
  }
}

async function insertDocuments(rows: DocumentSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 3000)) {
    await sql.query(
      `
        insert into gp_documents (project_code, doc_type, file_name, mime_type, file_id, file_url, note, preview_text)
        select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.docType),
        batch.map((row) => row.fileName),
        batch.map((row) => row.mimeType),
        batch.map((row) => row.fileId),
        batch.map((row) => row.fileUrl),
        batch.map((row) => row.note),
        batch.map((row) => row.previewText),
      ],
    );
  }
}

async function insertMaterials(rows: MaterialSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 4000)) {
    await sql.query(
      `
        insert into gp_materials (
          work_date, week, shift, project_code, category, material_code, material_name, quantity, unit, price,
          debt, status, payment_status, payment_info, material_type, supplier
        )
        select * from unnest(
          $1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::numeric[],
          $9::text[], $10::numeric[], $11::text[], $12::text[], $13::text[], $14::text[], $15::text[], $16::text[]
        )
      `,
      [
        batch.map((row) => row.workDate),
        batch.map((row) => row.week),
        batch.map((row) => row.shift),
        batch.map((row) => row.projectCode),
        batch.map((row) => row.category),
        batch.map((row) => row.materialCode),
        batch.map((row) => row.materialName),
        batch.map((row) => row.quantity),
        batch.map((row) => row.unit),
        batch.map((row) => row.price),
        batch.map((row) => row.debt),
        batch.map((row) => row.status),
        batch.map((row) => row.paymentStatus),
        batch.map((row) => row.paymentInfo),
        batch.map((row) => row.materialType),
        batch.map((row) => row.supplier),
      ],
    );
  }
}

async function insertAttendance(rows: AttendanceSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 4000)) {
    await sql.query(
      `
        insert into gp_attendance (
          work_date, week, shift, project_code, category, staff_name, position, half_day_salary,
          allowance, overtime_hours, overtime_amount, total, status, coefficient
        )
        select * from unnest(
          $1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
          $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[], $13::text[], $14::numeric[]
        )
      `,
      [
        batch.map((row) => row.workDate),
        batch.map((row) => row.week),
        batch.map((row) => row.shift),
        batch.map((row) => row.projectCode),
        batch.map((row) => row.category),
        batch.map((row) => row.staffName),
        batch.map((row) => row.position),
        batch.map((row) => row.halfDaySalary),
        batch.map((row) => row.allowance),
        batch.map((row) => row.overtimeHours),
        batch.map((row) => row.overtimeAmount),
        batch.map((row) => row.total),
        batch.map((row) => row.status),
        batch.map((row) => row.coefficient),
      ],
    );
  }
}

async function insertSubcontractors(rows: SubcontractorSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 3000)) {
    await sql.query(
      `
        insert into gp_subcontractors (
          work_date, week, project_code, category, contractor_name, note, advance, file_url, file_id, cumulative, status
        )
        select * from unnest(
          $1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::numeric[], $8::text[], $9::text[], $10::numeric[], $11::text[]
        )
      `,
      [
        batch.map((row) => row.workDate),
        batch.map((row) => row.week),
        batch.map((row) => row.projectCode),
        batch.map((row) => row.category),
        batch.map((row) => row.contractorName),
        batch.map((row) => row.note),
        batch.map((row) => row.advance),
        batch.map((row) => row.fileUrl),
        batch.map((row) => row.fileId),
        batch.map((row) => row.cumulative),
        batch.map((row) => row.status),
      ],
    );
  }
}

async function insertSubcontractorContracts(rows: SubcontractorContractSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 2000)) {
    await sql.query(
      `
        insert into gp_subcontractor_contracts (
          project_code, contractor_name, approved_cost, note, file_url, file_id, status, approved_by, approved_at, updated_at
        )
        select * from unnest(
          $1::text[], $2::text[], $3::numeric[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::timestamptz[], $10::timestamptz[]
        )
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.contractorName),
        batch.map((row) => row.approvedCost),
        batch.map((row) => row.note),
        batch.map((row) => row.fileUrl),
        batch.map((row) => row.fileId),
        batch.map((row) => row.status),
        batch.map((row) => row.approvedBy),
        batch.map((row) => row.approvedAt),
        batch.map(() => new Date().toISOString()),
      ],
    );
  }
}

async function insertOperations(rows: OperationSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 4000)) {
    await sql.query(
      `
        insert into gp_operations (work_date, week, project_code, description, amount, file_url, file_id)
        select * from unnest($1::date[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::text[])
      `,
      [
        batch.map((row) => row.workDate),
        batch.map((row) => row.week),
        batch.map((row) => row.projectCode),
        batch.map((row) => row.description),
        batch.map((row) => row.amount),
        batch.map((row) => row.fileUrl),
        batch.map((row) => row.fileId),
      ],
    );
  }
}

async function insertMaterialNorms(rows: MaterialNormSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 3000)) {
    await sql.query(
      `
        insert into gp_material_norms (
          project_code, category, material_name, unit, daily_norm, weekly_norm, warning_percent, material_type, updated_at
        )
        select * from unnest(
          $1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::numeric[], $8::text[], $9::timestamptz[]
        )
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.category),
        batch.map((row) => row.materialName),
        batch.map((row) => row.unit),
        batch.map((row) => row.dailyNorm),
        batch.map((row) => row.weeklyNorm),
        batch.map((row) => row.warningPercent),
        batch.map((row) => row.materialType),
        batch.map(() => new Date().toISOString()),
      ],
    );
  }
}

async function insertLaborNorms(rows: LaborNormSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 3000)) {
    await sql.query(
      `
        insert into gp_labor_norms (project_code, category, workdays, cost, updated_at)
        select * from unnest($1::text[], $2::text[], $3::numeric[], $4::numeric[], $5::timestamptz[])
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.category),
        batch.map((row) => row.workdays),
        batch.map((row) => row.cost),
        batch.map(() => new Date().toISOString()),
      ],
    );
  }
}

async function insertProgress(rows: ProgressSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 3000)) {
    await sql.query(
      `
        insert into gp_progress (
          project_code, category, start_date, duration_days, workdays, plan_end_date, confirmed_end_date, evaluation, updated_at
        )
        select * from unnest(
          $1::text[], $2::text[], $3::date[], $4::int[], $5::numeric[], $6::date[], $7::date[], $8::text[], $9::timestamptz[]
        )
      `,
      [
        batch.map((row) => row.projectCode),
        batch.map((row) => row.category),
        batch.map((row) => row.startDate),
        batch.map((row) => row.durationDays),
        batch.map((row) => row.workdays),
        batch.map((row) => row.planEndDate),
        batch.map((row) => row.confirmedEndDate),
        batch.map((row) => row.evaluation),
        batch.map(() => new Date().toISOString()),
      ],
    );
  }
}

async function insertAttendanceLocks(rows: AttendanceLockSeed[]) {
  const sql = getSql();
  for (const batch of chunk(rows, 2000)) {
    await sql.query(
      `
        insert into gp_attendance_locks (
          lock_key, project_code, week, category, status, closed_by, closed_at, opened_by, opened_at, note, updated_at
        )
        select * from unnest(
          $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[], $8::text[], $9::timestamptz[], $10::text[], $11::timestamptz[]
        )
      `,
      [
        batch.map((row) => row.lockKey),
        batch.map((row) => row.projectCode),
        batch.map((row) => row.week),
        batch.map((row) => row.category),
        batch.map((row) => row.status),
        batch.map((row) => row.closedBy),
        batch.map((row) => row.closedAt),
        batch.map((row) => row.openedBy),
        batch.map((row) => row.openedAt),
        batch.map((row) => row.note),
        batch.map(() => new Date().toISOString()),
      ],
    );
  }
}

async function cleanupExistingSeed() {
  const sql = getSql();
  await sql`delete from gp_attendance_locks where project_code like ${`${PROJECT_PREFIX}%`}`;
  await sql`delete from gp_operations where project_code like ${`${PROJECT_PREFIX}%`}`;
  await sql`delete from gp_projects where code like ${`${PROJECT_PREFIX}%`}`;
  await sql`delete from gp_staff where id like ${`${STAFF_PREFIX}%`}`;
  await sql`delete from gp_catalog_items where code like ${`${CATALOG_PREFIX}%`}`;
}

async function summarize() {
  const sql = getSql();
  const [summary] = (await sql.query(
    `
      select
        (select count(*) from gp_projects where code like $1) as projects,
        (select count(*) from gp_catalog_items where code like $2) as catalogs,
        (select count(*) from gp_staff where id like $3) as staff,
        (select count(*) from gp_materials where project_code like $1) as materials,
        (select count(*) from gp_attendance where project_code like $1) as attendance,
        (select count(*) from gp_subcontractors where project_code like $1) as subcontractors,
        (select count(*) from gp_operations where project_code like $1) as operations,
        (select count(*) from gp_payments where project_code like $1) as payments,
        (select count(*) from gp_contracts where project_code like $1) as contracts,
        (select count(*) from gp_documents where project_code like $1) as documents
    `,
    [`${PROJECT_PREFIX}%`, `${CATALOG_PREFIX}%`, `${STAFF_PREFIX}%`],
  )) as Array<Record<string, string>>;
  return summary;
}

async function main() {
  console.time("seed-load-test");
  await createGiaPhuSchema();
  await cleanupExistingSeed();

  const projects = buildProjects();
  const catalogs = buildCatalogs();
  const staff = buildStaff();
  const projectData = buildProjectData(projects, staff, catalogs);

  await insertCatalogs(catalogs.all);
  await insertStaff(staff);
  await insertProjects(projects);
  await insertContracts(projectData.contracts);
  await insertPayments(projectData.payments);
  await insertDocuments(projectData.documents);
  await insertMaterials(projectData.materials);
  await insertAttendance(projectData.attendance);
  await insertSubcontractorContracts(projectData.subcontractorContracts);
  await insertSubcontractors(projectData.subcontractors);
  await insertOperations(projectData.operations);
  await insertMaterialNorms(projectData.materialNorms);
  await insertLaborNorms(projectData.laborNorms);
  await insertProgress(projectData.progress);
  await insertAttendanceLocks(projectData.attendanceLocks);

  const summary = await summarize();
  console.timeEnd("seed-load-test");
  console.log("Load test seed inserted successfully.");
  console.log(`Hot project for testing: ${HOT_PROJECT_CODE}`);
  console.table(summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
