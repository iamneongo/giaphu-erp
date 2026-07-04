import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { recordGiaPhuActivity } from "@/lib/giaphu-erp/db";
import {
  clearPendingTelegramLogin,
  completeTelegramPasswordSignIn,
  getPendingTelegramLogin,
  saveTelegramAccount,
  telegramErrorMessage,
} from "@/lib/giaphu-erp/telegram";

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

  const pending = await getPendingTelegramLogin(session.orgId, session.userId);
  if (!pending) {
    return NextResponse.json(
      { status: "error", message: "Phiên đăng nhập Telegram đã hết hạn, vui lòng thử lại." },
      { status: 400 },
    );
  }

  if (pending.clerkUserId !== session.userId || pending.organizationId !== session.orgId) {
    return NextResponse.json({ status: "error", message: "Phiên đăng nhập Telegram không hợp lệ." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = String(body.password ?? "");
  if (!password) {
    return NextResponse.json({ status: "error", message: "Vui lòng nhập mật khẩu." }, { status: 400 });
  }

  try {
    const result = await completeTelegramPasswordSignIn(pending, password);

    await saveTelegramAccount(session.orgId, session.userId, {
      encryptedSession: result.encryptedSession,
      phoneNumber: pending.phoneNumber,
      telegramUserId: result.telegramUserId,
      displayName: result.displayName,
      username: result.username,
      status: "connected",
    });

    await clearPendingTelegramLogin(session.orgId, session.userId);

    const response = NextResponse.json({
      status: "success",
      data: { step: "connected", displayName: result.displayName, username: result.username },
    });

    const user = await currentUser();
    await recordGiaPhuActivity({
      organizationId: session.orgId,
      userId: session.userId,
      actorName: user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
      actorEmail: user?.primaryEmailAddress?.emailAddress ?? "",
      action: "telegramConnect",
      module: "telegram",
      summary: "Kết nối tài khoản Telegram thành công (2FA)",
    }).catch((error) => console.error("Failed to record Gia Phu activity", error));

    return response;
  } catch (error) {
    console.error("Telegram submit-password failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
