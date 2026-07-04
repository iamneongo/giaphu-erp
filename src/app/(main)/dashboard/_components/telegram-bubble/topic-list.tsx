"use client";

import { ArrowLeft, Hash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { TelegramDialogDto } from "./types";

type TopicListProps = {
  parentTitle: string;
  topics: TelegramDialogDto[];
  onBack: () => void;
  onSelect: (topic: TelegramDialogDto) => void;
};

export function TopicList({ parentTitle, topics, onBack, onSelect }: TopicListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Quay lai">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm">{parentTitle}</div>
          <div className="truncate text-muted-foreground text-xs">Topics</div>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-muted-foreground text-sm">
          Group nay chua co topic nao.
        </div>
      ) : (
        <ScrollArea className="h-full" orientation="vertical">
          <div className="flex flex-col divide-y">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSelect(topic)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#e7f7ee,#cfeeda)] text-emerald-700 ring-1 ring-black/6">
                  <Hash className="size-4" strokeWidth={2.2} />
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="truncate font-medium text-sm">{topic.title}</div>
                  <div className="truncate text-muted-foreground text-xs">{topic.lastMessage?.text || ""}</div>
                </div>

                {topic.unreadCount > 0 ? (
                  <Badge
                    variant="default"
                    className="h-4.5 min-w-4.5 shrink-0 justify-center rounded-full px-1 text-[10px]"
                  >
                    {topic.unreadCount > 99 ? "99+" : topic.unreadCount}
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
