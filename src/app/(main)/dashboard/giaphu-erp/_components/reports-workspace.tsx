"use client";

import * as React from "react";

import { Banknote, Download, HardHat, PackageSearch, ReceiptText } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { ReportsContentSkeleton } from "../../_components/loading-skeletons";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { useReportsData } from "../_hooks/use-reports-data";
import { formatVnd } from "../_lib/dashboard-insights";
import { formatCount } from "../_lib/formatters";
import { DataTable } from "./data-table";

const costChartConfig = {
  materials: {
    label: "VT Chính",
    color: "var(--chart-1)",
  },
  labor: {
    label: "Nhân công",
    color: "var(--chart-2)",
  },
  operations: {
    label: "Vận hành",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const ReuiPie = Pie as unknown as React.ComponentType<
  Omit<React.ComponentProps<typeof Pie>, "activeIndex" | "activeShape"> & {
    activeIndex?: number;
    activeShape?: unknown;
  }
>;

export function ReportsWorkspace() {
  const { activeProject, activeProjectCode, isSwitchingProject } = useGiaPhuErp();
  const chartId = React.useId().replace(/\W/g, "");
  const {
    data: reportData,
    laborServerSide,
    loading,
    materialsServerSide,
    operationsServerSide,
  } = useReportsData(activeProjectCode);
  const insights = reportData.insights;

  const totalFocusedCost =
    insights.headline.materialMainCost + insights.headline.laborCost + insights.headline.operationCost;
  const laborShare = totalFocusedCost ? (insights.headline.laborCost / totalFocusedCost) * 100 : 0;
  const monthlyData = insights.monthly.map((row) => ({
    ...row,
    monthLabel: formatMonthLabel(row.month),
  }));
  const weeklyData = insights.weekly.map((row) => ({
    ...row,
    shortWeek: row.week.replace(".", "/"),
  }));
  const reportCostRows = [
    {
      key: "materials",
      label: "VT Chính",
      value: insights.headline.materialMainCost,
      fill: "var(--color-materials)",
    },
    {
      key: "labor",
      label: "Nhân công",
      value: insights.headline.laborCost,
      fill: "var(--color-labor)",
    },
    {
      key: "operations",
      label: "Vận hành",
      value: insights.headline.operationCost,
      fill: "var(--color-operations)",
    },
  ];
  const reportDonutData = reportCostRows.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.value,
    fill: row.fill,
  }));
  const activeReportCostIndex = reportDonutData.reduce(
    (bestIndex, row, index, rows) => (row.value > rows[bestIndex].value ? index : bestIndex),
    0,
  );
  const reportGradientIds = {
    materials: `report-materials-${chartId}`,
    labor: `report-labor-${chartId}`,
    operations: `report-operations-${chartId}`,
  };

  function exportReport() {
    const lines = [
      ["Báo cáo", activeProject?.name ?? "Công trình"],
      ["Tổng 3 nhóm", totalFocusedCost],
      ["Chi phí nhân công", insights.headline.laborCost],
      ["Chi phí vật tư chính", insights.headline.materialMainCost],
      ["Chi phí vận hành", insights.headline.operationCost],
      ["Tỷ trọng nhân công", `${laborShare.toFixed(1)}%`],
      [],
      ["Tuần", "VT Chính", "Nhân công", "Vận hành", "Tổng 3 nhóm"],
      ...weeklyData.map((row) => [row.week, row.materials, row.labor, row.operations, row.total]),
    ];
    const csv = lines
      .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-nhan-cong-vat-tu-van-hanh-${activeProjectCode || "cong-trinh"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isSwitchingProject || loading) {
    return <ReportsContentSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">Báo cáo chi phí công trình</h1>
          <p className="max-w-3xl text-muted-foreground text-sm leading-6">
            Tập trung vào chi phí nhân công, vật tư chính và vận hành của {activeProject?.name ?? "công trình"}.
          </p>
        </div>
        <Button size="sm" onClick={exportReport}>
          <Download />
          Xuất báo cáo
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:grid-cols-2 2xl:grid-cols-4">
          <ReportMetricCard
            title="Tổng 3 nhóm"
            value={formatVnd(totalFocusedCost)}
            footer="Nhân công, vật tư chính và vận hành."
            icon={ReceiptText}
          />
          <ReportMetricCard
            title="Chi phí nhân công"
            value={formatVnd(insights.headline.laborCost)}
            footer={`${laborShare.toFixed(1)}% trong tổng 3 nhóm.`}
            icon={HardHat}
          />
          <ReportMetricCard
            title="Chi phí vật tư chính"
            value={formatVnd(insights.headline.materialMainCost)}
            footer="Chỉ tính vật tư loại VT Chính."
            icon={PackageSearch}
          />
          <ReportMetricCard
            title="Chi phí vận hành"
            value={formatVnd(insights.headline.operationCost)}
            footer="Các khoản vận hành phát sinh."
            icon={Banknote}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle>Chi phí theo tháng</CardTitle>
              <CardDescription>So sánh 3 nhóm chi phí chính theo từng tháng.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={costChartConfig} className="aspect-auto h-[230px] w-full">
                <BarChart accessibilityLayer data={monthlyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={reportGradientIds.materials} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-materials)" stopOpacity={0.96} />
                      <stop offset="95%" stopColor="var(--color-materials)" stopOpacity={0.42} />
                    </linearGradient>
                    <linearGradient id={reportGradientIds.labor} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-labor)" stopOpacity={0.96} />
                      <stop offset="95%" stopColor="var(--color-labor)" stopOpacity={0.42} />
                    </linearGradient>
                    <linearGradient id={reportGradientIds.operations} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-operations)" stopOpacity={0.96} />
                      <stop offset="95%" stopColor="var(--color-operations)" stopOpacity={0.42} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                  />
                  <Bar
                    dataKey="materials"
                    fill={`url(#${reportGradientIds.materials})`}
                    radius={[6, 6, 2, 2]}
                    barSize={16}
                  />
                  <Bar dataKey="labor" fill={`url(#${reportGradientIds.labor})`} radius={[6, 6, 2, 2]} barSize={16} />
                  <Bar
                    dataKey="operations"
                    fill={`url(#${reportGradientIds.operations})`}
                    radius={[6, 6, 2, 2]}
                    barSize={16}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="items-center pb-0">
              <CardTitle>Cơ cấu 3 nhóm</CardTitle>
              <CardDescription>Tỷ trọng nhân công, VT Chính và vận hành trong tổng báo cáo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 items-center justify-center pt-1 pb-0">
              <ChartContainer config={costChartConfig} className="mx-auto aspect-square h-[285px] w-full max-w-[330px]">
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
                                {costChartConfig[name as keyof typeof costChartConfig]?.label || name}
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
                    activeIndex={activeReportCostIndex}
                    activeShape={{ outerRadius: 102 }}
                    cornerRadius={5}
                    data={reportDonutData}
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
                <div className="text-muted-foreground text-xs">Tổng 3 nhóm</div>
                <div className="font-semibold text-lg tabular-nums">{formatVnd(totalFocusedCost)}</div>
              </div>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle>Nhịp chi phí theo tuần</CardTitle>
              <CardDescription>8 tuần gần nhất của nhân công, VT Chính và vận hành.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={costChartConfig} className="aspect-auto h-[230px] w-full">
                <AreaChart accessibilityLayer data={weeklyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`${reportGradientIds.materials}-area`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-materials)" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="var(--color-materials)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id={`${reportGradientIds.labor}-area`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-labor)" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="var(--color-labor)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id={`${reportGradientIds.operations}-area`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-operations)" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="var(--color-operations)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="shortWeek" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                  />
                  <Area
                    type="natural"
                    dataKey="operations"
                    stackId="weekly"
                    fill={`url(#${reportGradientIds.operations}-area)`}
                    fillOpacity={1}
                    stroke="var(--color-operations)"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <Area
                    type="natural"
                    dataKey="labor"
                    stackId="weekly"
                    fill={`url(#${reportGradientIds.labor}-area)`}
                    fillOpacity={1}
                    stroke="var(--color-labor)"
                    strokeWidth={2}
                  />
                  <Area
                    type="natural"
                    dataKey="materials"
                    stackId="weekly"
                    fill={`url(#${reportGradientIds.materials}-area)`}
                    fillOpacity={1}
                    stroke="var(--color-materials)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Bảng chi phí nhân công</CardTitle>
              <CardDescription>Theo dõi nhân sự, tuần, hạng mục và tổng tiền chấm công.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                  { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
                  {
                    key: "category",
                    label: "Hạng mục",
                    accessor: (row) => row.category,
                    render: (row) => row.category || "-",
                  },
                  {
                    key: "staffName",
                    label: "Nhân công",
                    accessor: (row) => row.staffName,
                    render: (row) => row.staffName || "-",
                  },
                  {
                    key: "position",
                    label: "Vai trò",
                    accessor: (row) => row.position,
                    render: (row) => row.position || "-",
                  },
                  {
                    key: "coefficient",
                    label: "Công",
                    accessor: (row) => row.coefficient,
                    render: (row) => formatCount(row.coefficient),
                    className: "text-right",
                  },
                  {
                    key: "total",
                    label: "Thành tiền",
                    accessor: (row) => row.total,
                    render: (row) => <span className="font-medium">{formatVnd(row.total)}</span>,
                    className: "text-right",
                  },
                ]}
                rows={reportData.tables.labor.rows}
                getRowId={(row) => row.id}
                serverSide={laborServerSide}
                selectable
                exportFileName="bao-cao-chi-phi-nhan-cong"
                filters={[
                  { key: "week", label: "Tuần", options: [] },
                  { key: "category", label: "Hạng mục", options: [] },
                  { key: "staffName", label: "Nhân công", options: [] },
                  { key: "position", label: "Vai trò", options: [] },
                ]}
                initialSorting={[{ id: "date", desc: true }]}
                searchPlaceholder="Tìm nhân công, hạng mục, vai trò..."
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Bảng chi phí vật tư chính</CardTitle>
              <CardDescription>Chỉ hiển thị vật tư loại VT Chính của công trình.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                  { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
                  {
                    key: "category",
                    label: "Hạng mục",
                    accessor: (row) => row.category,
                    render: (row) => row.category || "-",
                  },
                  {
                    key: "materialName",
                    label: "Vật tư",
                    accessor: (row) => row.materialName,
                    render: (row) => row.materialName || "-",
                  },
                  {
                    key: "supplier",
                    label: "NCC",
                    accessor: (row) => row.supplier,
                    render: (row) => row.supplier || "-",
                  },
                  {
                    key: "quantity",
                    label: "SL",
                    accessor: (row) => row.quantity,
                    render: (row) => `${formatCount(row.quantity)} ${row.unit}`,
                    className: "text-right",
                  },
                  {
                    key: "total",
                    label: "Thành tiền",
                    accessor: (row) => row.quantity * row.price,
                    render: (row) => <span className="font-medium">{formatVnd(row.quantity * row.price)}</span>,
                    className: "text-right",
                  },
                ]}
                rows={reportData.tables.materials.rows}
                getRowId={(row) => row.id}
                serverSide={materialsServerSide}
                selectable
                exportFileName="bao-cao-chi-phi-vat-tu-chinh"
                filters={[
                  { key: "week", label: "Tuần", options: [] },
                  { key: "category", label: "Hạng mục", options: [] },
                  { key: "supplier", label: "NCC", options: [] },
                ]}
                initialSorting={[{ id: "date", desc: true }]}
                searchPlaceholder="Tìm vật tư chính, NCC, hạng mục..."
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Bảng chi phí vận hành</CardTitle>
              <CardDescription>Các khoản vận hành phát sinh theo ngày và tuần.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                  { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
                  {
                    key: "description",
                    label: "Diễn giải",
                    accessor: (row) => row.description,
                    render: (row) => row.description || "-",
                  },
                  {
                    key: "amount",
                    label: "Số tiền",
                    accessor: (row) => row.amount,
                    render: (row) => <span className="font-medium">{formatVnd(row.amount)}</span>,
                    className: "text-right",
                  },
                ]}
                rows={reportData.tables.operations.rows}
                getRowId={(row) => row.id}
                serverSide={operationsServerSide}
                selectable
                exportFileName="bao-cao-chi-phi-van-hanh"
                filters={[{ key: "week", label: "Tuần", options: [] }]}
                initialSorting={[{ id: "date", desc: true }]}
                searchPlaceholder="Tìm diễn giải vận hành..."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReportMetricCard({
  title,
  value,
  footer,
  icon: Icon,
}: {
  title: string;
  value: string;
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
          {title}
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
