"use client";

import * as React from "react";

import type { GiaPhuOverviewInsights, GiaPhuReportsInsights } from "@/lib/giaphu-erp/types";

import { fetchGiaPhuInsights } from "../_lib/giaphu-erp-api";

type InsightTypeMap = {
  overview: GiaPhuOverviewInsights;
  reports: GiaPhuReportsInsights;
};

export function useErpInsights<TType extends keyof InsightTypeMap>({
  type,
  projectCode,
  fallback,
}: {
  type: TType;
  projectCode: string;
  fallback: InsightTypeMap[TType];
}) {
  const [insights, setInsights] = React.useState<InsightTypeMap[TType]>(fallback);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setInsights(fallback);
  }, [fallback]);

  React.useEffect(() => {
    if (!projectCode) return;

    const controller = new AbortController();
    setLoading(true);

    fetchGiaPhuInsights<InsightTypeMap[TType]>({ type, projectCode })
      .then((nextInsights) => {
        if (!controller.signal.aborted) setInsights(nextInsights);
      })
      .catch(() => {
        if (!controller.signal.aborted) setInsights(fallback);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [fallback, projectCode, type]);

  return { insights, loading };
}
