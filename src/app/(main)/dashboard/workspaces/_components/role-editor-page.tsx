"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ClerkOrganizationPermission, ClerkOrganizationRole, ClerkRoleSet } from "@/lib/clerk/clerk-bapi";
import { ERP_PERMISSION_CATALOG, type ErpPermissionKey, getPermissionCatalogGroups } from "@/lib/clerk/erp-rbac-shared";

import { DashboardLink } from "../../_components/dashboard-link";

type RoleManagerResponse = {
  status: "success" | "error";
  message?: string;
  roleSet?: ClerkRoleSet;
  roles?: ClerkOrganizationRole[];
  permissions?: ClerkOrganizationPermission[];
};

const permissionGroups = getPermissionCatalogGroups();

function generateRoleKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9-_]+/g, "_")
    .replace(/^org:/, "")
    .replace(/^_+|_+$/g, "");
}

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

export function RoleEditorPage({ mode, roleId }: { mode: "create" | "edit"; roleId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [roles, setRoles] = React.useState<ClerkOrganizationRole[]>([]);
  const [permissions, setPermissions] = React.useState<ClerkOrganizationPermission[]>([]);
  const [roleSet, setRoleSet] = React.useState<ClerkRoleSet | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    description: "",
  });
  const [selectedKeys, setSelectedKeys] = React.useState<Set<ErpPermissionKey>>(new Set());

  const editingRole = React.useMemo(
    () => (mode === "edit" ? (roles.find((role) => role.id === roleId) ?? null) : null),
    [mode, roleId, roles],
  );

  const permissionCoverage = React.useMemo(
    () => ERP_PERMISSION_CATALOG.filter((item) => permissions.some((permission) => permission.key === item.key)).length,
    [permissions],
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/clerk-rbac", { cache: "no-store" });
      const payload = await readRoleManagerResponse(response);

      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Không tải được dữ liệu vai trò.");
      }

      setRoles(payload.roles ?? []);
      setPermissions(payload.permissions ?? []);
      setRoleSet(payload.roleSet ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (mode !== "edit") {
      setForm({ name: "", description: "" });
      setSelectedKeys(new Set());
      return;
    }

    if (!editingRole) {
      return;
    }

    setForm({
      name: editingRole.name,
      description: editingRole.description ?? "",
    });
    setSelectedKeys(new Set(editingRole.permissions.map((permission) => permission.key as ErpPermissionKey)));
  }, [editingRole, mode]);

  React.useEffect(() => {
    if (mode === "edit" && !loading && !editingRole) {
      toast.error("Không tìm thấy vai trò cần chỉnh sửa.");
      router.replace("/dashboard/workspaces/roles");
    }
  }, [editingRole, loading, mode, router]);

  function togglePermission(permissionKey: ErpPermissionKey, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(permissionKey);
      } else {
        next.delete(permissionKey);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedKey = generateRoleKey(form.name);

    if (!form.name.trim() || !normalizedKey) {
      toast.error("Nhập tên vai trò hợp lệ.");
      return;
    }

    const fullRoleKey = `org:${normalizedKey}`;

    if (mode === "create" && roles.some((role) => role.key === fullRoleKey)) {
      toast.error("Key role đã tồn tại. Hãy dùng key khác.");
      return;
    }

    if (selectedKeys.size === 0) {
      toast.error("Chọn ít nhất một quyền cho vai trò.");
      return;
    }

    setSubmitting(true);

    try {
      const body =
        mode === "edit"
          ? {
              action: "updateRolePermissions",
              roleId,
              permissionKeys: Array.from(selectedKeys),
            }
          : {
              action: "createRole",
              name: form.name.trim(),
              key: fullRoleKey,
              description: form.description.trim(),
              permissionKeys: Array.from(selectedKeys),
            };

      const response = await fetch("/api/clerk-rbac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await readRoleManagerResponse(response);

      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Lưu vai trò thất bại.");
      }

      toast.success(mode === "edit" ? "Đã cập nhật vai trò." : "Đã tạo vai trò mới.");
      router.push("/dashboard/workspaces/roles");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  const generatedKey = React.useMemo(() => generateRoleKey(form.name), [form.name]);
  const fullGeneratedKey = generatedKey ? `org:${generatedKey}` : "org:ten_role";

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
              <CardTitle>{mode === "edit" ? "Sửa vai trò" : "Tạo vai trò mới"}</CardTitle>
              <CardDescription>
                {mode === "edit"
                  ? "Chỉnh thông tin và quyền ERP cho vai trò thuộc workspace đang chọn."
                  : "Tạo vai trò trong role set của workspace đang chọn rồi bật các chức năng ERP được phép dùng."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {permissionCoverage}/{ERP_PERMISSION_CATALOG.length} quyền
              </Badge>
              <Badge variant="outline">{roleSet?.name ?? "Role set mặc định"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="role-name">Tên role</Label>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ví dụ: Kế toán"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-key-preview">Key tự sinh</Label>
                <Input id="role-key-preview" value={fullGeneratedKey} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Mô tả</Label>
                <Input
                  id="role-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Vai trò dùng cho ai"
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {permissionGroups.map((group) => (
                <div key={group.group} className="rounded-xl border">
                  <div className="border-b px-4 py-3 font-medium">{group.group}</div>
                  <div className="divide-y">
                    {group.items.map((item) => (
                      <div key={item.key} className="flex items-start justify-between gap-4 px-4 py-3">
                        <div className="min-w-0 space-y-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-muted-foreground text-xs leading-5">{item.description}</div>
                        </div>
                        <Switch
                          checked={selectedKeys.has(item.key)}
                          onCheckedChange={(checked) => togglePermission(item.key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? <RefreshCw className="animate-spin" /> : <Save />}
                {mode === "edit" ? "Lưu thay đổi" : "Tạo role"}
              </Button>
              <Button asChild type="button" variant="outline">
                <DashboardLink href="/dashboard/workspaces/roles">Quay lại danh sách</DashboardLink>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
