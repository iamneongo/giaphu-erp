"use client";

import { useEffect, useState } from "react";

import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { getInitials } from "@/lib/utils";

import type { TelegramDialogDto } from "./types";

type DialogListProps = {
  onSelect: (dialog: TelegramDialogDto) => void;
};

export function DialogList({ onSelect }: DialogListProps) {
  const [dialogs, setDialogs] = useState<TelegramDialogDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/telegram/dialogs");
        const json = await res.json();
        if (cancelled) return;
        if (json.status === "success") {
          setDialogs(json.data.dialogs);
        } else {
          toast.error(json.message || "Không tải được danh sách trò chuyện.");
          setDialogs((current) => current ?? []);
        }
      } catch {
        if (!cancelled) setDialogs((current) => current ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading && !dialogs) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!dialogs || dialogs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-muted-foreground text-sm">
        Chưa có cuộc trò chuyện nào.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" orientation="vertical">
      <div className="flex flex-col divide-y">
        {dialogs.map((dialog) => (
          <button
            key={dialog.id}
            type="button"
            onClick={() => onSelect(dialog)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
          >
            <Avatar className="shrink-0">
              {dialog.avatarUrl ? <AvatarImage src={dialog.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-primary/10 font-medium text-primary">
                {getInitials(dialog.title)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-sm">
                  {dialog.title || "(Không có tên)"}
                </span>
                {dialog.lastMessage?.date ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(dialog.lastMessage.date), { addSuffix: true, locale: vi })}
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                  {dialog.lastMessage?.outgoing ? "Bạn: " : ""}
                  {dialog.lastMessage?.text || ""}
                </span>
                {dialog.unreadCount > 0 ? (
                  <Badge
                    variant="default"
                    className="h-4.5 min-w-4.5 shrink-0 justify-center rounded-full px-1 text-[10px]"
                  >
                    {dialog.unreadCount > 99 ? "99+" : dialog.unreadCount}
                  </Badge>
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
