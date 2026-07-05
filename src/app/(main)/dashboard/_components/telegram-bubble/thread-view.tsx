"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowLeft, Send, SmilePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type { TelegramDialogDto, TelegramMessageButtonDto, TelegramMessageDto } from "./types";

type ThreadViewProps = {
  dialog: TelegramDialogDto;
  onBack: () => void;
};

const TELEGRAM_REACTION_OPTIONS = ["👍", "❤️", "🔥", "🎉", "😄", "😢"];

export function ThreadView({ dialog, onBack }: ThreadViewProps) {
  const [messages, setMessages] = useState<TelegramMessageDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<number | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadMessages(showError = true) {
    const params = new URLSearchParams({ dialogId: dialog.parentDialogId ?? dialog.id });
    if (dialog.topicId) {
      params.set("topicId", String(dialog.topicId));
    }

    try {
      const res = await fetch(`/api/telegram/messages?${params.toString()}`);
      const json = await res.json();
      if (json.status === "success") {
        setMessages(json.data.messages);
      } else {
        if (showError) {
          toast.error(json.message || "Khong tai duoc tin nhan.");
        }
        setMessages((current) => current ?? []);
      }
    } catch {
      if (showError) {
        toast.error("Khong tai duoc tin nhan.");
      }
      setMessages((current) => current ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run(showError = true) {
      if (cancelled) return;

      const params = new URLSearchParams({ dialogId: dialog.parentDialogId ?? dialog.id });
      if (dialog.topicId) {
        params.set("topicId", String(dialog.topicId));
      }

      try {
        const res = await fetch(`/api/telegram/messages?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.status === "success") {
          setMessages(json.data.messages);
        } else {
          if (showError) {
            toast.error(json.message || "Khong tai duoc tin nhan.");
          }
          setMessages((current) => current ?? []);
        }
      } catch {
        if (!cancelled) {
          if (showError) {
            toast.error("Khong tai duoc tin nhan.");
          }
          setMessages((current) => current ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    const interval = setInterval(() => void run(false), 15000);
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
        throw new Error(json.message || "Gui tin nhan that bai.");
      }
      await loadMessages(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gui tin nhan that bai.");
    } finally {
      setSending(false);
    }
  }

  async function handleButtonClick(messageId: number, row: number, column: number, button: TelegramMessageButtonDto) {
    if (button.kind === "url" && button.url) {
      window.open(button.url, "_blank", "noopener,noreferrer");
      return;
    }

    const actionId = `button:${messageId}:${row}:${column}`;
    if (actingKey) return;

    setActingKey(actionId);
    try {
      const res = await fetch("/api/telegram/click-button", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogId: dialog.parentDialogId ?? dialog.id,
          messageId,
          row,
          column,
        }),
      });
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message || "Khong bam duoc tuy chon.");
      }
      if (json.data?.url) {
        window.open(String(json.data.url), "_blank", "noopener,noreferrer");
      }
      await loadMessages(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Khong bam duoc tuy chon.");
    } finally {
      setActingKey(null);
    }
  }

  async function handleReaction(messageId: number, emoji: string, chosen: boolean) {
    const actionId = `reaction:${messageId}:${emoji}`;
    if (actingKey) return;

    setActingKey(actionId);
    try {
      const res = await fetch("/api/telegram/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogId: dialog.parentDialogId ?? dialog.id,
          messageId,
          emoji: chosen ? "" : emoji,
        }),
      });
      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message || "Khong tha reaction duoc.");
      }
      setActiveReactionMessageId(null);
      await loadMessages(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Khong tha reaction duoc.");
    } finally {
      setActingKey(null);
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
          aria-label="Quay lai"
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

                  {message.buttons?.length ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {message.buttons.map((row, rowIndex) => (
                        <div key={`${message.id}-row-${rowIndex}`} className="flex flex-wrap gap-1.5">
                          {row.map((button, columnIndex) => (
                            <button
                              key={`${message.id}-${rowIndex}-${columnIndex}-${button.text}`}
                              type="button"
                              className="rounded-full border border-[#26A5E4]/35 bg-[#26A5E4]/14 px-3 py-1 text-left text-[12px] text-[#8fd8ff] transition-colors hover:bg-[#26A5E4]/22"
                              disabled={Boolean(actingKey)}
                              onClick={() => void handleButtonClick(message.id, rowIndex, columnIndex, button)}
                            >
                              {button.text}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {message.reactions?.map((reaction) => (
                      <button
                        key={`${message.id}-${reaction.emoji}`}
                        type="button"
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                          reaction.chosen
                            ? "border-[#26A5E4]/50 bg-[#26A5E4]/18 text-[#b7e8ff]"
                            : "border-white/10 bg-white/6 text-white/75 hover:bg-white/10",
                        )}
                        disabled={Boolean(actingKey)}
                        onClick={() => void handleReaction(message.id, reaction.emoji, reaction.chosen)}
                      >
                        {reaction.emoji} {reaction.count}
                      </button>
                    ))}

                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-full border border-white/10 bg-white/6 p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        onClick={() =>
                          setActiveReactionMessageId((current) => (current === message.id ? null : message.id))
                        }
                      >
                        <SmilePlus className="size-3.5" />
                      </button>

                      {activeReactionMessageId === message.id ? (
                        <div className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-full border border-white/10 bg-[#0b1220] p-1 shadow-lg">
                          {TELEGRAM_REACTION_OPTIONS.map((emoji) => {
                            const chosen = Boolean(message.reactions?.some((reaction) => reaction.emoji === emoji && reaction.chosen));
                            return (
                              <button
                                key={`${message.id}-picker-${emoji}`}
                                type="button"
                                className={cn(
                                  "rounded-full px-2 py-1 text-sm transition-colors hover:bg-white/10",
                                  chosen ? "bg-[#26A5E4]/18" : "",
                                )}
                                disabled={Boolean(actingKey)}
                                onClick={() => void handleReaction(message.id, emoji, chosen)}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
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
          placeholder="Nhap tra loi..."
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          disabled={sending}
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full border-0 bg-[#26A5E4] text-white hover:bg-[#1d93cd]"
          disabled={sending || !reply.trim()}
          aria-label="Gui"
        >
          {sending ? <Spinner /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
