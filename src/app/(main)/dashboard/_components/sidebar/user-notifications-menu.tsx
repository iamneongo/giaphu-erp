"use client";

import * as React from "react";

import Link from "next/link";

import { Bell, BriefcaseBusiness, ReceiptText, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import {
  ACTIVE_PROJECT_CHANGE_EVENT,
  type ActiveProjectChangeDetail,
  readActiveProjectCode,
  readActiveProjectRouteId,
} from "@/lib/giaphu-erp/project-context";
import { erpPathForProject } from "@/lib/giaphu-erp/project-routes";

const notifications = [
  {
    id: "payment-follow-up",
    title: "Theo dõi thu tiền công trình",
    description: "Rà lại các đợt thanh toán đến hạn và cập nhật khoản đã thu trong CRM công trình.",
    icon: ReceiptText,
    href: "/dashboard/giaphu-erp/crm",
    cta: "Mở CRM",
    tone: "secondary" as const,
  },
  {
    id: "cost-review",
    title: "Kiểm tra phát sinh chi phí",
    description: "Vật tư, nhân công và vận hành nên được đối soát trước khi chốt báo cáo tuần.",
    icon: TriangleAlert,
    href: "/dashboard/giaphu-erp/reports",
    cta: "Xem báo cáo",
    tone: "destructive" as const,
  },
  {
    id: "project-overview",
    title: "Cập nhật tiến độ công trình",
    description: "Bổ sung tiến độ và hồ sơ mới để màn tổng quan phản ánh đúng tình trạng hiện tại.",
    icon: BriefcaseBusiness,
    href: "/dashboard/giaphu-erp/overview",
    cta: "Mở tổng quan",
    tone: "outline" as const,
  },
];

export function UserNotificationsMenu() {
  const [activeProjectRouteId, setActiveProjectRouteId] = React.useState("");

  React.useEffect(() => {
    setActiveProjectRouteId(readActiveProjectRouteId() || readActiveProjectCode());

    function handleProjectChange(event: Event) {
      const detail = (event as CustomEvent<ActiveProjectChangeDetail>).detail;
      const nextCode = detail?.code;
      if (nextCode) {
        setActiveProjectRouteId(detail.routeId || nextCode);
      }
    }

    window.addEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);

    return () => {
      window.removeEventListener(ACTIVE_PROJECT_CHANGE_EVENT, handleProjectChange);
    };
  }, []);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Bell />
        Thông báo
        <Badge variant="secondary" className="ml-auto">
          {notifications.length} mới
        </Badge>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-88 space-y-3 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <div className="font-medium text-sm">Thông báo công trình</div>
            <div className="text-muted-foreground text-xs">Nhắc việc quan trọng theo đúng workflow ERP.</div>
          </div>
          <Badge variant="outline">{notifications.length}</Badge>
        </div>

        <ItemGroup className="gap-2.5">
          {notifications.map((notification) => {
            const Icon = notification.icon;

            return (
              <Item key={notification.id} variant="outline" size="xs" className="rounded-xl">
                <ItemMedia variant="icon">
                  <Icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{notification.title}</ItemTitle>
                  <ItemDescription>{notification.description}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button asChild size="xs" variant={notification.tone}>
                    <Link
                      href={
                        activeProjectRouteId
                          ? erpPathForProject(activeProjectRouteId, notification.href)
                          : notification.href
                      }
                    >
                      {notification.cta}
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
