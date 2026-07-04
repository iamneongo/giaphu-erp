import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getTelegramAccount, listTelegramTopics, telegramErrorMessage } from "@/lib/giaphu-erp/telegram";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session.userId) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }
  if (!session.orgId) {
    return NextResponse.json(
      { status: "error", message: "Vui long chon to chuc truoc khi dung ERP." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const dialogId = searchParams.get("dialogId")?.trim() ?? "";
  if (!dialogId) {
    return NextResponse.json({ status: "error", message: "Thieu ma cuoc tro chuyen." }, { status: 400 });
  }

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return NextResponse.json({ status: "error", message: "Chua ket noi Telegram." }, { status: 400 });
  }

  try {
    const topics = await listTelegramTopics(account.encryptedSession, dialogId);
    return NextResponse.json({ status: "success", data: { topics } });
  } catch (error) {
    console.error("Telegram list topics failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
