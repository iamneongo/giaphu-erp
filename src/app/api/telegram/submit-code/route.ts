import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { recordGiaPhuActivity } from "@/lib/giaphu-erp/db";
import {
  clearPendingTelegramLogin,
  completeTelegramCodeSignIn,
  getPendingTelegramLogin,
  savePendingTelegramLogin,
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

  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ status: "error", message: "Vui lòng nhập mã xác thực." }, { status: 400 });
  }

  try {
    const result = await completeTelegramCodeSignIn(pending, code);

    if (result.status === "password_needed") {
      await savePendingTelegramLogin(session.orgId, session.userId, {
        ...pending,
        step: "password",
        partialSession: result.partialSession,
      });
      return NextResponse.json({ status: "success", data: { step: "password" } });
    }

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
      summary: "Kết nối tài khoản Telegram thành công",
    }).catch((error) => console.error("Failed to record Gia Phu activity", error));

    return response;
  } catch (error) {
    console.error("Telegram submit-code failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
