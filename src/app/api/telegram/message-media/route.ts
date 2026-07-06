import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { downloadTelegramMessageMedia, getTelegramAccount, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

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
  const messageId = Number(searchParams.get("messageId") ?? 0);

  if (!dialogId || !Number.isFinite(messageId) || messageId <= 0) {
    return NextResponse.json({ status: "error", message: "Thiếu dữ liệu media Telegram." }, { status: 400 });
  }

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chưa kết nối Telegram." }, { status: 400 });
  }

  try {
    const media = await downloadTelegramMessageMedia(account.encryptedSession, dialogId, messageId);
    if (!media) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new Response(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Telegram message-media failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
