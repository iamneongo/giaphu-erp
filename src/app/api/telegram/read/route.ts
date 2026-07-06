import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getTelegramAccount, markTelegramThreadRead, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

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
    topicId?: number;
    readMaxId?: number;
  };

  const dialogId = String(body.dialogId ?? "").trim();
  const topicId = Number(body.topicId ?? 0);
  const readMaxId = Number(body.readMaxId ?? 0);

  if (!dialogId || !Number.isFinite(readMaxId) || readMaxId <= 0) {
    return NextResponse.json({ status: "error", message: "Thiếu dữ liệu đánh dấu đã đọc." }, { status: 400 });
  }

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chưa kết nối Telegram." }, { status: 400 });
  }

  try {
    await markTelegramThreadRead(
      account.encryptedSession,
      dialogId,
      readMaxId,
      Number.isFinite(topicId) && topicId > 0 ? topicId : undefined,
    );
    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Telegram read failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
