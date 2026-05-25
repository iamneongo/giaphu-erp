"use client";

import { BookOpen, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import type { CatalogKind } from "../_lib/catalog-config";
import { getCatalogSectionByKind } from "../_lib/catalog-config";
import { ActionDialog, type FormFieldDefinition } from "./action-dialog";
import { DataTable, type DataTableColumn } from "./data-table";
import { ModuleHeader } from "./module-header";

export function CatalogsWorkspace({ kind }: { kind: CatalogKind }) {
  const { data, runAction } = useGiaPhuErp();
  const section = getCatalogSectionByKind(kind);
  const rows = data.catalogs[kind];
  const fields: FormFieldDefinition[] = [
    { name: "kind", label: "Loại danh mục", type: "hidden", value: section.kind },
    { name: "code", label: section.codeLabel },
    { name: "name", label: section.nameLabel, required: true },
  ];

  if (section.showUnit) {
    fields.push({ name: "unit", label: "Đơn vị" });
  }

  if (section.showContact) {
    fields.push({ name: "contact", label: "Liên hệ" });
  }

  fields.push({ name: "note", label: section.noteLabel, type: "textarea" });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: "code", label: "Mã", render: (row) => row.code || "-" },
    { key: "name", label: "Tên", render: (row) => row.name || "-" },
  ];

  if (section.showUnit) {
    columns.push({ key: "unit", label: "Đơn vị", render: (row) => row.unit || "-" });
  }

  if (section.showContact) {
    columns.push({ key: "contact", label: "Liên hệ", render: (row) => row.contact || "-" });
  }

  columns.push({ key: "note", label: "Ghi chú", render: (row) => row.note || "-" });

  return (
    <div className="space-y-4">
      <ModuleHeader
        title={section.title}
        description={section.description}
        icon={BookOpen}
        actions={
          <ActionDialog
            title={`Thêm ${section.navigationTitle.toLowerCase()}`}
            button={section.navigationTitle}
            icon={Plus}
            action="manageCatalog"
            onAction={runAction}
            fields={fields}
          />
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>{section.navigationTitle}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </div>
          <Badge variant="outline">{rows.length} mục</Badge>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} getRowId={(row) => row.id} />
        </CardContent>
      </Card>
    </div>
  );
}
