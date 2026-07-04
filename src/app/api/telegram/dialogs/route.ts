import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getTelegramAccount, listTelegramDialogs, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

export const runtime = "nodejs";

export async function GET() {
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

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chưa kết nối Telegram." }, { status: 400 });
  }

  try {
    const dialogs = await listTelegramDialogs(account.encryptedSession);
    return NextResponse.json({ status: "success", data: { dialogs } });
  } catch (error) {
    console.error("Telegram list dialogs failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
