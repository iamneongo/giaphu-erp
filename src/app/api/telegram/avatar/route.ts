import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { downloadDialogAvatar, getTelegramAccount } from "@/lib/giaphu-erp/telegram";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session.userId || !session.orgId) {
    return new NextResponse(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dialogId = searchParams.get("dialogId")?.trim() ?? "";
  if (!dialogId) {
    return new NextResponse(null, { status: 404 });
  }

  const account = await getTelegramAccount(session.orgId, session.userId);
  if (!account || account.status !== "connected" || !account.encryptedSession) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const buffer = await downloadDialogAvatar(account.encryptedSession, dialogId);
    if (!buffer) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Telegram avatar fetch failed", error);
    return new NextResponse(null, { status: 404 });
  }
}
