"use client";

import * as React from "react";

import { useAuth } from "@clerk/nextjs";
import { Check, ClipboardList, PackagePlus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import {
  catalogOptions,
  materialTypeOptions,
  paymentStatusOptions,
  shiftOptions,
  uniqueOptions,
} from "../_lib/form-options";
import { formatCount, formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type MaterialsSection = "entries" | "norms";

export function MaterialsWorkspace({ section = "entries" }: { section?: MaterialsSection }) {
  const { data, activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const [materialPrices, setMaterialPrices] = React.useState<Record<number, string>>({});
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.materialsManage,
  );

  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const materialOptions = [...catalogOptions(data.catalogs.vatTu), ...catalogOptions(data.catalogs.vatTuPhu)];
  const supplierOptions = catalogOptions(data.catalogs.nhaCungCap);
  const weekFilterOptions = uniqueOptions(scoped.materials.map((row) => row.week));
  const categoryFilterOptions = uniqueOptions(scoped.materials.map((row) => row.category));
  const supplierFilterOptions = uniqueOptions(scoped.materials.map((row) => row.supplier));

  const actions = {
    entries: (
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
    ),
    norms: (
      <ActionDialog
        title="Định mức vật tư"
        button="Định mức"
        icon={ClipboardList}
        action="saveMaterialNorm"
        onAction={runAction}
        fields={[
          { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
          { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, required: true },
          { name: "materialType", label: "Loại", type: "select", options: materialTypeOptions, required: true },
          { name: "materialName", label: "Vật tư", type: "select", options: materialOptions, required: true },
          { name: "unit", label: "Đơn vị", required: true },
          { name: "dailyNorm", label: "Định mức ngày", type: "number", required: true },
          { name: "weeklyNorm", label: "Định mức tuần", type: "number", required: true },
          { name: "warningPercent", label: "Cảnh báo %", type: "number", value: 10, required: true },
        ]}
      />
    ),
  } satisfies Record<MaterialsSection, React.ReactNode>;

  const sections = {
    entries: {
      title: "Vật tư phát sinh",
      description: "Nhập phát sinh vật tư, theo dõi công nợ và cập nhật nhanh trạng thái thanh toán.",
      content: (
        <SectionBlock title="Lịch sử vật tư">
          <DataTable
            loading={isSwitchingProject}
            columns={[
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
                render: (row) => row.category || "-",
              },
              {
                key: "materialName",
                label: "Vật tư",
                accessor: (row) => row.materialName,
                render: (row) => (
                  <div>
                    <div className="font-medium">{row.materialName || "-"}</div>
                    <div className="text-muted-foreground text-xs">{row.supplier || "-"}</div>
                  </div>
                ),
              },
              {
                key: "quantity",
                label: "SL",
                accessor: (row) => row.quantity,
                exportValue: (row) => `${row.quantity} ${row.unit}`,
                render: (row) => `${formatCount(row.quantity)} ${row.unit}`,
              },
              {
                key: "price",
                label: "Đơn giá",
                accessor: (row) => row.price,
                exportValue: (row) => formatMoney(Number(materialPrices[row.id] ?? row.price ?? 0)),
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
                accessor: (row) => row.quantity * Number(materialPrices[row.id] ?? row.price ?? 0),
                exportValue: (row) => formatMoney(row.quantity * Number(materialPrices[row.id] ?? row.price ?? 0)),
                render: (row) => formatMoney(row.quantity * Number(materialPrices[row.id] ?? row.price ?? 0)),
              },
              {
                key: "paymentStatus",
                label: "TT",
                accessor: (row) => row.paymentStatus,
                render: (row) => (
                  <Badge variant={row.paymentStatus === "Đã TT" ? "default" : "destructive"}>{row.paymentStatus}</Badge>
                ),
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Cập nhật",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.materials)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa vật tư",
                              action: "saveMaterial",
                              onAction: runAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                { name: "date", label: "Ngày", type: "date", value: row.date || todayIso() },
                                { name: "week", label: "Tuần", value: row.week || currentIsoWeek() },
                                {
                                  name: "shift",
                                  label: "Buổi",
                                  type: "select",
                                  options: shiftOptions,
                                  value: row.shift,
                                },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: categoryOptions,
                                  value: row.category,
                                },
                                {
                                  name: "materialType",
                                  label: "Loại vật tư",
                                  type: "select",
                                  options: materialTypeOptions,
                                  value: row.materialType,
                                },
                                {
                                  name: "materialName",
                                  label: "Vật tư",
                                  type: "select",
                                  options: materialOptions,
                                  value: row.materialName,
                                },
                                {
                                  name: "supplier",
                                  label: "Nhà cung cấp",
                                  type: "select",
                                  options: supplierOptions,
                                  value: row.supplier,
                                },
                                { name: "quantity", label: "Số lượng", type: "number", value: row.quantity },
                                { name: "unit", label: "Đơn vị", value: row.unit },
                                { name: "price", label: "Đơn giá", type: "number", value: row.price },
                                {
                                  name: "paymentStatus",
                                  label: "TT thanh toán",
                                  type: "select",
                                  options: paymentStatusOptions,
                                  value: row.paymentStatus,
                                },
                                { name: "debt", label: "Công nợ", value: row.debt },
                                { name: "status", label: "Trạng thái", value: row.status },
                                {
                                  name: "paymentInfo",
                                  label: "Thông tin TT",
                                  type: "textarea",
                                  value: row.paymentInfo,
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Lưu đơn giá",
                                onSelect: () => {
                                  return runAction("updateMaterialPrice", {
                                    id: row.id,
                                    price: materialPrices[row.id] ?? row.price,
                                  });
                                },
                              },
                              {
                                label: "Đánh dấu đã thanh toán",
                                icon: Check,
                                onSelect: () => {
                                  return runAction("markMaterialPaid", {
                                    id: row.id,
                                    paymentInfo: `Đã TT · ${todayIso()}`,
                                  });
                                },
                              },
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa dòng vật tư "${row.materialName || row.id}"?`)) {
                                    return runAction("deleteMaterial", { id: row.id });
                                  }
                                },
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={scoped.materials}
            getRowId={(row) => row.id}
            selectable
            exportFileName="vat-tu-phat-sinh"
            searchPlaceholder="Tìm vật tư, NCC, hạng mục..."
            filters={[
              { key: "week", label: "Tuần", options: weekFilterOptions },
              { key: "materialType", label: "Loại", options: materialTypeOptions },
              { key: "paymentStatus", label: "Thanh toán", options: paymentStatusOptions },
              { key: "category", label: "Hạng mục", options: categoryFilterOptions },
              { key: "supplier", label: "NCC", options: supplierFilterOptions, accessor: (row) => row.supplier },
            ]}
            initialSorting={[{ id: "date", desc: true }]}
          />
        </SectionBlock>
      ),
    },
    norms: {
      title: "Định mức vật tư",
      description: "Thiết lập ngưỡng định mức vật tư theo hạng mục để đối chiếu với chi phí phát sinh.",
      content: (
        <SectionBlock title="Định mức vật tư">
          <DataTable
            loading={isSwitchingProject}
            columns={[
              { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category },
              {
                key: "materialName",
                label: "Vật tư",
                accessor: (row) => row.materialName,
                render: (row) => row.materialName,
              },
              {
                key: "materialType",
                label: "Loại",
                accessor: (row) => row.materialType,
                render: (row) => row.materialType,
              },
              {
                key: "dailyNorm",
                label: "ĐM ngày",
                accessor: (row) => row.dailyNorm,
                exportValue: (row) => `${row.dailyNorm} ${row.unit}`,
                render: (row) => `${formatCount(row.dailyNorm)} ${row.unit}`,
              },
              {
                key: "weeklyNorm",
                label: "ĐM tuần",
                accessor: (row) => row.weeklyNorm,
                exportValue: (row) => `${row.weeklyNorm} ${row.unit}`,
                render: (row) => `${formatCount(row.weeklyNorm)} ${row.unit}`,
              },
              {
                key: "warningPercent",
                label: "Cảnh báo",
                accessor: (row) => row.warningPercent,
                exportValue: (row) => `${row.warningPercent}%`,
                render: (row) => `${formatCount(row.warningPercent)}%`,
              },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Thao tác",
                      hideable: false,
                      searchable: false,
                      sortable: false,
                      render: (row: (typeof scoped.materialNorms)[number]) => (
                        <div className="flex justify-end">
                          <TableRowActions
                            edit={{
                              title: "Sửa định mức vật tư",
                              action: "saveMaterialNorm",
                              onAction: runAction,
                              fields: [
                                { name: "id", label: "ID", type: "hidden", value: row.id },
                                { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                {
                                  name: "category",
                                  label: "Hạng mục",
                                  type: "select",
                                  options: categoryOptions,
                                  value: row.category,
                                  required: true,
                                },
                                {
                                  name: "materialType",
                                  label: "Loại",
                                  type: "select",
                                  options: materialTypeOptions,
                                  value: row.materialType,
                                  required: true,
                                },
                                {
                                  name: "materialName",
                                  label: "Vật tư",
                                  type: "select",
                                  options: materialOptions,
                                  value: row.materialName,
                                  required: true,
                                },
                                { name: "unit", label: "Đơn vị", value: row.unit, required: true },
                                {
                                  name: "dailyNorm",
                                  label: "Định mức ngày",
                                  type: "number",
                                  value: row.dailyNorm,
                                  required: true,
                                },
                                {
                                  name: "weeklyNorm",
                                  label: "Định mức tuần",
                                  type: "number",
                                  value: row.weeklyNorm,
                                  required: true,
                                },
                                {
                                  name: "warningPercent",
                                  label: "Cảnh báo %",
                                  type: "number",
                                  value: row.warningPercent,
                                  required: true,
                                },
                              ],
                            }}
                            actions={[
                              {
                                label: "Xóa",
                                icon: Trash2,
                                destructive: true,
                                onSelect: () => {
                                  if (window.confirm(`Xóa định mức vật tư "${row.materialName}"?`)) {
                                    return runAction("deleteMaterialNorm", { id: row.id });
                                  }
                                },
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={scoped.materialNorms}
            getRowId={(row) => row.id}
            selectable
            exportFileName="dinh-muc-vat-tu"
            searchPlaceholder="Tìm vật tư định mức..."
            filters={[
              {
                key: "category",
                label: "Hạng mục",
                options: uniqueOptions(scoped.materialNorms.map((row) => row.category)),
              },
              { key: "materialType", label: "Loại", options: materialTypeOptions },
            ]}
          />
        </SectionBlock>
      ),
    },
  } satisfies Record<
    MaterialsSection,
    {
      title: string;
      description: string;
      content: React.ReactNode;
    }
  >;

  const currentSection = sections[section];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={currentSection.title}
        description={currentSection.description}
        icon={PackagePlus}
        actions={canManage ? actions[section] : undefined}
      />
      {currentSection.content}
    </div>
  );
}
