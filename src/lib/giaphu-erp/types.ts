export type MaterialType = "VT Chính" | "VT Phụ" | "VT MEP" | "VT MEP-HVAC";
export type PaymentStatus = "Chưa TT" | "Đã TT";
export type AttendanceLockStatus = "OPEN" | "CLOSED";
export type GiaPhuPagedDataset =
  | "projects"
  | "catalogs"
  | "staff"
  | "contracts"
  | "payments"
  | "documents"
  | "materials"
  | "attendance"
  | "laborNorms"
  | "progress"
  | "subcontractors"
  | "subcontractorContracts"
  | "operations";

export type MonthlyCostPoint = {
  month: string;
  materials: number;
  labor: number;
  subcontractors: number;
  operations: number;
  cashIn: number;
};

export type BreakdownPoint = {
  key: string;
  label: string;
  value: number;
  rows: number;
  share: number;
};

export type WeeklySnapshot = {
  week: string;
  materials: number;
  labor: number;
  subcontractors: number;
  operations: number;
  total: number;
};

export type CategorySpendPoint = {
  category: string;
  total: number;
  materials: number;
  labor: number;
  subcontractors: number;
  operations: number;
};

export type RecentActivityPoint = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
};

export interface GiaPhuOverviewInsights {
  monthly: MonthlyCostPoint[];
  breakdown: BreakdownPoint[];
  recentActivities: RecentActivityPoint[];
  categorySpend: CategorySpendPoint[];
  headline: {
    contractValue: number;
    collectedCash: number;
    remainingReceivable: number;
    totalCost: number;
    materialMainCost: number;
    materialSubCost: number;
    laborCost: number;
    subcontractorCost: number;
    operationCost: number;
    provisionalProfit: number;
    openMaterialDebt: number;
    activeCategories: number;
    activeWeeks: number;
    costTrend: number;
    cashTrend: number;
  };
}

export interface GiaPhuReportsInsights {
  breakdown: BreakdownPoint[];
  monthly: MonthlyCostPoint[];
  weekly: WeeklySnapshot[];
  categorySpend: CategorySpendPoint[];
  headline: {
    totalCost: number;
    contractValue: number;
    collectedCash: number;
    unpaidMaterials: number;
    materialMainCost: number;
    laborCost: number;
    operationCost: number;
    contractCoverage: number;
    costCoverage: number;
  };
}

export type ErpTableSorting = Array<{ id: string; desc: boolean }>;

export type ReportTableState = {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  sorting?: ErpTableSorting;
  filters?: Record<string, string>;
};

export type ReportTablePayload<T> = {
  rows: T[];
  total: number;
  pageIndex: number;
  pageSize: number;
  filterOptions: Record<string, Array<{ label: string; value: string }>>;
};

export type GiaPhuReportsData = {
  activeProjectCode: string;
  insights: GiaPhuReportsInsights;
  tables: {
    labor: ReportTablePayload<AttendanceRow>;
    materials: ReportTablePayload<MaterialRow>;
    operations: ReportTablePayload<OperationRow>;
  };
};

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  owner: string;
  contact: string;
  referrer: string;
  startDate: string;
  status: string;
  failureReason: string;
}

export interface CatalogItem {
  id: string;
  kind: "hangMuc" | "vatTu" | "vatTuPhu" | "thauPhu" | "nhaCungCap";
  code: string;
  name: string;
  unit: string;
  contact: string;
  note: string;
}

export interface StaffRow {
  id: string;
  name: string;
  team: string;
  position: string;
  salaryDay: number;
  resigned: boolean;
  offDate: string;
}

export interface MaterialRow {
  id: number;
  date: string;
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
  paymentStatus: PaymentStatus;
  paymentInfo: string;
  materialType: MaterialType;
  supplier: string;
}

export interface AttendanceRow {
  id: number;
  date: string;
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
}

export interface SubcontractorRow {
  id: number;
  date: string;
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
}

export interface SubcontractorContractRow {
  id: number;
  projectCode: string;
  contractorName: string;
  approvedCost: number;
  note: string;
  fileUrl: string;
  fileId: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
}

export interface OperationRow {
  id: number;
  date: string;
  week: string;
  projectCode: string;
  description: string;
  amount: number;
  fileUrl: string;
  fileId: string;
}

export interface LaborNormRow {
  id: number;
  projectCode: string;
  category: string;
  workdays: number;
  cost: number;
}

export interface ProgressRow {
  id: number;
  projectCode: string;
  category: string;
  startDate: string;
  durationDays: number;
  workdays: number;
  planEndDate: string;
  confirmedEndDate: string;
  evaluation: string;
}

export interface PaymentRow {
  id: number;
  projectCode: string;
  date: string;
  amount: number;
  note: string;
}

export interface ContractRow {
  id: number;
  projectCode: string;
  contractNo: string;
  value: number;
  signedDate: string;
  note: string;
}

export interface DocumentRow {
  id: number;
  project_code: string;
  doc_type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  note: string;
  preview_text: string;
  has_file: boolean;
}

export interface AttendanceLockRow {
  lockKey: string;
  projectCode: string;
  week: string;
  category: string;
  status: AttendanceLockStatus;
  closedBy: string;
  closedAt: string;
  openedBy: string;
  openedAt: string;
  note: string;
}

export interface CostSummary {
  materialMain: number;
  materialSub: number;
  materialMep: number;
  labor: number;
  subcontractor: number;
  operations: number;
  total: number;
}

export interface GiaPhuDashboardData {
  projects: ProjectRow[];
  catalogs: Record<CatalogItem["kind"], CatalogItem[]>;
  staff: StaffRow[];
  materials: MaterialRow[];
  attendance: AttendanceRow[];
  subcontractors: SubcontractorRow[];
  subcontractorContracts: SubcontractorContractRow[];
  operations: OperationRow[];
  laborNorms: LaborNormRow[];
  progress: ProgressRow[];
  payments: PaymentRow[];
  contracts: ContractRow[];
  attendanceLocks: AttendanceLockRow[];
  summaries: Record<string, CostSummary>;
}
