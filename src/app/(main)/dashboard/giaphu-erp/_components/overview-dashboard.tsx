"use client";

import * as React from "react";

import {
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  CircleDollarSign,
  Hammer,
  HardHat,
  PackageSearch,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { DashboardContentSkeleton } from "../../_components/loading-skeletons";
import { useErpInsights } from "../_hooks/use-erp-insights";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { formatPercent, formatVnd, getOverviewInsights } from "../_lib/dashboard-insights";
import { formatCount } from "../_lib/formatters";

const monthlyChartConfig = {
  totalCost: {
    label: "Chi phí",
    color: "var(--chart-1)",
  },
  cashIn: {
    label: "Thu tiền",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const areaChartConfig = {
  materials: {
    label: "Vật tư",
    color: "var(--chart-1)",
  },
  labor: {
    label: "Nhân công",
    color: "var(--chart-2)",
  },
  subcontractors: {
    label: "Thầu phụ",
    color: "var(--chart-3)",
  },
  operations: {
    label: "Vận hành",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const pieChartConfig = {
  materialMain: {
    label: "VT Chính",
    color: "var(--chart-1)",
  },
  materialSub: {
    label: "VT Phụ",
    color: "var(--chart-2)",
  },
  labor: {
    label: "Nhân công",
    color: "var(--chart-3)",
  },
  subcontractors: {
    label: "Thầu phụ",
    color: "var(--chart-4)",
  },
  operations: {
    label: "Vận hành",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const ReuiPie = Pie as unknown as React.ComponentType<
  Omit<React.ComponentProps<typeof Pie>, "activeIndex" | "activeShape"> & {
    activeIndex?: number;
    activeShape?: unknown;
  }
>;

export function OverviewDashboard() {
  const { activeProject, activeProjectCode, isSwitchingProject, scoped } = useGiaPhuErp();
  const chartId = React.useId().replace(/\W/g, "");
  const fallbackInsights = React.useMemo(() => getOverviewInsights(scoped), [scoped]);
  const { insights, loading } = useErpInsights({
    type: "overview",
    projectCode: activeProjectCode,
    fallback: fallbackInsights,
  });

  const monthlyData = insights.monthly.map((row) => ({
    ...row,
    totalCost: row.materials + row.labor + row.subcontractors + row.operations,
    monthLabel: formatMonthLabel(row.month),
  }));

  const costRows = [
    {
      key: "materialMain",
      label: "VT Chính",
      value: insights.headline.materialMainCost,
      icon: PackageSearch,
      fill: "var(--color-materialMain)",
    },
    {
      key: "materialSub",
      label: "VT Phụ",
      value: insights.headline.materialSubCost,
      icon: ReceiptText,
      fill: "var(--color-materialSub)",
    },
    {
      key: "labor",
      label: "Nhân công",
      value: insights.headline.laborCost,
      icon: HardHat,
      fill: "var(--color-labor)",
    },
    {
      key: "subcontractors",
      label: "Thầu phụ",
      value: insights.headline.subcontractorCost,
      icon: Hammer,
      fill: "var(--color-subcontractors)",
    },
    {
      key: "operations",
      label: "Vận hành",
      value: insights.headline.operationCost,
      icon: Banknote,
      fill: "var(--color-operations)",
    },
  ];

  const costStructureData = costRows.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.value,
    fill: row.fill,
  }));
  const activeCostIndex = costStructureData.reduce(
    (bestIndex, row, index, rows) => (row.value > rows[bestIndex].value ? index : bestIndex),
    0,
  );
  const costGradientIds = {
    totalCost: `overview-total-cost-${chartId}`,
    cashIn: `overview-cash-in-${chartId}`,
    materials: `overview-materials-${chartId}`,
    labor: `overview-labor-${chartId}`,
    subcontractors: `overview-subcontractors-${chartId}`,
    operations: `overview-operations-${chartId}`,
  };

  if (isSwitchingProject || loading) {
    return <DashboardContentSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">{activeProject?.name ?? "Tổng quan công trình"}</h1>
          <p className="max-w-3xl text-muted-foreground text-sm leading-6">
            Theo dõi dòng tiền, nhóm chi phí và vận hành gần nhất của công trình đang chọn.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            title="Tổng hợp đồng"
            value={formatVnd(insights.headline.contractValue)}
            icon={BadgeDollarSign}
            hint="Giá trị đã ký"
            footer="Tổng giá trị hợp đồng của công trình."
          />
          <MetricCard
            title="Đã thu"
            value={formatVnd(insights.headline.collectedCash)}
            icon={Wallet}
            hint="Dòng tiền vào"
            footer="Tổng tiền đã ghi nhận từ chủ đầu tư."
          />
          <MetricCard
            title="Còn phải thu"
            value={formatVnd(insights.headline.remainingReceivable)}
            icon={CircleDollarSign}
            hint="Công nợ phải thu"
            footer="Tổng hợp đồng trừ số tiền đã thu."
          />
          <MetricCard
            title="LN tạm tính"
            value={formatVnd(insights.headline.provisionalProfit)}
            icon={ArrowUpRight}
            hint="Lợi nhuận dự kiến"
            footer="Tổng hợp đồng trừ tổng chi thực tế."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="flex min-w-0 flex-col xl:min-h-[390px]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                Chi phí phát sinh và tiền về
                <Badge variant="outline">
                  <ArrowUpRight className="mr-1 size-3.5" />
                  {formatPercent(insights.headline.cashTrend)}
                </Badge>
              </CardTitle>
              <CardDescription>6 tháng gần nhất để nhìn nhanh áp lực chi ra và tốc độ thu tiền.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 items-end pt-0">
              <ChartContainer config={monthlyChartConfig} className="aspect-auto h-[260px] w-full xl:h-[285px]">
                <BarChart accessibilityLayer data={monthlyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={costGradientIds.totalCost} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-totalCost)" stopOpacity={0.95} />
                      <stop offset="95%" stopColor="var(--color-totalCost)" stopOpacity={0.42} />
                    </linearGradient>
                    <linearGradient id={costGradientIds.cashIn} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-cashIn)" stopOpacity={0.95} />
                      <stop offset="95%" stopColor="var(--color-cashIn)" stopOpacity={0.42} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                  />
                  <Bar
                    dataKey="totalCost"
                    fill={`url(#${costGradientIds.totalCost})`}
                    radius={[6, 6, 2, 2]}
                    barSize={18}
                  />
                  <Bar dataKey="cashIn" fill={`url(#${costGradientIds.cashIn})`} radius={[6, 6, 2, 2]} barSize={18} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="flex min-w-0 flex-col xl:min-h-[390px]">
            <CardHeader className="items-center pb-0">
              <CardTitle>Tổng chi thực tế</CardTitle>
              <CardDescription>Tỷ trọng các nhóm chi phí trong tổng chi thực tế.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 items-center justify-center pt-1 pb-0">
              <ChartContainer config={pieChartConfig} className="aspect-square h-[285px] w-full max-w-[330px]">
                <PieChart accessibilityLayer>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="min-w-44 gap-2.5"
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="size-2.5 shrink-0 rounded-xs bg-(--color-bg)"
                                style={
                                  {
                                    "--color-bg": `var(--color-${name})`,
                                  } as React.CSSProperties
                                }
                              />
                              <span className="text-muted-foreground">
                                {pieChartConfig[name as keyof typeof pieChartConfig]?.label || name}
                              </span>
                            </div>
                            <span className="font-semibold text-foreground tabular-nums">
                              {formatVnd(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent nameKey="key" />} className="-translate-y-2 flex-wrap" />
                  <ReuiPie
                    activeIndex={activeCostIndex}
                    activeShape={{ outerRadius: 102 }}
                    cornerRadius={5}
                    data={costStructureData}
                    dataKey="value"
                    innerRadius={55}
                    nameKey="key"
                    outerRadius={92}
                    paddingAngle={3}
                    stroke="var(--background)"
                    strokeWidth={3}
                  />
                </PieChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="justify-center border-t bg-muted/20 py-3">
              <div className="text-center">
                <div className="text-muted-foreground text-xs">Tổng chi</div>
                <div className="font-semibold text-lg tabular-nums">{formatVnd(insights.headline.totalCost)}</div>
              </div>
            </CardFooter>
          </Card>

          <Card className="flex min-w-0 flex-col xl:min-h-[390px]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                Cơ cấu chi phí theo tháng
                <Badge variant="outline">{formatCount(insights.headline.activeWeeks)} tuần</Badge>
              </CardTitle>
              <CardDescription>Phân rã chi phí để dễ thấy tháng nào lệch trọng tâm thi công.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 items-end pt-0">
              <ChartContainer config={areaChartConfig} className="aspect-auto h-[260px] w-full xl:h-[285px]">
                <AreaChart accessibilityLayer data={monthlyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={costGradientIds.operations} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-operations)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-operations)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id={costGradientIds.subcontractors} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-subcontractors)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-subcontractors)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id={costGradientIds.labor} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-labor)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-labor)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id={costGradientIds.materials} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-materials)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-materials)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                  />
                  <Area
                    type="natural"
                    dataKey="operations"
                    stackId="cost"
                    fill={`url(#${costGradientIds.operations})`}
                    fillOpacity={1}
                    stroke="var(--color-operations)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="natural"
                    dataKey="subcontractors"
                    stackId="cost"
                    fill={`url(#${costGradientIds.subcontractors})`}
                    fillOpacity={1}
                    stroke="var(--color-subcontractors)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="natural"
                    dataKey="labor"
                    stackId="cost"
                    fill={`url(#${costGradientIds.labor})`}
                    fillOpacity={1}
                    stroke="var(--color-labor)"
                    strokeWidth={2}
                  />
                  <Area
                    type="natural"
                    dataKey="materials"
                    stackId="cost"
                    fill={`url(#${costGradientIds.materials})`}
                    fillOpacity={1}
                    stroke="var(--color-materials)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  footer,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  footer: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="size-4" />
          {hint}
        </div>
        <div className="text-muted-foreground">{footer}</div>
      </CardFooter>
    </Card>
  );
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
}
