"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, LabelList } from "recharts";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  PackageSearch,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { formatCount } from "../_lib/formatters";
import { formatPercent, formatVnd, getOverviewInsights } from "../_lib/dashboard-insights";
import { DashboardContentSkeleton } from "../../_components/loading-skeletons";

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

export function OverviewDashboard() {
  const { activeProject, isSwitchingProject, scoped } = useGiaPhuErp();
  const insights = React.useMemo(() => getOverviewInsights(scoped), [scoped]);

  const monthlyData = insights.monthly.map((row) => ({
    ...row,
    totalCost: row.materials + row.labor + row.subcontractors + row.operations,
    monthLabel: formatMonthLabel(row.month),
  }));

  const breakdownData = insights.breakdown.map((row) => ({
    browser: row.key,
    visitors: row.value,
    fill: `var(--color-${row.key})`,
  }));

  if (isSwitchingProject) {
    return <DashboardContentSkeleton />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{activeProject?.name ?? "Tổng quan công trình"}</h1>
          <p className="max-w-3xl text-muted-foreground text-sm leading-6">
            Theo dõi dòng tiền, nhóm chi phí và vận hành gần nhất của công trình đang chọn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <BriefcaseBusiness className="mr-1 size-3.5" />
            {activeProject?.code ?? "Chưa chọn công trình"}
          </Badge>
          <Badge variant="secondary">{activeProject?.status ?? "Chưa có trạng thái"}</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="signals" disabled>
            Tín hiệu điều hành
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              title="Tổng chi phí"
              value={formatVnd(insights.headline.totalCost)}
              trend={insights.headline.costTrend}
              icon={CircleDollarSign}
              hint="So với tháng trước"
              footer={`Đang phủ ${formatCount(insights.headline.activeCategories)} hạng mục và ${formatCount(insights.headline.activeWeeks)} tuần thi công`}
            />
            <MetricCard
              title="Giá trị hợp đồng"
              value={formatVnd(insights.headline.contractValue)}
              trend={insights.headline.contractValue ? (insights.headline.totalCost / insights.headline.contractValue) * 100 : 0}
              icon={BadgeDollarSign}
              hint="Tỷ lệ chi phí / hợp đồng"
              footer="Phù hợp để nhìn nhanh dư địa triển khai"
              trendAsPercentOfBase
            />
            <MetricCard
              title="Tiền đã thu"
              value={formatVnd(insights.headline.collectedCash)}
              trend={insights.headline.cashTrend}
              icon={Wallet}
              hint="So với tháng trước"
              footer="Dòng tiền vào dùng đối chiếu với tiến độ thanh toán"
            />
            <MetricCard
              title="Công nợ vật tư mở"
              value={formatVnd(insights.headline.openMaterialDebt)}
              trend={insights.headline.totalCost ? (insights.headline.openMaterialDebt / insights.headline.totalCost) * 100 : 0}
              icon={PackageSearch}
              hint="Tỷ trọng trên tổng chi"
              footer="Tập trung vào vật tư chưa thanh toán"
              inverse
              trendAsPercentOfBase
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Chi phí phát sinh và tiền về
                  <Badge variant="outline">
                    <ArrowUpRight className="mr-1 size-3.5" />
                    {formatPercent(insights.headline.cashTrend)}
                  </Badge>
                </CardTitle>
                <CardDescription>6 tháng gần nhất để nhìn nhanh áp lực chi ra và tốc độ thu tiền.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={monthlyChartConfig}>
                  <BarChart accessibilityLayer data={monthlyData}>
                    <XAxis
                      dataKey="monthLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                    />
                    <Bar dataKey="totalCost" fill="var(--color-totalCost)" radius={8} />
                    <Bar dataKey="cashIn" fill="var(--color-cashIn)" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Hoạt động gần nhất</CardTitle>
                <CardDescription>5 dòng nghiệp vụ mới nhất phát sinh trên công trình đang làm việc.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {insights.recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3">
                      <Avatar className="size-9 border">
                        <AvatarFallback className="bg-muted text-xs">{activity.type.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm leading-none font-medium">{activity.title}</p>
                        <p className="truncate text-muted-foreground text-sm">
                          {activity.subtitle} • {formatDateLabel(activity.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatVnd(activity.amount)}</div>
                        <div className="text-muted-foreground text-xs">{activity.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Cơ cấu chi phí theo tháng
                  <Badge variant="outline">
                    <Activity className="mr-1 size-3.5" />
                    4 nhóm chi
                  </Badge>
                </CardTitle>
                <CardDescription>Phân rã chi phí để dễ thấy tháng nào lệch trọng tâm thi công.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={areaChartConfig}>
                  <AreaChart accessibilityLayer data={monthlyData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="monthLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent formatter={(value) => formatVnd(Number(value))} />}
                    />
                    <Area type="natural" dataKey="operations" stackId="cost" fill="var(--color-operations)" fillOpacity={0.18} stroke="var(--color-operations)" />
                    <Area type="natural" dataKey="subcontractors" stackId="cost" fill="var(--color-subcontractors)" fillOpacity={0.22} stroke="var(--color-subcontractors)" />
                    <Area type="natural" dataKey="labor" stackId="cost" fill="var(--color-labor)" fillOpacity={0.24} stroke="var(--color-labor)" />
                    <Area type="natural" dataKey="materials" stackId="cost" fill="var(--color-materials)" fillOpacity={0.28} stroke="var(--color-materials)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="items-center pb-0">
                <CardTitle className="flex items-center gap-2">
                  Tỷ trọng chi phí
                  <Badge variant="outline">
                    <CalendarClock className="mr-1 size-3.5" />
                    Hiện tại
                  </Badge>
                </CardTitle>
                <CardDescription>Tỷ trọng tổng chi của công trình theo từng nhóm nghiệp vụ.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 items-center justify-center pb-0">
                <ChartContainer
                  config={pieChartConfig}
                  className="mx-auto aspect-square max-h-[300px] min-h-[250px] [&_.recharts-text]:fill-background"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="visitors" formatter={(value) => formatVnd(Number(value))} hideLabel />} />
                    <Pie
                      data={breakdownData}
                      innerRadius={36}
                      dataKey="visitors"
                      nameKey="browser"
                      cornerRadius={10}
                      paddingAngle={4}
                    >
                      <LabelList
                        dataKey="visitors"
                        stroke="none"
                        fontSize={12}
                        fontWeight={500}
                        fill="currentColor"
                        formatter={(value) => formatCount(Math.round(Number(value) / 1_000_000))}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
              <CardFooter className="grid gap-2 text-sm">
                {insights.breakdown.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.share.toFixed(1)}%</span>
                  </div>
                ))}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  hint,
  footer,
  icon: Icon,
  inverse = false,
  trendAsPercentOfBase = false,
}: {
  title: string;
  value: string;
  trend: number;
  hint: string;
  footer: string;
  icon: React.ComponentType<{ className?: string }>;
  inverse?: boolean;
  trendAsPercentOfBase?: boolean;
}) {
  const isPositive = inverse ? trend <= 0 : trend >= 0;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownLeft;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <CardAction>
          <Badge variant="outline">
            <TrendIcon className="mr-1 size-3.5" />
            {trendAsPercentOfBase ? `${trend.toFixed(1)}%` : formatPercent(trend)}
          </Badge>
        </CardAction>
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

function formatDateLabel(value: string) {
  if (!value) return "Chưa rõ ngày";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
