"use client";

import * as React from "react";

import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, CircleDollarSign, Receipt, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import type { MaterialRow } from "@/lib/giaphu-erp/types";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { usePaginatedErpRows } from "../_hooks/use-paginated-erp-rows";
import { uniqueOptions } from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import { DataTable, type DataTableColumn } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

function materialTotal(row: MaterialRow) {
  return Number(row.quantity || 0) * Number(row.price || 0);
}

function isUnpaid(row: MaterialRow) {
  return row.paymentStatus !== "Đã TT" || row.debt === "Có";
}

function DebtMetricCard({
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

function buildColumns({
  canManage,
  runAction,
  refresh,
}: {
  canManage: boolean;
  runAction: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  refresh: () => void;
}): DataTableColumn<MaterialRow>[] {
  return [
    { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
    { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
    {
      key: "materialType",
      label: "Loại",
      accessor: (row) => row.materialType,
      render: (row) => <Badge variant="secondary">{row.materialType}</Badge>,
    },
    {
      key: "category",
      label: "Hạng mục",
      accessor: (row) => row.category,
      render: (row) => <span className="block max-w-48 truncate">{row.category || "-"}</span>,
    },
    {
      key: "materialName",
      label: "Vật tư",
      accessor: (row) => row.materialName,
      render: (row) => <span className="block max-w-64 truncate font-medium">{row.materialName || "-"}</span>,
    },
    {
      key: "supplier",
      label: "Nhà CC",
      accessor: (row) => row.supplier,
      render: (row) => <span className="block max-w-56 truncate">{row.supplier || "-"}</span>,
    },
    {
      key: "quantity",
      label: "SL",
      accessor: (row) => row.quantity,
      render: (row) => `${formatCount(row.quantity)} ${row.unit || ""}`.trim(),
    },
    {
      key: "price",
      label: "Đơn giá",
      accessor: (row) => row.price,
      render: (row) => formatMoney(row.price),
    },
    {
      key: "total",
      label: "Thành tiền",
      accessor: (row) => materialTotal(row),
      render: (row) => <span className="font-medium">{formatMoney(materialTotal(row))}</span>,
    },
    {
      key: "paymentStatus",
      label: "TT",
      accessor: (row) => row.paymentStatus,
      render: (row) => (
        <Badge className="bg-amber-50 text-amber-700 ring-1 ring-amber-200" variant="outline">
          {row.paymentStatus || "Chưa TT"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "Thao tác",
            hideable: false,
            searchable: false,
            sortable: false,
            render: (row: MaterialRow) => (
              <div className="flex justify-end">
                <TableRowActions
                  edit={{
                    title: "Cập nhật đơn giá vật tư",
                    action: "updateMaterialPrice",
                    onAction: async (action, payload) => {
                      await runAction(action, { ...payload, __returnData: false });
                      refresh();
                    },
                    fields: [
                      { name: "id", label: "ID", type: "hidden", value: row.id },
                      { name: "price", label: "Đơn giá", type: "number", value: row.price },
                    ],
                  }}
                  actions={[
                    {
                      label: "Đánh dấu đã TT",
                      icon: CheckCircle2,
                      onSelect: async () => {
                        await runAction("markMaterialPaid", { id: row.id, __returnData: false });
                        refresh();
                      },
                    },
                    {
                      label: "Xóa",
                      icon: Trash2,
                      destructive: true,
                      onSelect: async () => {
                        if (!window.confirm(`Xóa dòng vật tư "${row.materialName}"?`)) return;
                        await runAction("deleteMaterial", { id: row.id, __returnData: false });
                        refresh();
                      },
                    },
                  ]}
                />
              </div>
            ),
          } satisfies DataTableColumn<MaterialRow>,
        ]
      : []),
  ];
}

export function MaterialDebtWorkspace() {
  const { activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.materialsManage,
  );
  const debtFixedFilters = React.useMemo(() => ({ paymentStatus: "Chưa TT" }), []);
  const paginatedDebt = usePaginatedErpRows<MaterialRow>({
    dataset: "materials",
    projectCode: activeProjectCode,
    initialRows: scoped.materials.filter(isUnpaid),
    fixedFilters: debtFixedFilters,
  });
  const debtRowsForStats = scoped.materials.filter(isUnpaid);
  const debtTotal = debtRowsForStats.reduce((total, row) => total + materialTotal(row), 0);
  const supplierCount = new Set(debtRowsForStats.map((row) => row.supplier).filter(Boolean)).size;
  const weekOptions = uniqueOptions(scoped.materials.map((row) => row.week));
  const categoryOptions = uniqueOptions(scoped.materials.map((row) => row.category));
  const supplierOptions = uniqueOptions(scoped.materials.map((row) => row.supplier));
  const materialTypeOptions = uniqueOptions(scoped.materials.map((row) => row.materialType));

  return (
    <div className="space-y-6">
      <ModuleHeader title="Công nợ vật tư" icon={CircleDollarSign} />

      <div className="grid gap-3 md:grid-cols-3">
        <DebtMetricCard
          title="Tổng công nợ"
          value={formatMoney(debtTotal)}
          hint="Tổng vật tư đang Chưa TT"
          footer="Tổng giá trị vật tư còn mở theo dữ liệu công trình hiện tại."
          icon={CircleDollarSign}
        />
        <DebtMetricCard
          title="Dòng chưa thanh toán"
          value={formatCount(debtRowsForStats.length)}
          hint="Theo dữ liệu công trình hiện tại"
          footer="Số dòng vật tư chưa hoàn tất thanh toán trong công trình."
          icon={Receipt}
        />
        <DebtMetricCard
          title="Nhà cung cấp"
          value={formatCount(supplierCount)}
          hint="Số NCC còn công nợ mở"
          footer="Nhà cung cấp đang có ít nhất một dòng vật tư chưa thanh toán."
          icon={CheckCircle2}
        />
      </div>

      <Separator />

      <SectionBlock title="Bảng công nợ vật tư">
        <DataTable
          key={`material-debt-${activeProjectCode}`}
          loading={isSwitchingProject}
          columns={buildColumns({ canManage, runAction, refresh: paginatedDebt.refresh })}
          rows={paginatedDebt.rows}
          getRowId={(row) => row.id}
          serverSide={paginatedDebt.serverSide}
          searchPlaceholder="Tìm vật tư, hạng mục, nhà cung cấp..."
          filters={[
            { key: "week", label: "Tuần", options: weekOptions },
            { key: "category", label: "Hạng mục", options: categoryOptions },
            { key: "supplier", label: "Nhà CC", options: supplierOptions },
            { key: "materialType", label: "Loại", options: materialTypeOptions },
          ]}
          exportFileName="cong-no-vat-tu"
          detailType="materials"
          selectable
          initialSorting={[{ id: "date", desc: true }]}
        />
      </SectionBlock>
    </div>
  );
}
