"use client";

import * as React from "react";

import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/app/(main)/dashboard/giaphu-erp/_components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClerkOrganizationRole } from "@/lib/clerk/clerk-bapi";
import { ERP_PERMISSION_CATALOG } from "@/lib/clerk/erp-rbac-shared";

import { DashboardLink } from "../../_components/dashboard-link";

type RoleManagerResponse = {
  status: "success" | "error";
  message?: string;
  roles?: ClerkOrganizationRole[];
};

type RoleRow = {
  id: string;
  name: string;
  key: string;
  description: string;
  permissionCount: number;
  groups: string[];
  type: "system" | "custom";
};

const hiddenRoleKeys = new Set(["org:member"]);
const systemRoleKeys = new Set(["org:admin"]);

async function readRoleManagerResponse(response: Response): Promise<RoleManagerResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      status: response.ok ? "success" : "error",
      message: response.ok ? undefined : "API không trả dữ liệu hợp lệ.",
    };
  }

  try {
    return JSON.parse(text) as RoleManagerResponse;
  } catch {
    return {
      status: "error",
      message: "API trả về dữ liệu không đúng định dạng JSON.",
    };
  }
}

function buildRoleRows(roles: ClerkOrganizationRole[]) {
  return roles
    .filter((role) => !hiddenRoleKeys.has(role.key))
    .map((role) => {
      const groups = Array.from(
        new Set(
          role.permissions
            .map((permission) => ERP_PERMISSION_CATALOG.find((item) => item.key === permission.key)?.group)
            .filter(Boolean) as string[],
        ),
      );

      return {
        id: role.id,
        name: role.name,
        key: role.key,
        description: role.description ?? "",
        permissionCount: role.permissions.length,
        groups,
        type: systemRoleKeys.has(role.key) ? "system" : "custom",
      } satisfies RoleRow;
    })
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "system" ? -1 : 1;
      }

      return left.name.localeCompare(right.name, "vi");
    });
}

export function RoleManager() {
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [roles, setRoles] = React.useState<ClerkOrganizationRole[]>([]);

  const roleRows = React.useMemo(() => buildRoleRows(roles), [roles]);

  const loadData = React.useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/clerk-rbac", { cache: "no-store" });
      const payload = await readRoleManagerResponse(response);

      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Không tải được dữ liệu role.");
      }

      setRoles(payload.roles ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const deleteRole = React.useCallback(
    async (role: RoleRow) => {
      if (!window.confirm(`Xóa vai trò "${role.name}"?`)) {
        return;
      }

      setSubmitting(true);

      try {
        const response = await fetch("/api/clerk-rbac", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteRole", roleId: role.id }),
        });

        const payload = await readRoleManagerResponse(response);

        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Xóa vai trò thất bại.");
        }

        toast.success("Đã xóa vai trò.");
        await loadData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setSubmitting(false);
      }
    },
    [loadData],
  );

  const columns = React.useMemo<DataTableColumn<RoleRow>[]>(
    () => [
      {
        key: "name",
        label: "Tên vai trò",
        sortable: true,
        searchable: true,
        accessor: (row) => row.name,
        render: (row) => (
          <div className="space-y-1">
            <div className="font-medium">{row.name}</div>
            {row.description ? <div className="text-muted-foreground text-xs">{row.description}</div> : null}
          </div>
        ),
      },
      {
        key: "key",
        label: "Key",
        sortable: true,
        searchable: true,
        accessor: (row) => row.key,
        render: (row) => <code className="text-xs">{row.key}</code>,
      },
      {
        key: "type",
        label: "Loại",
        sortable: true,
        accessor: (row) => row.type,
        render: (row) => <Badge variant="outline">{row.type === "system" ? "Hệ thống" : "Tùy chỉnh"}</Badge>,
      },
      {
        key: "permissionCount",
        label: "Số quyền",
        sortable: true,
        accessor: (row) => row.permissionCount,
        render: (row) => <span>{row.permissionCount}</span>,
      },
      {
        key: "groups",
        label: "Nhóm chức năng",
        searchable: true,
        accessor: (row) => row.groups.join(", "),
        render: (row) =>
          row.groups.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {row.groups.slice(0, 3).map((group) => (
                <Badge key={group} variant="secondary">
                  {group}
                </Badge>
              ))}
              {row.groups.length > 3 ? <Badge variant="secondary">+{row.groups.length - 3}</Badge> : null}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Chưa có quyền ERP</span>
          ),
      },
      {
        key: "actions",
        label: "Thao tác",
        hideable: false,
        searchable: false,
        render: (row) => (
          <div className="flex flex-wrap justify-end gap-2">
            {row.type === "custom" ? (
              <Button asChild type="button" size="sm" variant="outline">
                <DashboardLink href={`/dashboard/workspaces/roles/edit/${row.id}`}>Sửa</DashboardLink>
              </Button>
            ) : (
              <Badge variant="outline">Khóa</Badge>
            )}
            {row.type === "custom" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting}
                onClick={() => void deleteRole(row)}
              >
                <Trash2 />
                Xóa
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [deleteRole, submitting],
  );

  const filters = React.useMemo<DataTableFilter<RoleRow>[]>(
    () => [
      {
        key: "type",
        label: "Loại",
        allLabel: "Tất cả",
        options: [
          { label: "Hệ thống", value: "system" },
          { label: "Tùy chỉnh", value: "custom" },
        ],
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Danh sách vai trò
              </CardTitle>
              <CardDescription>
                Chỉ hiển thị role thuộc role set của workspace đang chọn, sau đó vào trang riêng để tạo mới hoặc chỉnh
                quyền chi tiết.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <DashboardLink href="/dashboard/workspaces/roles/create">
                  <Plus />
                  Tạo role
                </DashboardLink>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <DataTable
            columns={columns}
            rows={roleRows}
            getRowId={(row) => row.id}
            filters={filters}
            exportFileName="clerk-roles"
            searchPlaceholder="Tìm theo tên role, key hoặc nhóm chức năng..."
            initialSorting={[{ id: "name", desc: false }]}
            empty="Chưa có vai trò nào."
          />
        </CardContent>
      </Card>
    </div>
  );
}
