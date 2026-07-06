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
  const sortedTopics = [...topics].sort((left, right) => {
    const unreadDelta = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
    if (unreadDelta !== 0) return unreadDelta;
    return right.unreadCount - left.unreadCount;
  });

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
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm">{parentTitle}</div>
          <div className="truncate text-white/45 text-xs">Topics</div>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/45">
          Group nay chua co topic nao.
        </div>
      ) : (
        <ScrollArea className="h-full" orientation="vertical">
          <div className="flex flex-col divide-y divide-white/6">
            {sortedTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSelect(topic)}
                className={topic.unreadCount > 0
                  ? "flex items-center gap-3 border-l-2 border-[#26A5E4] bg-[#26A5E4]/8 px-3 py-3 text-left text-white transition-colors hover:bg-[#26A5E4]/14"
                  : "flex items-center gap-3 px-3 py-3 text-left text-white transition-colors hover:bg-white/6"}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(145deg,#182534,#111b28)] text-sky-200 ring-1 ring-white/10">
                  <Hash className="size-4" strokeWidth={2.2} />
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium text-sm">{topic.title}</div>
                    {topic.unreadCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-[#26A5E4]/18 px-1.5 py-0.5 text-[10px] font-medium text-[#8fd8ff]">
                        Moi
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-[12px] text-white/55">{topic.lastMessage?.text || ""}</div>
                </div>

                {topic.unreadCount > 0 ? (
                  <Badge
                    variant="default"
                    className="h-5 min-w-5 shrink-0 justify-center rounded-full border-0 bg-[#26A5E4] px-1 text-[10px] text-white"
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
