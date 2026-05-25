"use client";

import { LayoutDashboard } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { formatMoney } from "../_lib/formatters";
import { ModuleHeader } from "./module-header";
import { StatCard } from "./stat-card";

export function OverviewDashboard() {
  const { activeProject, summary, scoped } = useGiaPhuErp();

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Tổng quan công trình"
        description="Bức tranh điều hành hiện tại: chi phí, khối lượng phát sinh và các nhóm nghiệp vụ chính."
        icon={LayoutDashboard}
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="VT Chính" value={formatMoney(summary.materialMain)} tone="text-primary" />
        <StatCard label="VT Phụ" value={formatMoney(summary.materialSub)} />
        <StatCard label="VT MEP" value={formatMoney(summary.materialMep)} />
        <StatCard label="Nhân công" value={formatMoney(summary.labor)} tone="text-success" />
        <StatCard label="Thầu phụ" value={formatMoney(summary.subcontractor)} tone="text-warning" />
        <StatCard label="Tổng chi" value={formatMoney(summary.total)} tone="text-destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hồ sơ công trình</CardTitle>
            <CardDescription>Thông tin nền phục vụ điều hành.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Mã công trình</div>
              <div className="font-medium">{activeProject?.code || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Tên công trình</div>
              <div className="font-medium">{activeProject?.name || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Chủ đầu tư</div>
              <div className="font-medium">{activeProject?.owner || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Trạng thái</div>
              <div className="font-medium">{activeProject?.status || "-"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sản lượng dữ liệu</CardTitle>
            <CardDescription>Số lượng bản ghi theo module.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <Metric label="Dòng vật tư" value={scoped.materials.length} />
            <Metric label="Dòng chấm công" value={scoped.attendance.length} />
            <Metric label="Dòng thầu phụ" value={scoped.subcontractors.length} />
            <Metric label="Dòng vận hành" value={scoped.operations.length} />
            <Metric label="Hợp đồng" value={scoped.contracts.length} />
            <Metric label="Phiếu thu" value={scoped.payments.length} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}
