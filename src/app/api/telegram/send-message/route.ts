import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { recordGiaPhuActivity } from "@/lib/giaphu-erp/db";
import { getTelegramAccount, sendTelegramMessage, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

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

  const body = (await request.json().catch(() => ({}))) as { dialogId?: string; text?: string };
  const dialogId = String(body.dialogId ?? "").trim();
  const messageText = String(body.text ?? "").trim();

  if (!dialogId) {
    return NextResponse.json({ status: "error", message: "Thiếu mã cuộc trò chuyện." }, { status: 400 });
  }
  if (!messageText) {
    return NextResponse.json({ status: "error", message: "Vui lòng nhập nội dung tin nhắn." }, { status: 400 });
  }

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chưa kết nối Telegram." }, { status: 400 });
  }

  try {
    const message = await sendTelegramMessage(account.encryptedSession, dialogId, messageText);

    const user = await currentUser();
    await recordGiaPhuActivity({
      organizationId: session.orgId,
      userId: session.userId,
      actorName: user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
      actorEmail: user?.primaryEmailAddress?.emailAddress ?? "",
      action: "telegramSendMessage",
      module: "telegram",
      entityId: dialogId,
      summary: `Gửi tin nhắn Telegram trong cuộc trò chuyện ${dialogId}`,
    }).catch((error) => console.error("Failed to record Gia Phu activity", error));

    return NextResponse.json({ status: "success", data: { message } });
  } catch (error) {
    console.error("Telegram send-message failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
