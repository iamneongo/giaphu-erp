"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type { TelegramDialogDto, TelegramMessageDto } from "./types";

type ThreadViewProps = {
  dialog: TelegramDialogDto;
  onBack: () => void;
};

export function ThreadView({ dialog, onBack }: ThreadViewProps) {
  const [messages, setMessages] = useState<TelegramMessageDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ dialogId: dialog.parentDialogId ?? dialog.id });
        if (dialog.topicId) {
          params.set("topicId", String(dialog.topicId));
        }
        const res = await fetch(`/api/telegram/messages?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.status === "success") {
          setMessages(json.data.messages);
        } else {
          toast.error(json.message || "Không tải được tin nhắn.");
          setMessages((current) => current ?? []);
        }
      } catch {
        if (!cancelled) setMessages((current) => current ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dialog.id, dialog.parentDialogId, dialog.topicId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages is a trigger-only dependency, not read in the effect body
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const messageText = reply.trim();
    if (!messageText || sending) return;

    setSending(true);
    const optimisticMessage: TelegramMessageDto = {
      id: -Date.now(),
      text: messageText,
      date: new Date().toISOString(),
      outgoing: true,
      senderName: "",
    };
    setMessages((current) => [...(current ?? []), optimisticMessage]);
    setReply("");

    try {
      const res = await fetch("/api/telegram/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogId: dialog.parentDialogId ?? dialog.id,
          topicId: dialog.topicId,
          text: messageText,
        }),
      });
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message || "Gửi tin nhắn thất bại.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi tin nhắn thất bại.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-white/65 hover:bg-white/10 hover:text-white"
          onClick={onBack}
          aria-label="Quay lại"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <span className="min-w-0 flex-1 truncate font-medium text-sm">{dialog.title}</span>
      </div>

      <div className="min-h-0 flex-1">
        {loading && !messages ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ScrollArea className="h-full" orientation="vertical">
            <div className="flex flex-col gap-2.5 p-3">
              {(messages ?? []).map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    message.outgoing
                      ? "self-end rounded-br-md bg-[#26A5E4] text-white"
                      : "self-start rounded-bl-md border border-white/8 bg-white/6 text-white",
                  )}
                >
                  {!message.outgoing && message.senderName ? (
                    <div className="mb-0.5 font-medium text-[11px] text-white/55">{message.senderName}</div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words">{message.text}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}
      </div>

      <form className="flex items-center gap-2 border-t border-white/10 bg-white/4 p-2" onSubmit={handleSend}>
        <Input
          className="h-10 rounded-full border-white/10 bg-white/6 px-4 text-white placeholder:text-white/35 focus-visible:border-[#26A5E4] focus-visible:ring-[#26A5E4]/20"
          placeholder="Nhập trả lời..."
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          disabled={sending}
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full border-0 bg-[#26A5E4] text-white hover:bg-[#1d93cd]"
          disabled={sending || !reply.trim()}
          aria-label="Gửi"
        >
          {sending ? <Spinner /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
