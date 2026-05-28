"use client";

import { useAuth } from "@clerk/nextjs";
import { BookOpen, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";
import { buildNextCatalogCode } from "@/lib/giaphu-erp/catalog-codes";
import { isValidPhoneNumber } from "@/lib/giaphu-erp/phone";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import type { CatalogKind } from "../_lib/catalog-config";
import { getCatalogSectionByKind } from "../_lib/catalog-config";
import { uniqueOptions } from "../_lib/form-options";
import { ActionDialog, type FormFieldDefinition } from "./action-dialog";
import { DataTable, type DataTableColumn } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

export function CatalogsWorkspace({ kind }: { kind: CatalogKind }) {
  const { data, isSwitchingProject, runAction } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const section = getCatalogSectionByKind(kind);
  const rows = data.catalogs[kind];
  const requiresPhoneContact = kind === "thauPhu" || kind === "nhaCungCap";
  const contactField: FormFieldDefinition = {
    name: "contact",
    label: "Liên hệ",
    required: requiresPhoneContact,
    type: "tel",
    inputMode: "tel",
    placeholder: "Ví dụ: 0901234567",
    validate: (value) => {
      if (!requiresPhoneContact || !value.trim()) return undefined;
      return isValidPhoneNumber(value) ? undefined : "Liên hệ phải là số điện thoại hợp lệ.";
    },
  };
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
    {
      name: "code",
      label: section.codeLabel,
      value: buildNextCatalogCode(
        kind,
        rows.map((row) => row.code),
      ),
      required: true,
    },
    { name: "name", label: section.nameLabel, required: true },
  ];

  if (section.showUnit) {
    fields.push({ name: "unit", label: "Đơn vị", required: true });
  }

  if (section.showContact) {
    fields.push(contactField);
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
    columns.push({
      key: "contact",
      label: "Liên hệ",
      accessor: (row) => row.contact,
      render: (row) => row.contact || "-",
    });
  }

  columns.push({ key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" });

  if (canManage) {
    columns.push({
      key: "actions",
      label: "Thao tác",
      hideable: false,
      searchable: false,
      sortable: false,
      render: (row) => (
        <div className="flex justify-end">
          <TableRowActions
            edit={{
              title: `Sửa ${section.navigationTitle.toLowerCase()}`,
              action: "manageCatalog",
              onAction: runAction,
              fields: [
                { name: "originalId", label: "ID", type: "hidden", value: row.id },
                { name: "kind", label: "Loại danh mục", type: "hidden", value: section.kind },
                { name: "code", label: section.codeLabel, required: true, value: row.code },
                { name: "name", label: section.nameLabel, required: true, value: row.name },
                ...(section.showUnit ? [{ name: "unit", label: "Đơn vị", required: true, value: row.unit }] : []),
                ...(section.showContact ? [{ ...contactField, value: row.contact }] : []),
                { name: "note", label: section.noteLabel, type: "textarea" as const, value: row.note },
              ],
            }}
            actions={[
              {
                label: "Xóa",
                icon: Trash2,
                destructive: true,
                onSelect: () => {
                  if (window.confirm(`Xóa "${row.name}" khỏi danh mục?`)) {
                    return runAction("deleteCatalog", { id: row.id });
                  }
                },
              },
            ]}
          />
        </div>
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ModuleHeader
        title={section.title}
        description={section.description}
        icon={BookOpen}
        actions={
          canManage ? (
            <ActionDialog
              title={`Thêm ${section.navigationTitle.toLowerCase()}`}
              button={section.navigationTitle}
              icon={Plus}
              action="manageCatalog"
              onAction={runAction}
              fields={fields}
            />
          ) : undefined
        }
      />

      <SectionBlock title={section.navigationTitle} meta={<Badge variant="outline">{rows.length} mục</Badge>}>
        <DataTable
          loading={isSwitchingProject}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          selectable
          exportFileName={`danh-muc-${section.kind}`}
          searchPlaceholder={`Tìm ${section.navigationTitle.toLowerCase()}...`}
          filters={[
            ...(section.showUnit
              ? [{ key: "unit", label: "Đơn vị", options: uniqueOptions(rows.map((row) => row.unit)) }]
              : []),
            ...(section.showContact
              ? [{ key: "contact", label: "Liên hệ", options: uniqueOptions(rows.map((row) => row.contact)) }]
              : []),
          ]}
        />
      </SectionBlock>
    </div>
  );
}
