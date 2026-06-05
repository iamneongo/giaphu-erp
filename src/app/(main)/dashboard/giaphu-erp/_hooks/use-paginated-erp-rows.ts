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
  const filterOptionsScopeKey = React.useMemo(
    () => JSON.stringify({ dataset, fixedFilters, projectCode }),
    [dataset, fixedFilters, projectCode],
  );
  const previousFilterOptionsScopeKey = React.useRef(filterOptionsScopeKey);

  React.useEffect(() => {
    setRows(initialRows);
    setTotal(initialRows.length);
    setState((current) => (current.pageIndex ? { ...current, pageIndex: 0 } : current));
  }, [initialRows]);

  React.useEffect(() => {
    if (previousFilterOptionsScopeKey.current === filterOptionsScopeKey) return;

    previousFilterOptionsScopeKey.current = filterOptionsScopeKey;
    setFilterOptions({});
    setFilterOptionsLoading(false);
  }, [filterOptionsScopeKey]);

  const loadFilterOptions = React.useCallback(() => {
    if (!enabled) {
      setFilterOptions({});
      return undefined;
    }

    if (projectScopedDatasets.has(dataset) && !projectCode) {
      setFilterOptions({});
      return undefined;
    }

    if (Object.keys(filterOptions).length > 0 || filterOptionsLoading) {
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
        if (!controller.signal.aborted) setFilterOptions({});
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilterOptionsLoading(false);
      });

    return controller;
  }, [dataset, enabled, filterOptions, filterOptionsLoading, fixedFilters, projectCode, refreshToken]);

  React.useEffect(() => {
    if (!enabled) {
      setFilterOptions({});
      setFilterOptionsLoading(false);
      return;
    }

    const hasActiveFilters = Object.keys(state.filters).length > 0;
    if (!hasActiveFilters) return;

    const controller = loadFilterOptions();
    return () => controller?.abort();
  }, [enabled, loadFilterOptions, state.filters]);

  React.useEffect(() => {
    if (!enabled) {
      setRows(initialRows);
      setTotal(initialRows.length);
      setLoading(false);
      return;
    }

    if (projectScopedDatasets.has(dataset) && !projectCode) {
      setRows([]);
      setTotal(0);
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
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    dataset,
    enabled,
    fixedFilters,
    initialRows,
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

  const serverSide = React.useMemo(
    () => ({
      rowCount: total,
      loading,
      filterOptionsLoading,
      filterOptions,
      onFilterOptionsRequest: loadFilterOptions,
      onStateChange,
    }),
    [filterOptions, filterOptionsLoading, loadFilterOptions, loading, onStateChange, total],
  );

  const refresh = React.useCallback(() => setRefreshToken((current) => current + 1), []);

  return { rows, total, loading, serverSide, refresh };
}
