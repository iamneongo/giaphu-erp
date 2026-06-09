"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { Building2, CheckCircle2, Loader2, MailCheck, Plus } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

async function setUnlimitedMemberships(organizationId: string) {
  const response = await fetch("/api/clerk-organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setUnlimitedMemberships", organizationId }),
  });

  const payload = (await response.json()) as { status?: string; message?: string };

  if (!response.ok || payload.status !== "success") {
    throw new Error(payload.message || "Không thể nâng giới hạn thành viên workspace.");
  }
}

export function OrganizationManager() {
  const router = useRouter();
  const { orgId } = useAuth();
  const [creating, setCreating] = React.useState(false);
  const [switchingOrgId, setSwitchingOrgId] = React.useState<string | null>(null);
  const [acceptingInvitationId, setAcceptingInvitationId] = React.useState<string | null>(null);
  const [organizationName, setOrganizationName] = React.useState("");
  const [hasLoadedClerk, setHasLoadedClerk] = React.useState(false);

  const { isLoaded, createOrganization, setActive, userMemberships, userInvitations } = useOrganizationList({
    userMemberships: {
      infinite: true,
      keepPreviousData: true,
    },
    userInvitations: {
      infinite: true,
      keepPreviousData: true,
    },
  });

  React.useEffect(() => {
    if (isLoaded) {
      setHasLoadedClerk(true);
    }
  }, [isLoaded]);

  const memberships = userMemberships?.data ?? [];
  const invitations = userInvitations?.data ?? [];
  const activeMembership = memberships.find((membership) => membership.organization.id === orgId) ?? null;
  const clerkUpdating = !isLoaded && hasLoadedClerk;

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = organizationName.trim();

    if (!name) {
      toast.error("Nhập tên tổ chức trước khi tạo.");
      return;
    }

    if (creating) {
      return;
    }

    if (!createOrganization || !setActive) {
      toast.error("Clerk chưa sẵn sàng để tạo tổ chức.");
      return;
    }

    setCreating(true);

    try {
      const organization = await createOrganization({ name });
      await setUnlimitedMemberships(organization.id);
      setOrganizationName("");
      toast.success("Đã tạo tổ chức mới và mở không giới hạn thành viên.");

      await setActive({ organization: organization.id });
      void userMemberships?.revalidate();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleAcceptInvitation(invitation: (typeof invitations)[number]) {
    if (!setActive) {
      toast.error("Clerk chưa sẵn sàng để nhận lời mời.");
      return;
    }

    setAcceptingInvitationId(invitation.id);

    try {
      const acceptedInvitation = await invitation.accept();
      await setActive({ organization: acceptedInvitation.publicOrganizationData.id });
      await Promise.all([userInvitations?.revalidate(), userMemberships?.revalidate()]);
      toast.success("Đã tham gia tổ chức.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setAcceptingInvitationId(null);
    }
  }

  async function handleSetActiveOrganization(organizationId: string) {
    if (!setActive || orgId === organizationId) {
      return;
    }

    setSwitchingOrgId(organizationId);

    try {
      await setActive({ organization: organizationId });
      toast.success("Đã chuyển tổ chức đang làm việc.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSwitchingOrgId(null);
    }
  }

  if (!isLoaded && !hasLoadedClerk) {
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
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-5" />
            Lời mời dành cho bạn
          </CardTitle>
          <CardDescription>
            Chấp nhận lời mời vào tổ chức ngay trong ứng dụng khi email này đã đăng nhập tài khoản.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitations.length === 0 ? (
            <Empty className="rounded-xl border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailCheck />
                </EmptyMedia>
                <EmptyTitle>Không có lời mời đang chờ</EmptyTitle>
                <EmptyDescription>
                  Khi email của bạn được mời vào tổ chức khác, lời mời sẽ xuất hiện tại đây để chấp nhận.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {invitations.map((invitation) => {
            const organization = invitation.publicOrganizationData;
            const isAccepting = acceptingInvitationId === invitation.id;

            return (
              <div
                key={invitation.id}
                className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="lg">
                    <AvatarImage src={organization.imageUrl || undefined} alt={organization.name} />
                    <AvatarFallback>{getInitials(organization.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium">{organization.name}</div>
                      <Badge variant="outline">Đang chờ</Badge>
                    </div>
                    <div className="text-muted-foreground text-sm">{invitation.emailAddress}</div>
                    <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
                      <span>Vai trò: {invitation.role}</span>
                      <span>Ngày mời: {invitation.createdAt.toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={isAccepting || clerkUpdating}
                  onClick={() => void handleAcceptInvitation(invitation)}
                >
                  {isAccepting ? <Loader2 className="animate-spin" /> : <MailCheck />}
                  Chấp nhận lời mời
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Tổ chức đang hoạt động
            </CardTitle>
            <CardDescription>
              Tổ chức này đang được dùng cho phân quyền, thành viên và vai trò truy cập của ERP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeMembership ? (
              <div className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="lg">
                    <AvatarImage
                      src={activeMembership.organization.imageUrl || undefined}
                      alt={activeMembership.organization.name}
                    />
                    <AvatarFallback>{getInitials(activeMembership.organization.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium">{activeMembership.organization.name}</div>
                      <Badge variant="outline">Đang dùng</Badge>
                    </div>
                    <div className="text-muted-foreground text-sm">{activeMembership.role}</div>
                    {activeMembership.organization.slug ? (
                      <div className="text-muted-foreground text-xs">Slug: {activeMembership.organization.slug}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <Empty className="rounded-xl border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2 />
                  </EmptyMedia>
                  <EmptyTitle>Chưa có tổ chức nào</EmptyTitle>
                  <EmptyDescription>
                    Tạo tổ chức đầu tiên để quản lý thành viên, vai trò và quyền truy cập ERP.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-5" />
              Tạo tổ chức mới
            </CardTitle>
            <CardDescription>
              Tạo workspace truy cập riêng cho đội ngũ, phân quyền và luồng duyệt của doanh nghiệp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleCreateOrganization(event)}>
              <div className="space-y-2">
                <Label htmlFor="organization-name">Tên tổ chức</Label>
                <Input
                  id="organization-name"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Ví dụ: Công ty Gia Phú"
                />
              </div>
              <Button type="submit" disabled={creating || clerkUpdating}>
                {creating || clerkUpdating ? <Loader2 className="animate-spin" /> : <Plus />}
                Tạo tổ chức
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Danh sách tổ chức</CardTitle>
          <CardDescription>
            Chọn tổ chức đang làm việc hoặc mở nhanh khu thành viên và vai trò của từng tổ chức.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.length === 0 ? (
            <Empty className="rounded-xl border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 />
                </EmptyMedia>
                <EmptyTitle>Chưa có dữ liệu tổ chức</EmptyTitle>
                <EmptyDescription>
                  Bạn chưa thuộc tổ chức nào. Hãy tạo mới ở khung bên trên để bắt đầu quản lý quyền truy cập ERP.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {memberships.map((membership) => {
            const organization = membership.organization;
            const isActive = organization.id === orgId;
            const isSwitching = switchingOrgId === organization.id;

            return (
              <div
                key={membership.id}
                className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="lg">
                    <AvatarImage src={organization.imageUrl || undefined} alt={organization.name} />
                    <AvatarFallback>{getInitials(organization.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium">{organization.name}</div>
                      {isActive ? (
                        <Badge variant="outline">
                          <CheckCircle2 className="size-3.5" />
                          Đang dùng
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-sm">{membership.role}</div>
                    {organization.slug ? (
                      <div className="text-muted-foreground text-xs">Slug: {organization.slug}</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isActive ? (
                    <Button type="button" variant="outline" disabled>
                      Đang hoạt động
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSwitching || clerkUpdating}
                      onClick={() => void handleSetActiveOrganization(organization.id)}
                    >
                      {isSwitching ? <Loader2 className="animate-spin" /> : <Building2 />}
                      Chọn tổ chức
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
