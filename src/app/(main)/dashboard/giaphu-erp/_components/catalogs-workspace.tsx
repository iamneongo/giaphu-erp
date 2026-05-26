"use client";

import { useAuth } from "@clerk/nextjs";
import { BookOpen, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import type { CatalogKind } from "../_lib/catalog-config";
import { getCatalogSectionByKind } from "../_lib/catalog-config";
import { uniqueOptions } from "../_lib/form-options";
import { ActionDialog, type FormFieldDefinition } from "./action-dialog";
import { DataTable, type DataTableColumn } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";

export function CatalogsWorkspace({ kind }: { kind: CatalogKind }) {
  const { data, runAction } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const section = getCatalogSectionByKind(kind);
  const rows = data.catalogs[kind];
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.catalogsManage,
  );
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
    { key: "code", label: "Mã", accessor: (row) => row.code, render: (row) => row.code || "-" },
    { key: "name", label: "Tên", accessor: (row) => row.name, render: (row) => row.name || "-" },
  ];

  if (section.showUnit) {
    columns.push({ key: "unit", label: "Đơn vị", accessor: (row) => row.unit, render: (row) => row.unit || "-" });
  }

  if (section.showContact) {
    columns.push({ key: "contact", label: "Liên hệ", accessor: (row) => row.contact, render: (row) => row.contact || "-" });
  }

  columns.push({ key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" });

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={section.title}
        description={section.description}
        icon={BookOpen}
        actions={canManage ? (
          <ActionDialog
            title={`Thêm ${section.navigationTitle.toLowerCase()}`}
            button={section.navigationTitle}
            icon={Plus}
            action="manageCatalog"
            onAction={runAction}
            fields={fields}
          />
        ) : undefined}
      />

      <SectionBlock title={section.navigationTitle} meta={<Badge variant="outline">{rows.length} mục</Badge>}>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            selectable
            exportFileName={`danh-muc-${section.kind}`}
            searchPlaceholder={`Tìm ${section.navigationTitle.toLowerCase()}...`}
            filters={[
              ...(section.showUnit ? [{ key: "unit", label: "Đơn vị", options: uniqueOptions(rows.map((row) => row.unit)) }] : []),
              ...(section.showContact ? [{ key: "contact", label: "Liên hệ", options: uniqueOptions(rows.map((row) => row.contact)) }] : []),
            ]}
          />
      </SectionBlock>
    </div>
  );
}
