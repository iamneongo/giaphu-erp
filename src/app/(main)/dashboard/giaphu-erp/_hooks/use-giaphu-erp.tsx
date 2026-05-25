"use client";

import * as React from "react";

import { toast } from "sonner";

import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  ACTIVE_PROJECT_STORAGE_KEY,
  type ActiveProjectChangeDetail,
  PROJECTS_REFRESH_EVENT,
  readActiveProjectCode,
  writeActiveProjectCode,
} from "@/lib/giaphu-erp/project-context";
import type {
  CostSummary,
  GiaPhuDashboardData,
  MaterialRow,
  OperationRow,
  PaymentRow,
  ProjectRow,
} from "@/lib/giaphu-erp/types";

import {
  fetchGiaPhuData,
  type GiaPhuActionPayload,
  queryGiaPhuDocuments,
  runGiaPhuAction,
} from "../_lib/giaphu-erp-api";

interface GiaPhuErpContextValue {
  data: GiaPhuDashboardData;
  activeProjectCode: string;
  activeProject?: ProjectRow;
  summary: CostSummary;
  setActiveProjectCode: (code: string) => void;
  refresh: () => Promise<void>;
  runAction: (action: string, payload: GiaPhuActionPayload) => Promise<void>;
  searchDocuments: (payload: GiaPhuActionPayload) => Promise<Record<string, unknown>[]>;
  scoped: {
    materials: MaterialRow[];
    attendance: GiaPhuDashboardData["attendance"];
    subcontractors: GiaPhuDashboardData["subcontractors"];
    subcontractorContracts: GiaPhuDashboardData["subcontractorContracts"];
    operations: OperationRow[];
    contracts: GiaPhuDashboardData["contracts"];
    payments: PaymentRow[];
    progress: GiaPhuDashboardData["progress"];
    materialNorms: GiaPhuDashboardData["materialNorms"];
    laborNorms: GiaPhuDashboardData["laborNorms"];
  };
}

const GiaPhuErpContext = React.createContext<GiaPhuErpContextValue | null>(null);

const emptySummary: CostSummary = {
  materialMain: 0,
  materialSub: 0,
  materialMep: 0,
  labor: 0,
  subcontractor: 0,
  operations: 0,
  total: 0,
};

export function GiaPhuErpProvider({
  initialData,
  children,
}: {
  initialData: GiaPhuDashboardData;
  children: React.ReactNode;
}) {
  const [data, setData] = React.useState(initialData);
  const [activeProjectCode, setActiveProjectCode] = React.useState(initialData.projects[0]?.code ?? "");

  const setActiveProject = React.useCallback((code: string) => {
    setActiveProjectCode(code);
    writeActiveProjectCode(code);
  }, []);

  React.useEffect(() => {
    const storedProjectCode = readActiveProjectCode();
    const fallbackProjectCode = initialData.projects[0]?.code ?? "";

    if (storedProjectCode && initialData.projects.some((project) => project.code === storedProjectCode)) {
      setActiveProjectCode(storedProjectCode);
    } else if (fallbackProjectCode) {
      setActiveProject(fallbackProjectCode);
    }
  }, [initialData.projects, setActiveProject]);

  React.useEffect(() => {
    function handleProjectChange(event: Event) {
      const nextCode = (event as CustomEvent<ActiveProjectChangeDetail>).detail?.code;

      if (nextCode) {
        setActiveProjectCode(nextCode);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === ACTIVE_PROJECT_STORAGE_KEY && event.newValue) {
        setActiveProjectCode(event.newValue);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const activeProject = data.projects.find((project) => project.code === activeProjectCode) ?? data.projects[0];
  const normalizedProjectCode = activeProject?.code ?? "";

  const scoped = React.useMemo(
    () => ({
      materials: data.materials.filter((row) => row.projectCode === normalizedProjectCode),
      attendance: data.attendance.filter((row) => row.projectCode === normalizedProjectCode),
      subcontractors: data.subcontractors.filter((row) => row.projectCode === normalizedProjectCode),
      subcontractorContracts: data.subcontractorContracts.filter((row) => row.projectCode === normalizedProjectCode),
      operations: data.operations.filter(
        (row) => row.projectCode === normalizedProjectCode || row.projectCode === "CHUNG DOANH NGHIỆP",
      ),
      contracts: data.contracts.filter((row) => row.projectCode === normalizedProjectCode),
      payments: data.payments.filter((row) => row.projectCode === normalizedProjectCode),
      progress: data.progress.filter((row) => row.projectCode === normalizedProjectCode),
      materialNorms: data.materialNorms.filter((row) => row.projectCode === normalizedProjectCode),
      laborNorms: data.laborNorms.filter((row) => row.projectCode === normalizedProjectCode),
    }),
    [data, normalizedProjectCode],
  );

  const refresh = React.useCallback(async () => {
    const nextData = await fetchGiaPhuData();
    setData(nextData);
    window.dispatchEvent(new Event(PROJECTS_REFRESH_EVENT));

    if (!activeProjectCode && nextData.projects[0]) {
      setActiveProject(nextData.projects[0].code);
    }
  }, [activeProjectCode, setActiveProject]);

  const runAction = React.useCallback(
    async (action: string, payload: GiaPhuActionPayload) => {
      try {
        const result = await runGiaPhuAction(action, payload);

        if (result.data) {
          setData(result.data);
          window.dispatchEvent(new Event(PROJECTS_REFRESH_EVENT));
        } else {
          await refresh();
        }

        toast.success("Đã lưu dữ liệu.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
    [refresh],
  );

  const searchDocuments = React.useCallback(async (payload: GiaPhuActionPayload) => {
    try {
      return await queryGiaPhuDocuments(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return [];
    }
  }, []);

  const value = React.useMemo<GiaPhuErpContextValue>(
    () => ({
      data,
      activeProjectCode: normalizedProjectCode,
      activeProject,
      summary: data.summaries[normalizedProjectCode] ?? emptySummary,
      setActiveProjectCode: setActiveProject,
      refresh,
      runAction,
      searchDocuments,
      scoped,
    }),
    [activeProject, data, normalizedProjectCode, refresh, runAction, scoped, searchDocuments, setActiveProject],
  );

  return <GiaPhuErpContext.Provider value={value}>{children}</GiaPhuErpContext.Provider>;
}

export function useGiaPhuErp() {
  const context = React.useContext(GiaPhuErpContext);

  if (!context) {
    throw new Error("useGiaPhuErp must be used inside GiaPhuErpProvider.");
  }

  return context;
}
