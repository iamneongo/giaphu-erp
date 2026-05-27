"use client";

import { useAuth } from "@clerk/nextjs";
import { Banknote, FileText, Hammer, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessClerkPermission, ERP_PERMISSIONS } from "@/lib/clerk/erp-rbac-shared";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions, uniqueOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";
import { SectionBlock } from "./section-block";
import { TableRowActions } from "./table-row-actions";

type SubcontractorsSection = "advances" | "contracts" | "operations";

export function SubcontractorsWorkspace({ section = "advances" }: { section?: SubcontractorsSection }) {
  const { data, activeProjectCode, isSwitchingProject, runAction, scoped } = useGiaPhuErp();
  const { has, orgRole } = useAuth();
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const contractorOptions = catalogOptions(data.catalogs.thauPhu);
  const subcontractorWeekOptions = uniqueOptions(scoped.subcontractors.map((row) => row.week));
  const subcontractorCategoryOptions = uniqueOptions(scoped.subcontractors.map((row) => row.category));
  const subcontractorNameOptions = uniqueOptions(scoped.subcontractors.map((row) => row.contractorName));
  const subcontractorStatusOptions = uniqueOptions(scoped.subcontractorContracts.map((row) => row.status));
  const operationWeekOptions = uniqueOptions(scoped.operations.map((row) => row.week));
  const canManage = canAccessClerkPermission(
    {
      orgRole,
      hasRole: (role) => has?.({ role }) ?? false,
      hasPermission: (permission) => has?.({ permission }) ?? false,
    },
    ERP_PERMISSIONS.subcontractorsManage,
  );

  const actions = {
    advances: (
      <ActionDialog
        title="Tạm ứng thầu phụ"
        button="Tạm ứng"
        icon={Hammer}
        action="saveSubcontractor"
        onAction={runAction}
        fields={[
          { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
          { name: "date", label: "Ngày", type: "date", value: todayIso() },
          { name: "week", label: "Tuần", value: currentIsoWeek() },
          { name: "category", label: "Hạng mục", type: "select", options: categoryOptions },
          { name: "contractorName", label: "Thầu phụ", type: "select", options: contractorOptions },
          { name: "advance", label: "Tạm ứng", type: "number" },
          { name: "note", label: "Diễn giải", type: "textarea" },
        ]}
      />
    ),
    contracts: (
      <ActionDialog
        title="Hợp đồng thầu phụ"
        button="HĐ thầu phụ"
        icon={FileText}
        action="saveSubcontractorContract"
        onAction={runAction}
        fields={[
          { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
          { name: "contractorName", label: "Thầu phụ", type: "select", options: contractorOptions },
          { name: "approvedCost", label: "Tổng chi phí dự kiến", type: "number" },
          { name: "status", label: "Trạng thái", value: "Chờ duyệt" },
          { name: "note", label: "Ghi chú", type: "textarea" },
        ]}
      />
    ),
    operations: (
      <ActionDialog
        title="Chi phí vận hành"
        button="Vận hành"
        icon={Banknote}
        action="saveOperation"
        onAction={runAction}
        fields={[
          { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
          { name: "date", label: "Ngày", type: "date", value: todayIso() },
          { name: "week", label: "Tuần", value: currentIsoWeek() },
          { name: "description", label: "Diễn giải", required: true },
          { name: "amount", label: "Số tiền", type: "number" },
        ]}
      />
    ),
  } satisfies Record<SubcontractorsSection, React.ReactNode>;

  const sections = {
    advances: {
      title: "Tạm ứng thầu phụ",
      description: "Theo dõi tạm ứng theo tuần, hạng mục và nhà thầu phụ của công trình đang chọn.",
      content: (
        <SectionBlock title="Tạm ứng thầu phụ">
            <DataTable
              loading={isSwitchingProject}
              columns={[
                { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
                { key: "category", label: "Hạng mục", accessor: (row) => row.category, render: (row) => row.category || "-" },
                { key: "contractorName", label: "Thầu phụ", accessor: (row) => row.contractorName, render: (row) => row.contractorName || "-" },
                { key: "advance", label: "Tạm ứng", accessor: (row) => row.advance, render: (row) => formatMoney(row.advance) },
                { key: "cumulative", label: "Lũy kế", accessor: (row) => row.cumulative, render: (row) => formatMoney(row.cumulative) },
                { key: "note", label: "Ghi chú", accessor: (row) => row.note, render: (row) => row.note || "-" },
                ...(canManage
                  ? [
                      {
                        key: "actions",
                        label: "Thao tác",
                        hideable: false,
                        searchable: false,
                        sortable: false,
                        render: (row: (typeof scoped.subcontractors)[number]) => (
                          <div className="flex justify-end">
                            <TableRowActions
                              edit={{
                                title: "Sửa tạm ứng thầu phụ",
                                action: "saveSubcontractor",
                                onAction: runAction,
                                fields: [
                                  { name: "id", label: "ID", type: "hidden", value: row.id },
                                  { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                  { name: "date", label: "Ngày", type: "date", value: row.date || todayIso() },
                                  { name: "week", label: "Tuần", value: row.week || currentIsoWeek() },
                                  { name: "category", label: "Hạng mục", type: "select", options: categoryOptions, value: row.category },
                                  { name: "contractorName", label: "Thầu phụ", type: "select", options: contractorOptions, value: row.contractorName },
                                  { name: "advance", label: "Tạm ứng", type: "number", value: row.advance },
                                  { name: "note", label: "Diễn giải", type: "textarea", value: row.note },
                                ],
                              }}
                              actions={[
                                {
                                  label: "Xóa",
                                  icon: Trash2,
                                  destructive: true,
                                  onSelect: () => {
                                    if (window.confirm(`Xóa tạm ứng của "${row.contractorName}"?`)) {
                                      void runAction("deleteSubcontractor", { id: row.id });
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
              rows={scoped.subcontractors}
              getRowId={(row) => row.id}
              selectable
              exportFileName="thau-phu-tam-ung"
              searchPlaceholder="Tìm thầu phụ, hạng mục..."
              filters={[
                { key: "week", label: "Tuần", options: subcontractorWeekOptions },
                { key: "category", label: "Hạng mục", options: subcontractorCategoryOptions },
                { key: "contractorName", label: "Thầu phụ", options: subcontractorNameOptions },
              ]}
              initialSorting={[{ id: "date", desc: true }]}
            />
        </SectionBlock>
      ),
    },
    contracts: {
      title: "Hợp đồng thầu phụ",
      description: "Quản lý chi phí dự kiến, trạng thái phê duyệt và danh sách hợp đồng thầu phụ.",
      content: (
        <SectionBlock title="Hợp đồng thầu phụ">
            <DataTable
              loading={isSwitchingProject}
              columns={[
                { key: "contractorName", label: "Thầu phụ", accessor: (row) => row.contractorName, render: (row) => row.contractorName },
                { key: "approvedCost", label: "Dự kiến", accessor: (row) => row.approvedCost, render: (row) => formatMoney(row.approvedCost) },
                { key: "status", label: "Trạng thái", accessor: (row) => row.status, render: (row) => <Badge>{row.status}</Badge> },
                ...(canManage
                  ? [
                      {
                        key: "actions",
                        label: "Thao tác",
                        hideable: false,
                        searchable: false,
                        sortable: false,
                        render: (row: (typeof scoped.subcontractorContracts)[number]) => (
                          <div className="flex justify-end">
                            <TableRowActions
                              edit={{
                                title: "Sửa hợp đồng thầu phụ",
                                action: "saveSubcontractorContract",
                                onAction: runAction,
                                fields: [
                                  { name: "id", label: "ID", type: "hidden", value: row.id },
                                  { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                  { name: "contractorName", label: "Thầu phụ", type: "select", options: contractorOptions, value: row.contractorName },
                                  { name: "approvedCost", label: "Tổng chi phí dự kiến", type: "number", value: row.approvedCost },
                                  { name: "status", label: "Trạng thái", value: row.status },
                                  { name: "note", label: "Ghi chú", type: "textarea", value: row.note },
                                ],
                              }}
                              actions={[
                                {
                                  label: "Duyệt hợp đồng",
                                  icon: ShieldCheck,
                                  onSelect: () => {
                                    void runAction("approveSubcontractorContract", {
                                      projectCode: activeProjectCode,
                                      contractorName: row.contractorName,
                                      by: "Admin",
                                    });
                                  },
                                },
                                {
                                  label: "Xóa",
                                  icon: Trash2,
                                  destructive: true,
                                  onSelect: () => {
                                    if (window.confirm(`Xóa hợp đồng của "${row.contractorName}"?`)) {
                                      void runAction("deleteSubcontractorContract", { id: row.id });
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
              rows={scoped.subcontractorContracts}
              getRowId={(row) => row.id}
              selectable
              exportFileName="hop-dong-thau-phu"
              filters={[
                { key: "status", label: "Trạng thái", options: subcontractorStatusOptions },
              ]}
            />
        </SectionBlock>
      ),
    },
    operations: {
      title: "Chi phí vận hành",
      description: "Tập trung toàn bộ các khoản vận hành phát sinh theo ngày và tuần cho công trình.",
      content: (
        <SectionBlock title="Chi phí vận hành">
            <DataTable
              loading={isSwitchingProject}
              columns={[
                { key: "date", label: "Ngày", accessor: (row) => row.date, render: (row) => row.date || "-" },
                { key: "week", label: "Tuần", accessor: (row) => row.week, render: (row) => row.week || "-" },
                { key: "description", label: "Diễn giải", accessor: (row) => row.description, render: (row) => row.description || "-" },
                { key: "amount", label: "Số tiền", accessor: (row) => row.amount, render: (row) => formatMoney(row.amount) },
                ...(canManage
                  ? [
                      {
                        key: "actions",
                        label: "Thao tác",
                        hideable: false,
                        searchable: false,
                        sortable: false,
                        render: (row: (typeof scoped.operations)[number]) => (
                          <div className="flex justify-end">
                            <TableRowActions
                              edit={{
                                title: "Sửa chi phí vận hành",
                                action: "saveOperation",
                                onAction: runAction,
                                fields: [
                                  { name: "id", label: "ID", type: "hidden", value: row.id },
                                  { name: "projectCode", label: "Công trình", type: "hidden", value: activeProjectCode },
                                  { name: "date", label: "Ngày", type: "date", value: row.date || todayIso() },
                                  { name: "week", label: "Tuần", value: row.week || currentIsoWeek() },
                                  { name: "description", label: "Diễn giải", required: true, value: row.description },
                                  { name: "amount", label: "Số tiền", type: "number", value: row.amount },
                                ],
                              }}
                              actions={[
                                {
                                  label: "Xóa",
                                  icon: Trash2,
                                  destructive: true,
                                  onSelect: () => {
                                    if (window.confirm(`Xóa chi phí vận hành "${row.description}"?`)) {
                                      void runAction("deleteOperation", { id: row.id });
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
              rows={scoped.operations}
              getRowId={(row) => row.id}
              selectable
              exportFileName="chi-phi-van-hanh"
              filters={[
                { key: "week", label: "Tuần", options: operationWeekOptions },
              ]}
              initialSorting={[{ id: "date", desc: true }]}
            />
        </SectionBlock>
      ),
    },
  } satisfies Record<
    SubcontractorsSection,
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
        icon={Hammer}
        actions={canManage ? actions[section] : undefined}
      />
      {currentSection.content}
    </div>
  );
}
