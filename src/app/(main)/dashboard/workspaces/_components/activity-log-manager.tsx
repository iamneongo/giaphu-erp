"use client";

import * as React from "react";

import { Clock3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableServerState,
} from "@/app/(main)/dashboard/giaphu-erp/_components/data-table";
import { fetchGiaPhuActivityLogs } from "@/app/(main)/dashboard/giaphu-erp/_lib/giaphu-erp-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityLogRow } from "@/lib/giaphu-erp/types";

const activityModules = [
  "CRM công trình",
  "Danh mục",
  "Nhân công",
  "Vật tư",
  "Thầu phụ",
  "Hồ sơ",
  "Import Excel",
  "Tổ chức & thành viên",
  "Công trình",
  "ERP",
];

const activityActions = [
  "saveProject",
  "deleteProject",
  "saveContract",
  "deleteContract",
  "savePayment",
  "deletePayment",
  "manageCatalog",
  "deleteCatalog",
  "restoreCatalog",
  "manageStaff",
  "deleteStaff",
  "saveMaterial",
  "deleteMaterial",
  "saveWeeklyAttendance",
  "saveStaffWeeklyAttendance",
  "deleteAttendanceRow",
  "closeAttendance",
  "reopenAttendance",
  "saveSubcontractor",
  "deleteSubcontractor",
  "saveSubcontractorContract",
  "deleteSubcontractorContract",
  "approveSubcontractorContract",
  "saveOperation",
  "deleteOperation",
  "saveLaborNorm",
  "deleteLaborNorm",
  "saveProgress",
  "deleteProgress",
  "saveDocument",
  "deleteDocument",
  "bulkImport",
  "syncPermissions",
  "createRole",
  "updateRolePermissions",
  "deleteRole",
  "updateMembershipRole",
  "inviteMember",
  "revokeInvitation",
  "removeMembership",
  "verifyProjectPin",
];

const activityActionLabels: Record<string, string> = {
  saveProject: "Lưu công trình",
  deleteProject: "Xóa công trình",
  saveContract: "Lưu hợp đồng",
  deleteContract: "Xóa hợp đồng",
  savePayment: "Lưu thu tiền",
  deletePayment: "Xóa thu tiền",
  manageCatalog: "Lưu danh mục",
  deleteCatalog: "Lưu trữ danh mục",
  restoreCatalog: "Khôi phục danh mục",
  manageStaff: "Lưu nhân sự",
  deleteStaff: "Lưu trữ nhân sự",
  saveMaterial: "Lưu vật tư",
  deleteMaterial: "Xóa vật tư",
  saveWeeklyAttendance: "Lưu chấm công",
  saveStaffWeeklyAttendance: "Lưu chấm công nhân sự",
  deleteAttendanceRow: "Xóa dòng chấm công",
  closeAttendance: "Kết sổ chấm công",
  reopenAttendance: "Mở khóa chấm công",
  saveSubcontractor: "Lưu tạm ứng thầu phụ",
  deleteSubcontractor: "Xóa tạm ứng thầu phụ",
  saveSubcontractorContract: "Lưu hợp đồng thầu phụ",
  deleteSubcontractorContract: "Xóa hợp đồng thầu phụ",
  approveSubcontractorContract: "Duyệt hợp đồng thầu phụ",
  saveOperation: "Lưu vận hành",
  deleteOperation: "Xóa vận hành",
  saveLaborNorm: "Lưu định mức",
  deleteLaborNorm: "Xóa định mức",
  saveProgress: "Lưu tiến độ",
  deleteProgress: "Xóa tiến độ",
  saveDocument: "Lưu hồ sơ",
  deleteDocument: "Xóa hồ sơ",
  bulkImport: "Import Excel",
  syncPermissions: "Đồng bộ quyền",
  createRole: "Tạo vai trò",
  updateRolePermissions: "Cập nhật quyền vai trò",
  deleteRole: "Xóa vai trò",
  updateMembershipRole: "Cập nhật vai trò thành viên",
  inviteMember: "Mời thành viên",
  revokeInvitation: "Thu hồi lời mời",
  removeMembership: "Xóa thành viên khỏi tổ chức",
  verifyProjectPin: "Mở khóa công trình",
};

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ActivityLogManager() {
  const [rows, setRows] = React.useState<ActivityLogRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [exportLoading, setExportLoading] = React.useState(false);
  const [state, setState] = React.useState<DataTableServerState>({
    pageIndex: 0,
    pageSize: 20,
    query: "",
    sorting: [],
    filters: {},
  });

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetchGiaPhuActivityLogs({
      pageIndex: state.pageIndex,
      pageSize: state.pageSize,
      search: state.query,
      module: state.filters.module,
      action: state.filters.action,
      projectCode: state.filters.projectCode,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        toast.error(error instanceof Error ? error.message : String(error));
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [state]);

  const columns = React.useMemo<DataTableColumn<ActivityLogRow>[]>(
    () => [
      {
        key: "createdAt",
        label: "Thời gian",
        sortable: false,
        accessor: (row) => row.createdAt,
        render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span>,
      },
      {
        key: "actor",
        label: "Thành viên",
        searchable: true,
        accessor: (row) => `${row.actorName} ${row.actorEmail} ${row.userId}`,
        render: (row) => (
          <div className="max-w-56 space-y-1">
            <div className="truncate font-medium">{row.actorName || row.actorEmail || row.userId}</div>
            {row.actorEmail ? <div className="truncate text-muted-foreground text-xs">{row.actorEmail}</div> : null}
          </div>
        ),
      },
      {
        key: "module",
        label: "Khu vực",
        searchable: true,
        accessor: (row) => row.module,
        render: (row) => <Badge variant="outline">{row.module || "ERP"}</Badge>,
      },
      {
        key: "summary",
        label: "Hoạt động",
        searchable: true,
        accessor: (row) => `${row.summary} ${row.action} ${row.entityId}`,
        render: (row) => (
          <div className="max-w-xl space-y-1">
            <div className="truncate font-medium" title={row.summary}>
              {row.summary}
            </div>
            <div className="truncate text-muted-foreground text-xs">
              {activityActionLabels[row.action] ?? "Thao tác ERP"}
            </div>
          </div>
        ),
      },
      {
        key: "projectCode",
        label: "Công trình",
        searchable: true,
        accessor: (row) => row.projectCode,
        render: (row) => (row.projectCode ? <Badge variant="secondary">{row.projectCode}</Badge> : "-"),
      },
      {
        key: "ipAddress",
        label: "IP",
        searchable: true,
        accessor: (row) => row.ipAddress,
        render: (row) => <span className="whitespace-nowrap text-muted-foreground">{row.ipAddress || "-"}</span>,
      },
    ],
    [],
  );

  const filters = React.useMemo<DataTableFilter<ActivityLogRow>[]>(
    () => [
      {
        key: "module",
        label: "Khu vực",
        allLabel: "Tất cả khu vực",
        options: activityModules.map((module) => ({ label: module, value: module })),
      },
      {
        key: "action",
        label: "Thao tác",
        allLabel: "Tất cả thao tác",
        options: activityActions.map((action) => ({ label: activityActionLabels[action] ?? action, value: action })),
      },
    ],
    [],
  );

  const serverSide = React.useMemo(
    () => ({
      rowCount: total,
      loading,
      exportLoading,
      filterOptions: {},
      onStateChange: setState,
      getExportRows: async (exportState: DataTableServerState) => {
        setExportLoading(true);
        try {
          const result = await fetchGiaPhuActivityLogs({
            pageIndex: 0,
            pageSize: Math.max(total, exportState.pageSize, 1),
            search: exportState.query,
            module: exportState.filters.module,
            action: exportState.filters.action,
            projectCode: exportState.filters.projectCode,
          });

          return result.rows;
        } finally {
          setExportLoading(false);
        }
      },
    }),
    [exportLoading, loading, total],
  );

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Clock3 className="size-5" />}
          Lịch sử hoạt động
        </CardTitle>
        <CardDescription>
          Theo dõi thao tác đã thực hiện trong tổ chức hiện tại. Log chỉ bắt đầu ghi từ lúc chức năng này được bật.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          filters={filters}
          pageSize={20}
          exportFileName="lich-su-hoat-dong"
          searchPlaceholder="Tìm theo thành viên, thao tác, công trình..."
          empty="Chưa có lịch sử hoạt động."
          enableRowDetails={false}
          serverSide={serverSide}
        />
      </CardContent>
    </Card>
  );
}
