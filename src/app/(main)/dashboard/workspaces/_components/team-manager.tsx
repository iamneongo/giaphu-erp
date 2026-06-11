"use client";

import * as React from "react";

import { Loader2, MailPlus, Search, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ClerkOrganizationInvitation,
  ClerkOrganizationMembership,
  ClerkOrganizationRole,
  ClerkRoleSet,
} from "@/lib/clerk/clerk-bapi";

type TeamManagerResponse = {
  status: "success" | "error";
  message?: string;
  currentUserId?: string;
  currentUserIsAdmin?: boolean;
  roleSet?: ClerkRoleSet;
  roles?: ClerkOrganizationRole[];
  memberships?: ClerkOrganizationMembership[];
  invitations?: ClerkOrganizationInvitation[];
  membership?: ClerkOrganizationMembership;
  invitation?: ClerkOrganizationInvitation;
};

const hiddenRoleKeys = new Set(["org:member"]);

async function readTeamManagerResponse(response: Response): Promise<TeamManagerResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      status: response.ok ? "success" : "error",
      message: response.ok ? undefined : "API không trả dữ liệu hợp lệ.",
    };
  }

  try {
    return JSON.parse(text) as TeamManagerResponse;
  } catch {
    return {
      status: "error",
      message: "API trả về dữ liệu không đúng định dạng JSON.",
    };
  }
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function TeamManager() {
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [roles, setRoles] = React.useState<ClerkOrganizationRole[]>([]);
  const [memberships, setMemberships] = React.useState<ClerkOrganizationMembership[]>([]);
  const [invitations, setInvitations] = React.useState<ClerkOrganizationInvitation[]>([]);
  const [roleSet, setRoleSet] = React.useState<ClerkRoleSet | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("");

  const availableRoleKeys = React.useMemo(() => new Set(roleSet?.roles.map((role) => role.key) ?? []), [roleSet]);

  const availableRoles = React.useMemo(() => {
    const source = roles.filter((role) => availableRoleKeys.has(role.key) && !hiddenRoleKeys.has(role.key));
    return source.sort((a, b) => {
      if (a.key === "org:admin") return -1;
      if (b.key === "org:admin") return 1;
      return a.name.localeCompare(b.name, "vi");
    });
  }, [availableRoleKeys, roles]);

  const availableRoleKeySet = React.useMemo(() => new Set(availableRoles.map((role) => role.key)), [availableRoles]);

  const roleNameMap = React.useMemo(() => new Map(roles.map((role) => [role.key, role.name])), [roles]);

  const adminCount = React.useMemo(
    () => memberships.filter((membership) => membership.role === "org:admin").length,
    [memberships],
  );

  const filteredMemberships = React.useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (!keyword) {
      return memberships;
    }

    return memberships.filter((membership) => {
      const fullName = [membership.publicUserData.firstName, membership.publicUserData.lastName]
        .filter(Boolean)
        .join(" ");
      const haystack = [
        fullName,
        membership.publicUserData.identifier,
        roleNameMap.get(membership.role),
        membership.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [debouncedSearch, memberships, roleNameMap]);

  const loadData = React.useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? false;

    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/clerk-rbac", { cache: "no-store" });
      const payload = await readTeamManagerResponse(response);

      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message || "Không tải được dữ liệu thành viên.");
      }

      setRoles(payload.roles ?? []);
      setMemberships(payload.memberships ?? []);
      setInvitations(payload.invitations ?? []);
      setRoleSet(payload.roleSet ?? null);
      setCurrentUserId(payload.currentUserId ?? null);
      setCurrentUserIsAdmin(Boolean(payload.currentUserIsAdmin));
      setInviteRole((current) => {
        if (current && !hiddenRoleKeys.has(current)) return current;

        const nextDefaultRole = payload.roleSet?.default_role.key;
        if (nextDefaultRole && !hiddenRoleKeys.has(nextDefaultRole)) return nextDefaultRole;

        const nextRole = (payload.roles ?? [])
          .filter((role) => new Set(payload.roleSet?.roles.map((entry) => entry.key) ?? []).has(role.key))
          .find((role) => !hiddenRoleKeys.has(role.key));

        return nextRole?.key ?? "";
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadData({ showLoader: true });
  }, [loadData]);

  const runAction = React.useCallback(
    async (
      body: Record<string, unknown>,
      successMessage: string,
      applyResult?: (payload: TeamManagerResponse) => void,
    ) => {
      setSubmitting(true);

      try {
        const response = await fetch("/api/clerk-rbac", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const payload = await readTeamManagerResponse(response);

        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.message || "Thao tác thất bại.");
        }

        applyResult?.(payload);
        toast.success(successMessage);
        void loadData();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setSubmitting(false);
      }
    },
    [loadData],
  );

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailAddress = inviteEmail.trim();

    if (!emailAddress || !inviteRole) {
      toast.error("Nhập email và chọn vai trò trước khi gửi lời mời.");
      return;
    }

    await runAction(
      {
        action: "inviteMember",
        emailAddress,
        role: inviteRole,
      },
      "Đã gửi lời mời thành viên.",
      (payload) => {
        if (!payload.invitation) return;

        setInvitations((current) => {
          if (current.some((invitation) => invitation.id === payload.invitation?.id)) {
            return current;
          }

          return [payload.invitation, ...current].filter((invitation): invitation is ClerkOrganizationInvitation =>
            Boolean(invitation),
          );
        });
      },
    );

    setInviteEmail("");
  }

  async function updateMemberRole(userId: string, role: string) {
    await runAction(
      {
        action: "updateMembershipRole",
        userId,
        role,
      },
      "Đã cập nhật vai trò thành viên.",
      (payload) => {
        setMemberships((current) =>
          current.map((membership) => {
            if (membership.publicUserData.userId !== userId) {
              return membership;
            }

            return payload.membership ?? { ...membership, role, updatedAt: Date.now() };
          }),
        );
      },
    );
  }

  async function removeMembership(userId: string, displayName: string) {
    if (!window.confirm(`Xóa ${displayName} khỏi tổ chức này?`)) {
      return;
    }

    await runAction(
      {
        action: "removeMembership",
        userId,
      },
      "Đã xóa thành viên khỏi tổ chức.",
      () => {
        setMemberships((current) => current.filter((membership) => membership.publicUserData.userId !== userId));
      },
    );
  }

  async function revokeInvitation(invitationId: string, emailAddress: string) {
    if (!window.confirm(`Thu hồi lời mời của ${emailAddress}?`)) {
      return;
    }

    await runAction(
      {
        action: "revokeInvitation",
        invitationId,
      },
      "Đã thu hồi lời mời.",
      () => {
        setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
      },
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Tabs defaultValue="members" className="gap-4">
        <TabsList variant="line" className="w-fit">
          <TabsTrigger value="members" className="gap-2">
            <span>Thành viên</span>
            <Badge variant="secondary">{memberships.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <span>Lời mời</span>
            <Badge variant="secondary">{invitations.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5" />
                  Thành viên
                </CardTitle>
                <div className="relative w-full md:max-w-sm">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Tìm theo tên, email, vai trò..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredMemberships.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
                  Không có thành viên phù hợp.
                </div>
              ) : null}

              {filteredMemberships.map((membership) => {
                const displayName =
                  [membership.publicUserData.firstName, membership.publicUserData.lastName].filter(Boolean).join(" ") ||
                  membership.publicUserData.identifier ||
                  membership.publicUserData.userId;
                const email = membership.publicUserData.identifier || membership.publicUserData.userId;
                const isCurrentUser = membership.publicUserData.userId === currentUserId;
                const isLastAdmin = membership.role === "org:admin" && adminCount <= 1;
                const disableRemoval = isCurrentUser || isLastAdmin;
                const hasVisibleRole = availableRoleKeySet.has(membership.role);

                return (
                  <div
                    key={membership.id}
                    className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-11">
                        <AvatarImage src={membership.publicUserData.imageUrl ?? undefined} alt={displayName} />
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-medium">{displayName}</div>
                          {isCurrentUser ? <Badge variant="outline">Bạn</Badge> : null}
                          {membership.role === "org:admin" ? <Badge variant="outline">Admin</Badge> : null}
                        </div>
                        <div className="text-muted-foreground text-sm">{email}</div>
                        <div className="text-muted-foreground text-xs">Tham gia {formatDate(membership.createdAt)}</div>
                        {isLastAdmin ? (
                          <div className="text-muted-foreground text-xs">
                            Admin cuối cùng của tổ chức. Không thể hạ quyền hoặc xóa thành viên này.
                          </div>
                        ) : null}
                        {isCurrentUser ? (
                          <div className="text-muted-foreground text-xs">Đây là tài khoản đang đăng nhập.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[320px] md:flex-row md:items-center">
                      <Select
                        value={hasVisibleRole ? membership.role : undefined}
                        onValueChange={(value) => void updateMemberRole(membership.publicUserData.userId, value)}
                      >
                        <SelectTrigger className="min-w-60">
                          <SelectValue placeholder="Chọn vai trò" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem
                              key={role.id}
                              value={role.key}
                              disabled={isLastAdmin && role.key !== "org:admin"}
                            >
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="outline"
                        className="justify-center"
                        disabled={disableRemoval || submitting}
                        onClick={() => void removeMembership(membership.publicUserData.userId, displayName)}
                      >
                        <UserMinus />
                        Xóa
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          {currentUserIsAdmin ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <MailPlus className="size-5" />
                  Mời thành viên
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(12rem,220px)_auto] xl:items-end"
                  onSubmit={(event) => void inviteMember(event)}
                >
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      className="w-full"
                      type="email"
                      placeholder="name@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Vai trò</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn vai trò" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.id} value={role.key}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label aria-hidden="true" className="invisible">
                      Gửi lời mời
                    </Label>
                    <Button type="submit" className="w-full whitespace-nowrap xl:min-w-32" disabled={submitting}>
                      <MailPlus />
                      Gửi lời mời
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <MailPlus className="size-5" />
                  Mời thành viên
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                Chỉ admin workspace mới có quyền mời thành viên mới.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="size-5" />
                Lời mời chờ phản hồi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
                  Chưa có lời mời nào đang chờ phản hồi.
                </div>
              ) : null}

              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{invitation.emailAddress}</div>
                    <div className="text-muted-foreground text-sm">
                      {hiddenRoleKeys.has(invitation.role)
                        ? "Chưa phân quyền"
                        : (roleNameMap.get(invitation.role) ?? invitation.roleName ?? invitation.role)}
                    </div>
                    <div className="text-muted-foreground text-xs">Hết hạn {formatDate(invitation.expiresAt)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => void revokeInvitation(invitation.id, invitation.emailAddress)}
                  >
                    Thu hồi
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
