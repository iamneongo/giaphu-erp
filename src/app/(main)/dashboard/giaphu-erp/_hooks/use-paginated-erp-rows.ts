"use client";

import * as React from "react";

import type { GiaPhuPagedDataset } from "@/lib/giaphu-erp/types";

import type { DataTableServerState } from "../_components/data-table";
import { fetchGiaPhuPagedRows } from "../_lib/giaphu-erp-api";

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function usePaginatedErpRows<T>({
  dataset,
  projectCode,
  initialRows,
  initialPageSize = 10,
}: {
  dataset: GiaPhuPagedDataset;
  projectCode: string;
  initialRows: T[];
  initialPageSize?: number;
}) {
  const [rows, setRows] = React.useState<T[]>(initialRows);
  const [total, setTotal] = React.useState(initialRows.length);
  const [loading, setLoading] = React.useState(false);
  const [state, setState] = React.useState<DataTableServerState>({
    pageIndex: 0,
    pageSize: initialPageSize,
    query: "",
    sorting: [],
    filters: {},
  });
  const debouncedQuery = useDebouncedValue(state.query);

  React.useEffect(() => {
    setRows(initialRows);
    setTotal(initialRows.length);
    setState((current) => ({ ...current, pageIndex: 0 }));
  }, [initialRows]);

  React.useEffect(() => {
    if (!projectCode) {
      setRows([]);
      setTotal(0);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetchGiaPhuPagedRows<T>({
      dataset,
      projectCode,
      pageIndex: state.pageIndex,
      pageSize: state.pageSize,
      search: debouncedQuery,
      filters: state.filters,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
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
  }, [dataset, debouncedQuery, projectCode, state.filters, state.pageIndex, state.pageSize]);

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
      onStateChange,
    }),
    [loading, onStateChange, total],
  );

  return { rows, total, loading, serverSide };
}
