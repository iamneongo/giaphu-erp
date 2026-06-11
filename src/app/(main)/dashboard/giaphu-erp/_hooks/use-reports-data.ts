"use client";

import * as React from "react";

import type {
  AttendanceRow,
  GiaPhuReportsData,
  MaterialRow,
  OperationRow,
  ReportTablePayload,
  ReportTableState,
} from "@/lib/giaphu-erp/types";

import type { DataTableServerSideOptions, DataTableServerState } from "../_components/data-table";
import { fetchGiaPhuReportsData } from "../_lib/giaphu-erp-api";

type ReportTableKey = "labor" | "materials" | "operations";

const reportTableKeys = ["labor", "materials", "operations"] as const satisfies readonly ReportTableKey[];

const defaultTableState: Required<ReportTableState> = {
  pageIndex: 0,
  pageSize: 10,
  search: "",
  sorting: [],
  filters: {},
};

function toReportTableState(state: DataTableServerState): Required<ReportTableState> {
  return {
    pageIndex: state.pageIndex,
    pageSize: state.pageSize,
    search: state.query,
    sorting: state.sorting,
    filters: state.filters,
  };
}

function sameReportState(left: Required<ReportTableState>, right: Required<ReportTableState>) {
  return (
    left.pageIndex === right.pageIndex &&
    left.pageSize === right.pageSize &&
    left.search === right.search &&
    JSON.stringify(left.sorting) === JSON.stringify(right.sorting) &&
    JSON.stringify(left.filters) === JSON.stringify(right.filters)
  );
}

function emptyTable<T>(): ReportTablePayload<T> {
  return {
    rows: [],
    total: 0,
    pageIndex: 0,
    pageSize: 10,
    filterOptions: {},
  };
}

function getEmptyTableLoadingState() {
  return {
    labor: false,
    materials: false,
    operations: false,
  } satisfies Record<ReportTableKey, boolean>;
}

function emptyReportsData(projectCode: string): GiaPhuReportsData {
  return {
    activeProjectCode: projectCode,
    insights: {
      breakdown: [],
      monthly: [],
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
    },
    tables: {
      labor: emptyTable<AttendanceRow>(),
      materials: emptyTable<MaterialRow>(),
      operations: emptyTable<OperationRow>(),
    },
  };
}

export function useReportsData(projectCode: string) {
  const [data, setData] = React.useState<GiaPhuReportsData>(() => emptyReportsData(projectCode));
  const [loading, setLoading] = React.useState(Boolean(projectCode));
  const [tableLoading, setTableLoading] = React.useState<Record<ReportTableKey, boolean>>(getEmptyTableLoadingState);
  const [exportingTable, setExportingTable] = React.useState<ReportTableKey | null>(null);
  const [states, setStates] = React.useState<Record<ReportTableKey, Required<ReportTableState>>>({
    labor: defaultTableState,
    materials: defaultTableState,
    operations: defaultTableState,
  });
  const previousRequestRef = React.useRef<{
    projectCode: string;
    states: Record<ReportTableKey, Required<ReportTableState>>;
  } | null>(null);

  React.useEffect(() => {
    setData(emptyReportsData(projectCode));
    setLoading(Boolean(projectCode));
    setTableLoading(getEmptyTableLoadingState());
    previousRequestRef.current = null;
    setStates({
      labor: defaultTableState,
      materials: defaultTableState,
      operations: defaultTableState,
    });
  }, [projectCode]);

  React.useEffect(() => {
    if (!projectCode) {
      setData(emptyReportsData(""));
      setLoading(false);
      setTableLoading(getEmptyTableLoadingState());
      previousRequestRef.current = null;
      return;
    }

    const controller = new AbortController();
    const previousRequest = previousRequestRef.current;
    const isInitialProjectLoad = !previousRequest || previousRequest.projectCode !== projectCode;
    const loadingKeys = isInitialProjectLoad
      ? reportTableKeys
      : reportTableKeys.filter((key) => !sameReportState(previousRequest.states[key], states[key]));

    previousRequestRef.current = { projectCode, states };
    setLoading(isInitialProjectLoad);
    setTableLoading((current) => {
      const nextLoading = { ...current };

      for (const key of loadingKeys) {
        nextLoading[key] = true;
      }

      return nextLoading;
    });

    fetchGiaPhuReportsData({
      projectCode,
      tables: states,
      signal: controller.signal,
    })
      .then((nextData) => {
        if (!controller.signal.aborted) setData(nextData);
      })
      .catch(() => {
        if (!controller.signal.aborted) setData(emptyReportsData(projectCode));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setTableLoading((current) => {
            const nextLoading = { ...current };

            for (const key of loadingKeys) {
              nextLoading[key] = false;
            }

            return nextLoading;
          });
        }
      });

    return () => controller.abort();
  }, [projectCode, states]);

  const setTableState = React.useCallback((key: ReportTableKey, nextState: DataTableServerState) => {
    const reportState = toReportTableState(nextState);
    setStates((current) => {
      if (sameReportState(current[key], reportState)) return current;
      return { ...current, [key]: reportState };
    });
  }, []);

  const getExportRows = React.useCallback(
    async <T>(key: ReportTableKey, nextState: DataTableServerState, total: number) => {
      if (!projectCode) return [];

      const reportState = toReportTableState(nextState);
      const exportState = {
        ...reportState,
        pageIndex: 0,
        pageSize: Math.max(reportState.pageSize, total, 1),
      };
      const tables = { [key]: exportState };

      setExportingTable(key);
      try {
        const exportData = await fetchGiaPhuReportsData({ projectCode, tables });
        return exportData.tables[key].rows as T[];
      } finally {
        setExportingTable((current) => (current === key ? null : current));
      }
    },
    [projectCode],
  );

  const laborServerSide = React.useMemo<DataTableServerSideOptions>(
    () => ({
      rowCount: data.tables.labor.total,
      loading: tableLoading.labor,
      exportLoading: exportingTable === "labor",
      filterOptions: data.tables.labor.filterOptions,
      onStateChange: (nextState) => setTableState("labor", nextState),
      getExportRows: (nextState) => getExportRows<AttendanceRow>("labor", nextState, data.tables.labor.total),
    }),
    [
      data.tables.labor.filterOptions,
      data.tables.labor.total,
      exportingTable,
      getExportRows,
      setTableState,
      tableLoading.labor,
    ],
  );
  const materialsServerSide = React.useMemo<DataTableServerSideOptions>(
    () => ({
      rowCount: data.tables.materials.total,
      loading: tableLoading.materials,
      exportLoading: exportingTable === "materials",
      filterOptions: data.tables.materials.filterOptions,
      onStateChange: (nextState) => setTableState("materials", nextState),
      getExportRows: (nextState) => getExportRows<MaterialRow>("materials", nextState, data.tables.materials.total),
    }),
    [
      data.tables.materials.filterOptions,
      data.tables.materials.total,
      exportingTable,
      getExportRows,
      setTableState,
      tableLoading.materials,
    ],
  );
  const operationsServerSide = React.useMemo<DataTableServerSideOptions>(
    () => ({
      rowCount: data.tables.operations.total,
      loading: tableLoading.operations,
      exportLoading: exportingTable === "operations",
      filterOptions: data.tables.operations.filterOptions,
      onStateChange: (nextState) => setTableState("operations", nextState),
      getExportRows: (nextState) => getExportRows<OperationRow>("operations", nextState, data.tables.operations.total),
    }),
    [
      data.tables.operations.filterOptions,
      data.tables.operations.total,
      exportingTable,
      getExportRows,
      setTableState,
      tableLoading.operations,
    ],
  );

  return {
    data,
    loading,
    laborServerSide,
    materialsServerSide,
    operationsServerSide,
  };
}
