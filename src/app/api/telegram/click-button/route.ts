import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { recordGiaPhuActivity } from "@/lib/giaphu-erp/db";
import { clickTelegramMessageButton, getTelegramAccount, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }
  if (!session.orgId) {
    return NextResponse.json(
      { status: "error", message: "Vui lòng chọn tổ chức trước khi dùng ERP." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    dialogId?: string;
    messageId?: number;
    row?: number;
    column?: number;
  };

  const dialogId = String(body.dialogId ?? "").trim();
  const messageId = Number(body.messageId ?? 0);
  const row = Number(body.row ?? -1);
  const column = Number(body.column ?? -1);

  if (!dialogId || !Number.isFinite(messageId) || messageId <= 0 || row < 0 || column < 0) {
    return NextResponse.json({ status: "error", message: "Thiếu dữ liệu thao tác nút Telegram." }, { status: 400 });
  }

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chưa kết nối Telegram." }, { status: 400 });
  }

  try {
    const result = await clickTelegramMessageButton(account.encryptedSession, dialogId, messageId, row, column);

    const user = await currentUser();
    await recordGiaPhuActivity({
      organizationId: session.orgId,
      userId: session.userId,
      actorName: user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
      actorEmail: user?.primaryEmailAddress?.emailAddress ?? "",
      action: "telegramClickButton",
      module: "telegram",
      entityId: `${dialogId}:${messageId}`,
      summary: `Bấm nút Telegram ở tin nhắn ${messageId} trong cuộc trò chuyện ${dialogId}`,
    }).catch((error) => console.error("Failed to record Gia Phu activity", error));

    return NextResponse.json({ status: "success", data: result });
  } catch (error) {
    console.error("Telegram click-button failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
