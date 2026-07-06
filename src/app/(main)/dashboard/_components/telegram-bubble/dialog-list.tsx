"use client";

import { useEffect, useState } from "react";

import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { vi } from "date-fns/locale";
import { Megaphone, User, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn, getInitials } from "@/lib/utils";

import type { TelegramDialogDto } from "./types";

type DialogListProps = {
  onSelect: (dialog: TelegramDialogDto) => void;
};

function getDialogAvatarTone(dialog: TelegramDialogDto) {
  if (dialog.isChannel) {
    return {
      shell: "bg-[linear-gradient(145deg,#132033,#0c1524)] text-sky-200",
      badge: "bg-sky-500 text-white",
    };
  }

  if (dialog.isGroup) {
    return {
      shell: "bg-[linear-gradient(145deg,#162432,#0f1724)] text-emerald-200",
      badge: "bg-emerald-500 text-white",
    };
  }

  return {
    shell: "bg-[linear-gradient(145deg,#152334,#0e1624)] text-slate-100",
    badge: "bg-sky-500 text-white",
  };
}

function getDialogAvatarLabel(title: string) {
  const normalized = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const words = normalized
    .split(/[\s._\-()[\]{}]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const alphanumeric = words
    .map((part) => part.replace(/[^0-9A-Za-z]/g, ""))
    .filter(Boolean);

  if (alphanumeric.length >= 2) {
    return `${alphanumeric[0][0] ?? ""}${alphanumeric[1][0] ?? ""}`.toUpperCase();
  }

  const compact = normalized.replace(/[^0-9A-Za-z]/g, "");
  if (compact.length >= 2) {
    return compact.slice(0, 2).toUpperCase();
  }

  return (getInitials(title).replace(/[^0-9A-Za-z]/g, "").slice(0, 2) || "TG").toUpperCase();
}

function DialogAvatar({ dialog }: { dialog: TelegramDialogDto }) {
  const tone = getDialogAvatarTone(dialog);
  const initials = getDialogAvatarLabel(dialog.title);
  const BadgeIcon = dialog.isChannel ? Megaphone : dialog.isGroup ? Users : User;

  return (
    <Avatar className="size-10 shrink-0 overflow-visible ring-1 ring-white/10">
      <AvatarFallback
        className={cn(
          "relative rounded-full border border-white/10 text-[13px] font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          tone.shell,
        )}
      >
        <span className="truncate px-1 uppercase">{initials}</span>
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border border-[#0b0f19] shadow-sm",
            tone.badge,
          )}
        >
          <BadgeIcon className="size-2.5" strokeWidth={2.4} />
        </span>
      </AvatarFallback>
    </Avatar>
  );
}

export function DialogList({ onSelect }: DialogListProps) {
  const [dialogs, setDialogs] = useState<TelegramDialogDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDialogs(showError = true) {
    try {
      const res = await fetch("/api/telegram/dialogs");
      const json = await res.json();
      if (json.status === "success") {
        setDialogs(json.data.dialogs);
      } else {
        if (showError) {
          toast.error(json.message || "Khong tai duoc danh sach tro chuyen.");
        }
        setDialogs((current) => current ?? []);
      }
    } catch {
      if (showError) {
        toast.error("Khong tai duoc danh sach tro chuyen.");
      }
      setDialogs((current) => current ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      await loadDialogs(false);
    }

    void load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleReadStateChanged() {
      void loadDialogs(false);
    }

    window.addEventListener("telegram-read-state-changed", handleReadStateChanged);
    return () => {
      window.removeEventListener("telegram-read-state-changed", handleReadStateChanged);
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
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/45">
        Chua co cuoc tro chuyen nao.
      </div>
    );
  }

  const sortedDialogs = [...dialogs].sort((left, right) => {
    const unreadDelta = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
    if (unreadDelta !== 0) return unreadDelta;
    return right.unreadCount - left.unreadCount;
  });

  return (
    <ScrollArea className="h-full" orientation="vertical">
      <div className="flex flex-col divide-y divide-white/6">
        {sortedDialogs.map((dialog) => (
          <button
            key={dialog.id}
            type="button"
            onClick={() => onSelect(dialog)}
            className={
              dialog.unreadCount > 0
                ? "flex items-center gap-3 border-l-2 border-[#26A5E4] bg-[#26A5E4]/8 px-3 py-3 text-left text-white transition-colors hover:bg-[#26A5E4]/14"
                : "flex items-center gap-3 px-3 py-3 text-left text-white transition-colors hover:bg-white/6"
            }
          >
            <DialogAvatar dialog={dialog} />

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-sm">
                    {dialog.title || "(Khong co ten)"}
                  </span>
                  {dialog.unreadCount > 0 ? (
                    <span className="shrink-0 rounded-full bg-[#26A5E4]/18 px-1.5 py-0.5 text-[10px] font-medium text-[#8fd8ff]">
                      Moi
                    </span>
                  ) : null}
                </div>
                {dialog.lastMessage?.date ? (
                  <span className="shrink-0 text-[11px] text-white/40">
                    {formatDistanceToNow(new Date(dialog.lastMessage.date), { addSuffix: true, locale: vi })}
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/55">
                  {dialog.lastMessage?.outgoing ? "Ban: " : ""}
                  {dialog.lastMessage?.text || ""}
                </span>
                {dialog.unreadCount > 0 ? (
                  <Badge
                    variant="default"
                    className="h-5 min-w-5 shrink-0 justify-center rounded-full border-0 bg-[#26A5E4] px-1 text-[10px] text-white"
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
