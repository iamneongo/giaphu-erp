"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis } from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  ClipboardList,
  Coins,
  FileSpreadsheet,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import {
  formatPercent,
  formatVnd,
  getReportsInsights,
  type BreakdownPoint,
  type CategorySpendPoint,
} from "../_lib/dashboard-insights";
import { DataTable } from "./data-table";

const monthlyCashflowConfig = {
  cost: {
    label: "Chi phí",
    color: "var(--chart-1)",
  },
  cashIn: {
    label: "Thu tiền",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const weeklyConfig = {
  total: {
    label: "Tổng chi",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const mixConfig = {
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

export function ReportsWorkspace() {
  const { activeProject, scoped } = useGiaPhuErp();
  const insights = React.useMemo(() => getReportsInsights(scoped), [scoped]);

  const monthlyData = insights.monthly.map((row) => ({
    ...row,
    cost: row.materials + row.labor + row.subcontractors + row.operations,
    monthLabel: formatMonthLabel(row.month),
  }));

  const weeklyData = insights.weekly.map((row) => ({
    ...row,
    shortWeek: row.week.replace(".", "/"),
  }));

  const breakdownRows = insights.breakdown;

  const mixRows = insights.breakdown.map((row) => ({
    name: row.key,
    value: row.value,
    fill: `var(--color-${row.key})`,
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Báo cáo chi phí và dòng tiền</h1>
          <p className="max-w-3xl text-muted-foreground text-sm leading-6">
            Tổng hợp để rà soát tuần, in báo cáo và đối chiếu tiến độ tài chính của {activeProject?.name ?? "công trình"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <FileSpreadsheet className="mr-1 size-3.5" />
            {activeProject?.code ?? "Chưa chọn công trình"}
          </Badge>
          <Badge variant="secondary">{insights.weekly.length} tuần gần nhất</Badge>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Tổng hợp</TabsTrigger>
          <TabsTrigger value="weekly">Theo tuần</TabsTrigger>
        </TabsList>

        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:grid-cols-2 2xl:grid-cols-4">
          <ReportMetricCard
            title="Tổng chi phí"
            value={formatVnd(insights.headline.totalCost)}
            badge={`${insights.breakdown.length} nhóm chi`}
            footer="Toàn bộ vật tư, nhân công, thầu phụ và vận hành."
            icon={ReceiptText}
          />
          <ReportMetricCard
            title="Giá trị hợp đồng"
            value={formatVnd(insights.headline.contractValue)}
            badge={`${insights.headline.contractValue ? ((insights.headline.totalCost / insights.headline.contractValue) * 100).toFixed(1) : "0.0"}% đã dùng`}
            footer="So với phần ngân sách đã ký của công trình."
            icon={ClipboardList}
          />
          <ReportMetricCard
            title="Tiền đã thu"
            value={formatVnd(insights.headline.collectedCash)}
            badge={`${insights.headline.contractCoverage.toFixed(1)}% hợp đồng`}
            footer="Mức độ bao phủ dòng tiền vào trên tổng giá trị hợp đồng."
            icon={WalletCards}
          />
          <ReportMetricCard
            title="Vật tư chưa thanh toán"
            value={formatVnd(insights.headline.unpaidMaterials)}
            badge={`${insights.headline.costCoverage.toFixed(1)}% thu/chi`}
            footer="Ưu tiên kiểm soát công nợ mở trước các kỳ thanh toán tiếp theo."
            icon={Coins}
          />
        </div>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Dòng tiền theo tháng
                  <Badge variant="outline">
                    {insights.headline.collectedCash >= insights.headline.totalCost ? (
                      <ArrowUpRight className="mr-1 size-3.5" />
                    ) : (
                      <ArrowDownLeft className="mr-1 size-3.5" />
                    )}
                    {formatPercent(insights.headline.costCoverage - 100)}
                  </Badge>
                </CardTitle>
                <CardDescription>So sánh tổng chi với tiền đã thu trong 8 tháng gần nhất.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={monthlyCashflowConfig}>
                  <AreaChart accessibilityLayer data={monthlyData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                    />
                    <Area type="monotone" dataKey="cashIn" fill="var(--color-cashIn)" fillOpacity={0.2} stroke="var(--color-cashIn)" />
                    <Area type="monotone" dataKey="cost" fill="var(--color-cost)" fillOpacity={0.26} stroke="var(--color-cost)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Cơ cấu chi phí
                  <Badge variant="outline">
                    <BadgeCheck className="mr-1 size-3.5" />
                    Tổng hợp
                  </Badge>
                </CardTitle>
                <CardDescription>Tỷ trọng chi phí theo module nghiệp vụ đang phát sinh.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ChartContainer config={mixConfig} className="mx-auto aspect-square max-h-[300px] min-h-[250px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} hideLabel />} />
                    <Pie data={mixRows} dataKey="value" nameKey="name" innerRadius={44} outerRadius={88} paddingAngle={4} cornerRadius={10} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
              <CardFooter className="grid gap-2 text-sm">
                {breakdownRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.share.toFixed(1)}%</span>
                  </div>
                ))}
              </CardFooter>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Bảng tổng hợp chi phí</CardTitle>
                <CardDescription>Mỗi nhóm hiển thị số dòng, bình quân mỗi dòng và tỷ trọng trong tổng chi.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    {
                      key: "label",
                      label: "Nhóm",
                      accessor: (row: BreakdownPoint) => row.label,
                      render: (row: BreakdownPoint) => <div className="font-medium">{row.label}</div>,
                    },
                    {
                      key: "rows",
                      label: "Số dòng",
                      accessor: (row: BreakdownPoint) => row.rows,
                      render: (row: BreakdownPoint) => row.rows.toLocaleString("vi-VN"),
                      className: "text-right",
                    },
                    {
                      key: "avg",
                      label: "Bình quân / dòng",
                      accessor: (row: BreakdownPoint) => (row.rows ? row.value / row.rows : 0),
                      render: (row: BreakdownPoint) => formatVnd(row.rows ? row.value / row.rows : 0),
                      className: "text-right",
                    },
                    {
                      key: "share",
                      label: "Tỷ trọng",
                      accessor: (row: BreakdownPoint) => row.share,
                      render: (row: BreakdownPoint) => `${row.share.toFixed(1)}%`,
                      className: "text-right",
                    },
                    {
                      key: "value",
                      label: "Tổng tiền",
                      accessor: (row: BreakdownPoint) => row.value,
                      render: (row: BreakdownPoint) => <span className="font-medium">{formatVnd(row.value)}</span>,
                      className: "text-right",
                    },
                  ]}
                  rows={breakdownRows}
                  getRowId={(row) => row.key}
                  selectable
                  exportFileName="bao-cao-tong-hop-chi-phi"
                  filters={[
                    { key: "label", label: "Nhóm", options: breakdownRows.map((row) => ({ label: row.label, value: row.label })) },
                  ]}
                  initialSorting={[{ id: "value", desc: true }]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Nhịp chi phí theo tuần</CardTitle>
                <CardDescription>8 tuần gần nhất để rà soát tuần nào tăng tốc thi công hoặc đội chi phí.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={weeklyConfig}>
                  <BarChart accessibilityLayer data={weeklyData}>
                    <XAxis dataKey="shortWeek" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                    />
                    <Bar dataKey="total" fill="var(--color-total)" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Top hạng mục tiêu tiền</CardTitle>
                <CardDescription>Những hạng mục đang hấp thụ ngân sách lớn nhất trong công trình.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.categorySpend.slice(0, 5).map((item, index) => (
                    <CategorySpendRow key={item.category} item={item} rank={index + 1} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader>
                <CardTitle>Bảng theo tuần</CardTitle>
                <CardDescription>Tách rõ vật tư, nhân công, thầu phụ và vận hành cho từng tuần làm việc.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    {
                      key: "week",
                      label: "Tuần",
                      accessor: (row) => row.week,
                      render: (row) => <span className="font-medium">{row.week}</span>,
                    },
                    {
                      key: "materials",
                      label: "Vật tư",
                      accessor: (row) => row.materials,
                      render: (row) => formatVnd(row.materials),
                      className: "text-right",
                    },
                    {
                      key: "labor",
                      label: "Nhân công",
                      accessor: (row) => row.labor,
                      render: (row) => formatVnd(row.labor),
                      className: "text-right",
                    },
                    {
                      key: "subcontractors",
                      label: "Thầu phụ",
                      accessor: (row) => row.subcontractors,
                      render: (row) => formatVnd(row.subcontractors),
                      className: "text-right",
                    },
                    {
                      key: "operations",
                      label: "Vận hành",
                      accessor: (row) => row.operations,
                      render: (row) => formatVnd(row.operations),
                      className: "text-right",
                    },
                    {
                      key: "total",
                      label: "Tổng chi",
                      accessor: (row) => row.total,
                      render: (row) => <span className="font-medium">{formatVnd(row.total)}</span>,
                      className: "text-right",
                    },
                  ]}
                  rows={insights.weekly}
                  getRowId={(row) => row.week}
                  selectable
                  exportFileName="bao-cao-theo-tuan"
                  filters={[
                    { key: "week", label: "Tuần", options: insights.weekly.map((row) => ({ label: row.week, value: row.week })) },
                  ]}
                  initialSorting={[{ id: "total", desc: true }]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportMetricCard({
  title,
  value,
  badge,
  footer,
  icon: Icon,
}: {
  title: string;
  value: string;
  badge: string;
  footer: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <CardAction>
          <Badge variant="outline">{badge}</Badge>
        </CardAction>
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

function CategorySpendRow({ item, rank }: { item: CategorySpendPoint; rank: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-full border bg-muted font-medium">{rank}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.category}</div>
        <div className="text-muted-foreground text-sm">
          VT {formatVnd(item.materials)} • NC {formatVnd(item.labor)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium">{formatVnd(item.total)}</div>
        <div className="text-muted-foreground text-xs">Tổng cộng</div>
      </div>
    </div>
  );
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
}
