import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getTelegramAccount, listTelegramMessages, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const dialogId = searchParams.get("dialogId")?.trim() ?? "";
  const topicId = Number(searchParams.get("topicId") ?? "");
  if (!dialogId) {
    return NextResponse.json({ status: "error", message: "Thiếu mã cuộc trò chuyện." }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30) || 30, 1), 100);

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chưa kết nối Telegram." }, { status: 400 });
  }

  try {
    const messages = await listTelegramMessages(
      account.encryptedSession,
      dialogId,
      Number.isFinite(topicId) && topicId > 0 ? topicId : undefined,
      limit,
    );
    return NextResponse.json({ status: "success", data: { messages } });
  } catch (error) {
    console.error("Telegram list messages failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
