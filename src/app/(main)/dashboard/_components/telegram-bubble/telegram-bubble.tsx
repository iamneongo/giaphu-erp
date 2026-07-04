"use client";

import { useCallback, useEffect, useState } from "react";

import { LogOut, Maximize2, Minimize2 } from "lucide-react";
import { createPortal } from "react-dom";
import { siTelegram } from "simple-icons";
import { toast } from "sonner";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { ConnectForm } from "./connect-form";
import { DialogList } from "./dialog-list";
import { ThreadView } from "./thread-view";
import { TopicList } from "./topic-list";
import type { TelegramDialogDto } from "./types";

type BubbleState = "loading" | "disconnected" | "connected";

export function TelegramBubble() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasLoadedStatus, setHasLoadedStatus] = useState(false);
  const [state, setState] = useState<BubbleState>("loading");
  const [selectedDialog, setSelectedDialog] = useState<TelegramDialogDto | null>(null);
  const [selectedTopicParent, setSelectedTopicParent] = useState<TelegramDialogDto | null>(null);
  const [topics, setTopics] = useState<TelegramDialogDto[] | null>(null);
  const [openingDialogId, setOpeningDialogId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/status");
      const json = await res.json();
      setState(json.status === "success" && json.data.connected ? "connected" : "disconnected");
    } catch {
      setState("disconnected");
    } finally {
      setHasLoadedStatus(true);
    }
  }, []);

  useEffect(() => {
    if (open && !hasLoadedStatus) {
      void loadStatus();
    }
  }, [open, hasLoadedStatus, loadStatus]);

  const handleConnected = useCallback(() => {
    setState("connected");
    toast.success("Đã kết nối Telegram");
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch("/api/telegram/disconnect", { method: "POST" });
    } catch {
      // best-effort: local state resets regardless
    }
    setSelectedDialog(null);
    setSelectedTopicParent(null);
    setTopics(null);
    setState("disconnected");
  }, []);

  const handleSelectDialog = useCallback(async (dialog: TelegramDialogDto) => {
    if (!dialog.isGroup && !dialog.isChannel) {
      setSelectedTopicParent(null);
      setTopics(null);
      setSelectedDialog(dialog);
      return;
    }

    setOpeningDialogId(dialog.id);
    try {
      const params = new URLSearchParams({ dialogId: dialog.id });
      const res = await fetch(`/api/telegram/topics?${params.toString()}`);
      const json = await res.json();

      if (json.status === "success" && Array.isArray(json.data?.topics) && json.data.topics.length > 0) {
        setSelectedDialog(null);
        setSelectedTopicParent(dialog);
        setTopics(json.data.topics);
        return;
      }

      setSelectedTopicParent(null);
      setTopics(null);
      setSelectedDialog(dialog);
    } catch {
      setSelectedTopicParent(null);
      setTopics(null);
      setSelectedDialog(dialog);
    } finally {
      setOpeningDialogId(null);
    }
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelectedDialog(null);
          setSelectedTopicParent(null);
          setTopics(null);
          setOpeningDialogId(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          className="fixed right-6 bottom-6 z-50 size-12 rounded-full p-0 shadow-lg"
          aria-label="Mở Telegram"
        >
          <SimpleIcon icon={siTelegram} className="size-5 fill-primary-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className={cn(
          "gap-0 overflow-hidden p-0 transition-[width,height] duration-150 ease-out",
          expanded ? "h-[75vh] w-[26rem] max-w-[92vw]" : "h-[28rem] w-80",
        )}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-lg">
          <div className="flex items-center justify-between gap-1 border-b bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 font-medium text-sm">
              <SimpleIcon icon={siTelegram} className="size-4 fill-[#26A5E4]" />
              Telegram
            </div>
            <div className="flex items-center gap-0.5">
              {state === "connected" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDisconnect}
                  aria-label="Ngắt kết nối"
                  title="Ngắt kết nối"
                >
                  <LogOut className="size-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded((current) => !current)}
                aria-label={expanded ? "Thu nhỏ" : "Phóng to"}
                title={expanded ? "Thu nhỏ" : "Phóng to"}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {state === "loading" ? (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            ) : state === "disconnected" ? (
              <ConnectForm onConnected={handleConnected} />
            ) : selectedDialog ? (
              <ThreadView dialog={selectedDialog} onBack={() => setSelectedDialog(null)} />
            ) : selectedTopicParent && topics ? (
              <TopicList
                parentTitle={selectedTopicParent.title}
                topics={topics}
                onBack={() => {
                  setSelectedTopicParent(null);
                  setTopics(null);
                }}
                onSelect={setSelectedDialog}
              />
            ) : openingDialogId ? (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <DialogList onSelect={handleSelectDialog} />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>,
    document.body,
  );
}
