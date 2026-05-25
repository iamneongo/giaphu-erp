"use client";

import * as React from "react";

import { Check, ClipboardList, PackagePlus, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, materialTypeOptions, paymentStatusOptions, shiftOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";

export function MaterialsWorkspace() {
  const { data, activeProjectCode, runAction, scoped } = useGiaPhuErp();
  const [materialPrices, setMaterialPrices] = React.useState<Record<number, string>>({});

  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const materialOptions = [...catalogOptions(data.catalogs.vatTu), ...catalogOptions(data.catalogs.vatTuPhu)];
  const supplierOptions = catalogOptions(data.catalogs.nhaCungCap);

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Vật tư và công nợ"
        description="Nhập phát sinh vật tư, theo dõi thanh toán công nợ và kiểm soát định mức."
        icon={PackagePlus}
        actions={
          <>
            <ActionDialog
              title="Nhập vật tư"
              button="Vật tư"
              icon={PackagePlus}
              action="saveMaterial"
              onAction={runAction}
              fields={[
                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                { name: "date", label: "Ngày", type: "date", value: todayIso() },
                { name: "week", label: "Tuần", value: currentIsoWeek() },
                { name: "shift", label: "Buổi", type: "select", options: shiftOptions },
                { name: "category", label: "Hạng mục", type: "select", options: categoryOptions },
                { name: "materialType", label: "Loại vật tư", type: "select", options: materialTypeOptions },
                { name: "materialName", label: "Vật tư", type: "select", options: materialOptions },
                { name: "supplier", label: "Nhà cung cấp", type: "select", options: supplierOptions },
                { name: "quantity", label: "Số lượng", type: "number" },
                { name: "unit", label: "Đơn vị" },
                { name: "price", label: "Đơn giá", type: "number" },
                { name: "paymentStatus", label: "TT thanh toán", type: "select", options: paymentStatusOptions },
                { name: "debt", label: "Công nợ" },
                { name: "status", label: "Trạng thái" },
                { name: "paymentInfo", label: "Thông tin TT", type: "textarea" },
              ]}
            />
            <ActionDialog
              title="Định mức vật tư"
              button="Định mức"
              icon={ClipboardList}
              action="saveMaterialNorm"
              onAction={runAction}
              fields={[
                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                { name: "category", label: "Hạng mục", type: "select", options: categoryOptions },
                { name: "materialType", label: "Loại", type: "select", options: materialTypeOptions },
                { name: "materialName", label: "Vật tư", type: "select", options: materialOptions },
                { name: "unit", label: "Đơn vị" },
                { name: "dailyNorm", label: "Định mức ngày", type: "number" },
                { name: "weeklyNorm", label: "Định mức tuần", type: "number" },
                { name: "warningPercent", label: "Cảnh báo %", type: "number", value: 10 },
              ]}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "date", label: "Ngày", render: (row) => row.date || "-" },
              { key: "week", label: "Tuần", render: (row) => row.week || "-" },
              { key: "type", label: "Loại", render: (row) => <Badge variant="secondary">{row.materialType}</Badge> },
              { key: "category", label: "Hạng mục", render: (row) => row.category || "-" },
              {
                key: "name",
                label: "Vật tư",
                render: (row) => (
                  <div>
                    <div className="font-medium">{row.materialName || "-"}</div>
                    <div className="text-muted-foreground text-xs">{row.supplier || "-"}</div>
                  </div>
                ),
              },
              { key: "quantity", label: "SL", render: (row) => `${formatMoney(row.quantity)} ${row.unit}` },
              {
                key: "price",
                label: "Đơn giá",
                render: (row) => {
                  const draft = materialPrices[row.id] ?? String(row.price);
                  return (
                    <Input
                      className="w-28"
                      value={draft}
                      onChange={(event) =>
                        setMaterialPrices((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                    />
                  );
                },
              },
              {
                key: "total",
                label: "Thành tiền",
                render: (row) => formatMoney(row.quantity * Number(materialPrices[row.id] ?? row.price ?? 0)),
              },
              {
                key: "paid",
                label: "TT",
                render: (row) => (
                  <Badge variant={row.paymentStatus === "Đã TT" ? "default" : "destructive"}>{row.paymentStatus}</Badge>
                ),
              },
              {
                key: "actions",
                label: "Cập nhật",
                render: (row) => (
                  <div className="flex gap-2">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        runAction("updateMaterialPrice", { id: row.id, price: materialPrices[row.id] ?? row.price })
                      }
                    >
                      <Save />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        runAction("markMaterialPaid", { id: row.id, paymentInfo: `Đã TT · ${todayIso()}` })
                      }
                    >
                      <Check />
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={scoped.materials}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Định mức vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "category", label: "Hạng mục", render: (row) => row.category },
              { key: "material", label: "Vật tư", render: (row) => row.materialName },
              { key: "type", label: "Loại", render: (row) => row.materialType },
              { key: "daily", label: "ĐM ngày", render: (row) => `${formatMoney(row.dailyNorm)} ${row.unit}` },
              { key: "weekly", label: "ĐM tuần", render: (row) => `${formatMoney(row.weeklyNorm)} ${row.unit}` },
              { key: "warning", label: "Cảnh báo", render: (row) => `${formatMoney(row.warningPercent)}%` },
            ]}
            rows={scoped.materialNorms}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
