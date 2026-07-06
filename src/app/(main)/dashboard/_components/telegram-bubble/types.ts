export type TelegramDialogDto = {
  id: string;
  title: string;
  isGroup: boolean;
  isChannel: boolean;
  unreadCount: number;
  avatarUrl: string;
  topicId?: number;
  parentDialogId?: string;
  lastMessage: { text: string; date: string; outgoing: boolean } | null;
};

export type TelegramMessageDto = {
  id: number;
  text: string;
  date: string;
  outgoing: boolean;
  senderName: string;
  media?: TelegramMessageMediaDto[];
  buttons?: TelegramMessageButtonDto[][];
  reactions?: TelegramMessageReactionDto[];
};

export type TelegramMessageMediaDto = {
  kind: "image";
  url: string;
};

export type TelegramMessageButtonDto = {
  text: string;
  kind: "callback" | "url" | "switch_inline" | "text" | "unknown";
  url?: string;
};

export type TelegramMessageReactionDto = {
  emoji: string;
  count: number;
  chosen: boolean;
};
