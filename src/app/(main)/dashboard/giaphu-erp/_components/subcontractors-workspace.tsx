"use client";

import Link from "next/link";

import { Banknote, FileText, Hammer, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useGiaPhuErp } from "../_hooks/use-giaphu-erp";
import { currentIsoWeek, todayIso } from "../_lib/date-utils";
import { catalogOptions } from "../_lib/form-options";
import { formatMoney } from "../_lib/formatters";
import { ActionDialog } from "./action-dialog";
import { DataTable } from "./data-table";
import { ModuleHeader } from "./module-header";

export function SubcontractorsWorkspace() {
  const { data, activeProjectCode, runAction, scoped } = useGiaPhuErp();
  const categoryOptions = catalogOptions(data.catalogs.hangMuc);
  const contractorOptions = catalogOptions(data.catalogs.thauPhu);

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Thầu phụ và vận hành"
        description="Quản lý tạm ứng, hợp đồng thầu phụ và chi phí vận hành công trình."
        icon={Hammer}
        actions={
          <>
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
                { name: "fileUrl", label: "Link hình ảnh/file" },
                { name: "note", label: "Diễn giải", type: "textarea" },
              ]}
            />
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
                { name: "fileUrl", label: "Link file" },
                { name: "status", label: "Trạng thái", value: "Chờ duyệt" },
                { name: "note", label: "Ghi chú", type: "textarea" },
              ]}
            />
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
                { name: "fileUrl", label: "Link hình ảnh/file" },
              ]}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Tạm ứng thầu phụ</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "date", label: "Ngày", render: (row) => row.date || "-" },
              { key: "week", label: "Tuần", render: (row) => row.week || "-" },
              { key: "category", label: "Hạng mục", render: (row) => row.category || "-" },
              { key: "contractor", label: "Thầu phụ", render: (row) => row.contractorName || "-" },
              { key: "advance", label: "Tạm ứng", render: (row) => formatMoney(row.advance) },
              { key: "cumulative", label: "Lũy kế", render: (row) => formatMoney(row.cumulative) },
              {
                key: "file",
                label: "File",
                render: (row) =>
                  row.fileUrl ? (
                    <Button variant="link" asChild className="px-0">
                      <Link href={row.fileUrl} target="_blank" rel="noreferrer">
                        Mở
                      </Link>
                    </Button>
                  ) : (
                    "-"
                  ),
              },
              { key: "note", label: "Ghi chú", render: (row) => row.note || "-" },
            ]}
            rows={scoped.subcontractors}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hợp đồng thầu phụ</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "contractor", label: "Thầu phụ", render: (row) => row.contractorName },
                { key: "cost", label: "Dự kiến", render: (row) => formatMoney(row.approvedCost) },
                { key: "status", label: "Trạng thái", render: (row) => <Badge>{row.status}</Badge> },
                {
                  key: "approve",
                  label: "Duyệt",
                  render: (row) => (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runAction("approveSubcontractorContract", {
                          projectCode: activeProjectCode,
                          contractorName: row.contractorName,
                          by: "Admin",
                        })
                      }
                    >
                      <ShieldCheck />
                      Duyệt
                    </Button>
                  ),
                },
              ]}
              rows={scoped.subcontractorContracts}
              getRowId={(row) => row.id}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chi phí vận hành</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "date", label: "Ngày", render: (row) => row.date || "-" },
                { key: "week", label: "Tuần", render: (row) => row.week || "-" },
                { key: "description", label: "Diễn giải", render: (row) => row.description || "-" },
                { key: "amount", label: "Số tiền", render: (row) => formatMoney(row.amount) },
              ]}
              rows={scoped.operations}
              getRowId={(row) => row.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
