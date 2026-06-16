"use client";

import * as React from "react";

import type { GiaPhuPagedDataset } from "@/lib/giaphu-erp/types";

import type { DataTableServerState } from "../_components/data-table";
import { fetchGiaPhuFilterOptions, fetchGiaPhuPagedRows } from "../_lib/giaphu-erp-api";

const projectScopedDatasets = new Set<GiaPhuPagedDataset>([
  "contracts",
  "payments",
  "documents",
  "materials",
  "attendance",
  "laborNorms",
  "progress",
  "subcontractors",
  "subcontractorContracts",
  "operations",
]);
const emptyFixedFilters: Record<string, string> = {};

function hasObjectValues(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

export function usePaginatedErpRows<T>({
  dataset,
  projectCode,
  initialRows,
  initialPageSize = 10,
  fixedFilters = emptyFixedFilters,
  enabled = true,
}: {
  dataset: GiaPhuPagedDataset;
  projectCode: string;
  initialRows: T[];
  initialPageSize?: number;
  fixedFilters?: Record<string, string>;
  enabled?: boolean;
}) {
  const [rows, setRows] = React.useState<T[]>(initialRows);
  const [total, setTotal] = React.useState(initialRows.length);
  const [loading, setLoading] = React.useState(false);
  const [exportLoading, setExportLoading] = React.useState(false);
  const [filterOptionsLoading, setFilterOptionsLoading] = React.useState(false);
  const [filterOptions, setFilterOptions] = React.useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [state, setState] = React.useState<DataTableServerState>({
    pageIndex: 0,
    pageSize: initialPageSize,
    query: "",
    sorting: [],
    filters: {},
  });
  const initialRowsRef = React.useRef(initialRows);
  const filterOptionsScopeKey = React.useMemo(
    () => JSON.stringify({ dataset, fixedFilters, projectCode }),
    [dataset, fixedFilters, projectCode],
  );
  const previousFilterOptionsScopeKey = React.useRef(filterOptionsScopeKey);
  const rowsScopeKey = React.useMemo(
    () => JSON.stringify({ dataset, enabled, fixedFilters, projectCode }),
    [dataset, enabled, fixedFilters, projectCode],
  );
  const previousRowsScopeKey = React.useRef(rowsScopeKey);
  const filterOptionsLoaded = hasObjectValues(filterOptions);

  const clearFilterOptions = React.useCallback(() => {
    setFilterOptions((current) => (hasObjectValues(current) ? {} : current));
  }, []);

  React.useEffect(() => {
    initialRowsRef.current = initialRows;
  }, [initialRows]);

  React.useEffect(() => {
    if (previousRowsScopeKey.current === rowsScopeKey) return;

    previousRowsScopeKey.current = rowsScopeKey;
    setRows(initialRows);
    setTotal(initialRows.length);
    setState((current) => (current.pageIndex ? { ...current, pageIndex: 0 } : current));
  }, [initialRows, rowsScopeKey]);

  React.useEffect(() => {
    if (previousFilterOptionsScopeKey.current === filterOptionsScopeKey) return;

    previousFilterOptionsScopeKey.current = filterOptionsScopeKey;
    clearFilterOptions();
    setFilterOptionsLoading((current) => (current ? false : current));
  }, [clearFilterOptions, filterOptionsScopeKey]);

  const loadFilterOptions = React.useCallback(() => {
    if (!enabled) {
      clearFilterOptions();
      return undefined;
    }

    if (projectScopedDatasets.has(dataset) && !projectCode) {
      clearFilterOptions();
      return undefined;
    }

    if (filterOptionsLoaded || filterOptionsLoading) {
      return undefined;
    }

    const requestRefreshToken = refreshToken;
    const controller = new AbortController();
    setFilterOptionsLoading(true);

    fetchGiaPhuFilterOptions({
      dataset,
      projectCode,
      filters: fixedFilters,
      signal: controller.signal,
    })
      .then((options) => {
        if (controller.signal.aborted || requestRefreshToken < 0) return;
        setFilterOptions(options);
      })
      .catch(() => {
        if (!controller.signal.aborted) clearFilterOptions();
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilterOptionsLoading((current) => (current ? false : current));
      });

    return controller;
  }, [
    clearFilterOptions,
    dataset,
    enabled,
    filterOptionsLoaded,
    filterOptionsLoading,
    fixedFilters,
    projectCode,
    refreshToken,
  ]);

  React.useEffect(() => {
    if (!enabled) {
      clearFilterOptions();
      setFilterOptionsLoading((current) => (current ? false : current));
      return;
    }

    const hasActiveFilters = Object.keys(state.filters).length > 0;
    if (!hasActiveFilters) return;

    const controller = loadFilterOptions();
    return () => controller?.abort();
  }, [clearFilterOptions, enabled, loadFilterOptions, state.filters]);

  React.useEffect(() => {
    if (!enabled) {
      const fallbackRows = initialRowsRef.current;
      setRows((current) => (current === fallbackRows ? current : fallbackRows));
      setTotal((current) => (current === fallbackRows.length ? current : fallbackRows.length));
      setLoading((current) => (current ? false : current));
      return;
    }

    if (projectScopedDatasets.has(dataset) && !projectCode) {
      setRows((current) => (current.length ? [] : current));
      setTotal((current) => (current ? 0 : current));
      setLoading((current) => (current ? false : current));
      return;
    }

    const requestRefreshToken = refreshToken;
    const controller = new AbortController();
    setLoading(true);

    fetchGiaPhuPagedRows<T>({
      dataset,
      projectCode,
      pageIndex: state.pageIndex,
      pageSize: state.pageSize,
      search: state.query,
      sorting: state.sorting,
      filters: { ...fixedFilters, ...state.filters },
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted || requestRefreshToken < 0) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRows((current) => (current.length ? [] : current));
        setTotal((current) => (current ? 0 : current));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading((current) => (current ? false : current));
      });

    return () => controller.abort();
  }, [
    dataset,
    enabled,
    fixedFilters,
    projectCode,
    refreshToken,
    state.query,
    state.filters,
    state.sorting,
    state.pageIndex,
    state.pageSize,
  ]);

  const onStateChange = React.useCallback((nextState: DataTableServerState) => {
    setState((current) => {
      if (
        current.pageIndex === nextState.pageIndex &&
        current.pageSize === nextState.pageSize &&
        current.query === nextState.query &&
        JSON.stringify(current.sorting) === JSON.stringify(nextState.sorting) &&
        JSON.stringify(current.filters) === JSON.stringify(nextState.filters)
      ) {
        return current;
      }

      return nextState;
    });
  }, []);

  const getExportRows = React.useCallback(
    async (exportState: DataTableServerState) => {
      if (!enabled) return [];
      if (projectScopedDatasets.has(dataset) && !projectCode) return [];

      setExportLoading(true);
      try {
        const result = await fetchGiaPhuPagedRows<T>({
          dataset,
          projectCode,
          pageIndex: 0,
          pageSize: Math.max(exportState.pageSize, total, 1),
          search: exportState.query,
          sorting: exportState.sorting,
          filters: { ...fixedFilters, ...exportState.filters },
        });

        return result.rows;
      } finally {
        setExportLoading(false);
      }
    },
    [dataset, enabled, fixedFilters, projectCode, total],
  );

  const serverSide = React.useMemo(
    () => ({
      rowCount: total,
      loading,
      exportLoading,
      filterOptionsLoading,
      filterOptions,
      onFilterOptionsRequest: loadFilterOptions,
      onStateChange,
      getExportRows,
    }),
    [
      exportLoading,
      filterOptions,
      filterOptionsLoading,
      getExportRows,
      loadFilterOptions,
      loading,
      onStateChange,
      total,
    ],
  );

  const refresh = React.useCallback(() => setRefreshToken((current) => current + 1), []);

  return { rows, total, loading, serverSide, refresh };
}
