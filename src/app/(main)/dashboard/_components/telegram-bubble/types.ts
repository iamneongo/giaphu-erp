export type TelegramDialogDto = {
  id: string;
  title: string;
  isGroup: boolean;
  isChannel: boolean;
  unreadCount: number;
  avatarUrl: string;
  lastMessage: { text: string; date: string; outgoing: boolean } | null;
};

export type TelegramMessageDto = {
  id: number;
  text: string;
  date: string;
  outgoing: boolean;
  senderName: string;
};
