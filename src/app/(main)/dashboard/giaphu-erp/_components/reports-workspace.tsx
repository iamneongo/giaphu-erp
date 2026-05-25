"use client";

import { Printer } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { formatMoney } from "../_lib/formatters";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { StatCard } from "./stat-card";

export function ReportsWorkspace() {
  const { summary, scoped } = useGiaPhuErp();

  const reportRows = [
    {
      id: "materials",
      group: "Vật tư",
      rows: scoped.materials.length,
      total: scoped.materials.reduce((sum, row) => sum + row.quantity * row.price, 0),
    },
    {
      id: "attendance",
      group: "Nhân công",
      rows: scoped.attendance.length,
      total: scoped.attendance.reduce((sum, row) => sum + row.total, 0),
    },
    {
      id: "subcontractors",
      group: "Thầu phụ",
      rows: scoped.subcontractors.length,
      total: scoped.subcontractors.reduce((sum, row) => sum + row.advance, 0),
    },
    {
      id: "operations",
      group: "Vận hành",
      rows: scoped.operations.length,
      total: scoped.operations.reduce((sum, row) => sum + row.amount, 0),
    },
  ];

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Báo cáo chi phí"
        description="Tổng hợp chi phí theo nhóm nghiệp vụ để phục vụ in ấn và rà soát tuần."
        icon={Printer}
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Nhân công" value={formatMoney(summary.labor)} />
        <StatCard label="VT Chính" value={formatMoney(summary.materialMain)} />
        <StatCard label="VT Phụ" value={formatMoney(summary.materialSub)} />
        <StatCard label="VT MEP" value={formatMoney(summary.materialMep)} />
        <StatCard label="Thầu phụ" value={formatMoney(summary.subcontractor)} />
        <StatCard label="Vận hành" value={formatMoney(summary.operations)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bảng tổng hợp</CardTitle>
          <CardDescription>Chỉ lấy dữ liệu của công trình đang chọn.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "group", label: "Nhóm", render: (row) => row.group },
              { key: "rows", label: "Số dòng", render: (row) => row.rows },
              { key: "total", label: "Tổng tiền", render: (row) => formatMoney(row.total) },
            ]}
            rows={reportRows}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
