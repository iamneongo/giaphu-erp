"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  ACTIVE_PROJECT_STORAGE_KEY,
  type ActiveProjectChangeDetail,
  PROJECTS_REFRESH_EVENT,
  readActiveProjectCode,
  writeActiveProjectCode,
} from "@/lib/giaphu-erp/project-context";
import { getProjectRouteInfo, switchProjectInPath } from "@/lib/giaphu-erp/project-routes";
import type {
  AttendanceRow,
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
  type GiaPhuActionResult,
  queryGiaPhuDocuments,
  runGiaPhuAction,
} from "../_lib/giaphu-erp-api";

interface GiaPhuErpContextValue {
  data: GiaPhuDashboardData;
  activeProjectCode: string;
  activeProject?: ProjectRow;
  isSwitchingProject: boolean;
  summary: CostSummary;
  setActiveProjectCode: (code: string) => void;
  refresh: () => Promise<void>;
  runAction: (action: string, payload: GiaPhuActionPayload) => Promise<GiaPhuActionResult | false>;
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

type GiaPhuDataPatch = {
  attendanceUpsert?: AttendanceRow[];
  attendanceDeleteIds?: number[];
};

function applyDataPatch(current: GiaPhuDashboardData, patch: GiaPhuDataPatch) {
  if (!patch.attendanceUpsert?.length && !patch.attendanceDeleteIds?.length) return current;

  const deleteIds = new Set(patch.attendanceDeleteIds ?? []);
  const upsertById = new Map((patch.attendanceUpsert ?? []).map((row) => [row.id, row]));
  const laborDiffByProject = new Map<string, number>();
  const addLaborDiff = (projectCode: string, value: number) => {
    laborDiffByProject.set(projectCode, (laborDiffByProject.get(projectCode) ?? 0) + value);
  };

  const attendance = current.attendance
    .filter((row) => {
      if (deleteIds.has(row.id)) {
        addLaborDiff(row.projectCode, -Number(row.total || 0));
        return false;
      }

      const replacement = upsertById.get(row.id);
      if (replacement) {
        addLaborDiff(replacement.projectCode, Number(replacement.total || 0) - Number(row.total || 0));
        upsertById.delete(row.id);
        return false;
      }

      return true;
    })
    .concat(Array.from(upsertById.values()));

  for (const row of upsertById.values()) {
    addLaborDiff(row.projectCode, Number(row.total || 0));
  }

  const summaries = { ...current.summaries };
  for (const [projectCode, laborDiff] of laborDiffByProject) {
    const summary = summaries[projectCode];
    if (!summary) continue;

    summaries[projectCode] = {
      ...summary,
      labor: summary.labor + laborDiff,
      total: summary.total + laborDiff,
    };
  }

  return { ...current, attendance, summaries };
}

export function GiaPhuErpProvider({
  initialData,
  children,
}: {
  initialData: GiaPhuDashboardData;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeProjectId = getProjectRouteInfo(pathname)?.projectId ?? "";
  const routeProject = routeProjectId
    ? initialData.projects.find((project) => project.id === routeProjectId || project.code === routeProjectId)
    : undefined;
  const [data, setData] = React.useState(initialData);
  const [activeProjectCode, setActiveProjectCode] = React.useState(() => {
    if (routeProject) {
      return routeProject.code;
    }

    return initialData.projects[0]?.code ?? "";
  });
  const [isSwitchingProject, setIsSwitchingProject] = React.useState(false);
  const loadProjectData = React.useCallback(async (nextCode: string) => {
    setIsSwitchingProject(true);
    setActiveProjectCode(nextCode);

    try {
      const nextData = await fetchGiaPhuData();
      setData(nextData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSwitchingProject(false);
    }
  }, []);

  const setActiveProject = React.useCallback(
    (code: string) => {
      if (!code || code === activeProjectCode) {
        return;
      }

      const project = data.projects.find((item) => item.code === code);
      writeActiveProjectCode(code, project?.id ?? code);
      router.push(switchProjectInPath(pathname, project?.id ?? code));
    },
    [activeProjectCode, data.projects, pathname, router],
  );

  React.useEffect(() => {
    if (routeProject) {
      writeActiveProjectCode(routeProject.code, routeProject.id);
      setActiveProjectCode((current) => (current === routeProject.code ? current : routeProject.code));
      return;
    }

    const storedProjectCode = readActiveProjectCode();
    const fallbackProjectCode = initialData.projects[0]?.code ?? "";

    if (storedProjectCode && initialData.projects.some((project) => project.code === storedProjectCode)) {
      setActiveProjectCode((current) => (current === storedProjectCode ? current : storedProjectCode));
    } else if (fallbackProjectCode) {
      const fallbackProject = initialData.projects[0];
      writeActiveProjectCode(fallbackProjectCode, fallbackProject?.id ?? fallbackProjectCode);
      setActiveProjectCode((current) => (current === fallbackProjectCode ? current : fallbackProjectCode));
    }
  }, [initialData.projects, routeProject]);

  React.useEffect(() => {
    if (!data.projects.length && pathname !== "/create-project") {
      router.replace("/create-project");
    }
  }, [data.projects.length, pathname, router]);

  React.useEffect(() => {
    if (!data.projects.length) return;
    if (activeProjectCode && data.projects.some((project) => project.code === activeProjectCode)) return;
    setActiveProject(data.projects[0].code);
  }, [activeProjectCode, data.projects, setActiveProject]);

  React.useEffect(() => {
    function handleProjectChange(event: Event) {
      const nextCode = (event as CustomEvent<ActiveProjectChangeDetail>).detail?.code;

      if (nextCode && nextCode !== activeProjectCode) {
        void loadProjectData(nextCode);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === ACTIVE_PROJECT_STORAGE_KEY && event.newValue && event.newValue !== activeProjectCode) {
        void loadProjectData(event.newValue);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [activeProjectCode, loadProjectData]);

  const activeProject = data.projects.find((project) => project.code === activeProjectCode) ?? data.projects[0];
  const normalizedProjectCode = activeProject?.code ?? "";

  const scoped = React.useMemo(
    () => ({
      materials: data.materials.filter((row) => row.projectCode === normalizedProjectCode),
      attendance: data.attendance.filter((row) => row.projectCode === normalizedProjectCode),
      subcontractors: data.subcontractors.filter((row) => row.projectCode === normalizedProjectCode),
      subcontractorContracts: data.subcontractorContracts.filter((row) => row.projectCode === normalizedProjectCode),
      operations: data.operations.filter((row) => row.projectCode === normalizedProjectCode),
      contracts: data.contracts.filter((row) => row.projectCode === normalizedProjectCode),
      payments: data.payments.filter((row) => row.projectCode === normalizedProjectCode),
      progress: data.progress.filter((row) => row.projectCode === normalizedProjectCode),
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
          const patch = result.patch;
          if (patch) {
            setData((current) => applyDataPatch(current, patch));
          } else if (result.refresh !== false) {
            await refresh();
          }
        }

        toast.success("Đã lưu dữ liệu.");
        return result;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
        return false;
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
      isSwitchingProject,
      summary: data.summaries[normalizedProjectCode] ?? emptySummary,
      setActiveProjectCode: setActiveProject,
      refresh,
      runAction,
      searchDocuments,
      scoped,
    }),
    [
      activeProject,
      data,
      isSwitchingProject,
      normalizedProjectCode,
      refresh,
      runAction,
      scoped,
      searchDocuments,
      setActiveProject,
    ],
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
