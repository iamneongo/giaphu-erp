"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import { ArrowLeft, PackagePlus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MaterialRow, MaterialType } from "@/lib/giaphu-erp/types";

import { DashboardLink } from "../../_components/dashboard-link";
import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, isoWeekFromDate, todayIso } from "../_lib/date-utils";
import { catalogOptions } from "../_lib/form-options";
import { ActionForm, type FormFieldDefinition, type FormPayload } from "./action-dialog";
import { ModuleHeader } from "./module-header";

type MaterialEditorPageProps = {
  materialType: MaterialType;
  mode: "create" | "edit";
  materialId?: string;
  listHref?: string;
};

function uniqueTextOptions(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((value) => ({ label: value, value }));
}

function materialListPath(pathname: string) {
  return pathname.replace(/\/(?:new|edit\/[^/]+)\/?$/, "");
}

function buildMaterialFields({
  activeProjectCode,
  materialType,
  row,
  categoryOptions,
  materialOptions,
  supplierOptions,
  unitOptions,
}: {
  activeProjectCode: string;
  materialType: MaterialType;
  row?: MaterialRow;
  categoryOptions: Array<{ label: string; value: string }>;
  materialOptions: Array<{ label: string; value: string }>;
  supplierOptions: Array<{ label: string; value: string }>;
  unitOptions: Array<{ label: string; value: string }>;
}): FormFieldDefinition[] {
  const date = row?.date || todayIso();

  return [
    { name: "id", label: "ID", type: "hidden", value: row?.id ?? "" },
    { name: "projectCode", label: "Công trình", type: "hidden", value: row?.projectCode || activeProjectCode },
    { name: "materialType", label: "Loại", type: "hidden", value: materialType },
    { name: "status", label: "Trạng thái", type: "hidden", value: row?.status || "Thêm tay" },
    { name: "date", label: "Ngày", type: "date", value: date, required: true },
    {
      name: "week",
      label: "Tuần",
      value: row?.week || isoWeekFromDate(date) || currentIsoWeek(),
      deriveValue: (payload) => isoWeekFromDate(String(payload.date ?? "")) || currentIsoWeek(),
      readOnly: true,
    },
    {
      name: "category",
      label: "Hạng mục",
      type: "select",
      value: row?.category ?? "",
      options: categoryOptions,
      required: true,
    },
    {
      name: "materialName",
      label: "Vật tư",
      type: "select",
      value: row?.materialName ?? "",
      options: materialOptions,
      required: true,
    },
    {
      name: "supplier",
      label: "NCC",
      type: "select",
      value: row?.supplier ?? "",
      options: supplierOptions,
      placeholder: "Chọn NCC từ danh mục",
      helperText: supplierOptions.length
        ? "Lấy thông tin từ Danh mục > Nhà cung cấp."
        : "Chưa có NCC. Vui lòng thêm ở Danh mục > Nhà cung cấp trước.",
      validate: (value) => {
        const supplier = value.trim();
        if (!supplierOptions.length) {
          return "Chưa có NCC trong danh mục. Vui lòng thêm nhà cung cấp trước.";
        }
        if (!supplier) return "Vui lòng chọn NCC từ danh mục nhà cung cấp.";
        if (!supplierOptions.some((option) => option.value === supplier)) {
          return "NCC phải được chọn từ danh mục nhà cung cấp.";
        }
        return undefined;
      },
    },
    { name: "quantity", label: "Số lượng", type: "number", value: row?.quantity ?? 1, required: true },
    {
      name: "unit",
      label: "Đơn vị",
      type: "select",
      value: row?.unit ?? "",
      options: unitOptions,
      required: true,
    },
    { name: "price", label: "Đơn giá", type: "number", value: row?.price ?? 0 },
    {
      name: "debt",
      label: "Công nợ",
      type: "select",
      value: row?.debt || "Không",
      options: [
        { label: "Không", value: "Không" },
        { label: "Có", value: "Có" },
      ],
    },
    {
      name: "paymentStatus",
      label: "Thanh toán",
      type: "select",
      value: row?.paymentStatus || "Đã TT",
      options: [
        { label: "Đã TT", value: "Đã TT" },
        { label: "Chưa TT", value: "Chưa TT" },
      ],
    },
    { name: "paymentInfo", label: "Ghi chú thanh toán", type: "textarea", value: row?.paymentInfo ?? "" },
  ];
}

export function MaterialEditorPage({ materialType, mode, materialId, listHref }: MaterialEditorPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProjectCode, data, runAction, scoped } = useGiaPhuErp();
  const [deleting, startDeleteTransition] = React.useTransition();
  const resolvedListHref = listHref ?? materialListPath(pathname);
  const numericMaterialId = Number(materialId ?? 0);
  const editingRow =
    mode === "edit"
      ? data.materials.find((row) => row.id === numericMaterialId && row.materialType === materialType)
      : undefined;
  const categoryOptions = React.useMemo(() => catalogOptions(data.catalogs.hangMuc), [data.catalogs.hangMuc]);
  const materialOptions = React.useMemo(
    () => catalogOptions(materialType === "VT Chính" ? data.catalogs.vatTu : data.catalogs.vatTuPhu),
    [data.catalogs.vatTu, data.catalogs.vatTuPhu, materialType],
  );
  const supplierOptions = React.useMemo(() => catalogOptions(data.catalogs.nhaCungCap), [data.catalogs.nhaCungCap]);
  const unitOptions = React.useMemo(
    () =>
      uniqueTextOptions([
        ...data.catalogs.vatTu.map((item) => item.unit),
        ...data.catalogs.vatTuPhu.map((item) => item.unit),
        ...scoped.materials.map((item) => item.unit),
        "bao",
        "m3",
        "kg",
        "cái",
        "bộ",
        "m",
        "m2",
        "viên",
      ]),
    [data.catalogs.vatTu, data.catalogs.vatTuPhu, scoped.materials],
  );
  const fields = React.useMemo(
    () =>
      buildMaterialFields({
        activeProjectCode,
        materialType,
        row: editingRow,
        categoryOptions,
        materialOptions,
        supplierOptions,
        unitOptions,
      }),
    [activeProjectCode, categoryOptions, editingRow, materialOptions, materialType, supplierOptions, unitOptions],
  );

  async function saveMaterial(action: string, payload: FormPayload) {
    const result = await runAction(action, { ...payload, __returnData: false });
    if (result === false) return false;

    router.push(resolvedListHref);
    router.refresh();
    return result;
  }

  function deleteMaterial() {
    if (!editingRow) return;
    if (!window.confirm(`Xóa dòng vật tư "${editingRow.materialName}"?`)) return;

    startDeleteTransition(async () => {
      const result = await runAction("deleteMaterial", { id: editingRow.id, __returnData: false });
      if (result === false) return;

      router.push(resolvedListHref);
      router.refresh();
    });
  }

  if (mode === "edit" && !editingRow) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <ModuleHeader
          title="Không tìm thấy dòng vật tư"
          description="Dòng vật tư này không tồn tại, đã bị xóa hoặc không thuộc loại vật tư hiện tại."
          icon={PackagePlus}
          actions={
            <Button asChild size="sm" variant="outline">
              <DashboardLink href={resolvedListHref}>
                <ArrowLeft />
                Quay lại danh sách
              </DashboardLink>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={mode === "edit" ? `Sửa ${materialType}` : `Thêm ${materialType}`}
        description="Trang nhập liệu riêng cho các dòng vật tư nhiều thông tin, dễ mở rộng thêm trường xử lý sau này."
        icon={PackagePlus}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <DashboardLink href={resolvedListHref}>
                <ArrowLeft />
                Quay lại danh sách
              </DashboardLink>
            </Button>
            {editingRow ? (
              <Button disabled={deleting} size="sm" variant="destructive" onClick={deleteMaterial}>
                {deleting ? <RefreshCw className="animate-spin" /> : <Trash2 />}
                Xóa dòng này
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{mode === "edit" ? editingRow?.materialName : `Dòng ${materialType} mới`}</CardTitle>
          <CardDescription>
            Chọn hạng mục, vật tư, nhà cung cấp, số lượng, đơn vị, đơn giá và trạng thái thanh toán.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ActionForm
            action="saveMaterial"
            fields={fields}
            fieldGroupClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            submitLabel={mode === "edit" ? "Lưu thay đổi" : "Tạo dòng vật tư"}
            onAction={saveMaterial}
          />
        </CardContent>
      </Card>
    </div>
  );
}
