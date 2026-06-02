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
}: {
  dataset: GiaPhuPagedDataset;
  projectCode: string;
  initialRows: T[];
  initialPageSize?: number;
  fixedFilters?: Record<string, string>;
}) {
  const [rows, setRows] = React.useState<T[]>(initialRows);
  const [total, setTotal] = React.useState(initialRows.length);
  const [loading, setLoading] = React.useState(false);
  const [filterOptions, setFilterOptions] = React.useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [state, setState] = React.useState<DataTableServerState>({
    pageIndex: 0,
    pageSize: initialPageSize,
    query: "",
    sorting: [],
    filters: {},
  });
  React.useEffect(() => {
    setRows(initialRows);
    setTotal(initialRows.length);
    setState((current) => ({ ...current, pageIndex: 0 }));
  }, [initialRows]);

  React.useEffect(() => {
    if (projectScopedDatasets.has(dataset) && !projectCode) {
      setFilterOptions({});
      return;
    }

    const requestRefreshToken = refreshToken;
    const controller = new AbortController();

    fetchGiaPhuFilterOptions({
      dataset,
      projectCode,
      filters: fixedFilters,
    })
      .then((options) => {
        if (controller.signal.aborted || requestRefreshToken < 0) return;
        setFilterOptions(options);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFilterOptions({});
      });

    return () => controller.abort();
  }, [dataset, fixedFilters, projectCode, refreshToken]);

  React.useEffect(() => {
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
      filters: { ...fixedFilters, ...state.filters },
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
  }, [dataset, fixedFilters, projectCode, refreshToken, state.query, state.filters, state.pageIndex, state.pageSize]);

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
      filterOptions,
      onStateChange,
    }),
    [filterOptions, loading, onStateChange, total],
  );

  const refresh = React.useCallback(() => setRefreshToken((current) => current + 1), []);

  return { rows, total, loading, serverSide, refresh };
}
