import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { recordGiaPhuActivity } from "@/lib/giaphu-erp/db";
import { isValidPhoneNumber } from "@/lib/giaphu-erp/phone";
import {
  savePendingTelegramLogin,
  initiateTelegramLogin,
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

  const body = (await request.json().catch(() => ({}))) as { phoneNumber?: string };
  const phoneNumber = String(body.phoneNumber ?? "").trim();

  if (!isValidPhoneNumber(phoneNumber)) {
    return NextResponse.json({ status: "error", message: "Số điện thoại không hợp lệ." }, { status: 400 });
  }

  try {
    const { partialSession, phoneCodeHash } = await initiateTelegramLogin(phoneNumber);

    await savePendingTelegramLogin(session.orgId, session.userId, {
      step: "code",
      partialSession,
      phoneNumber,
      phoneCodeHash,
      clerkUserId: session.userId,
      organizationId: session.orgId,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({ status: "success", data: { step: "code" } });

    const user = await currentUser();
    await recordGiaPhuActivity({
      organizationId: session.orgId,
      userId: session.userId,
      actorName: user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
      actorEmail: user?.primaryEmailAddress?.emailAddress ?? "",
      action: "telegramSendCode",
      module: "telegram",
      summary: "Yêu cầu mã đăng nhập Telegram",
    }).catch((error) => console.error("Failed to record Gia Phu activity", error));

    return response;
  } catch (error) {
    console.error("Telegram send-code failed", error);
    return NextResponse.json({ status: "error", message: telegramErrorMessage(error) }, { status: 400 });
  }
}
