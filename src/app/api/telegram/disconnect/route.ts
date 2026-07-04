import { NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { recordGiaPhuActivity } from "@/lib/giaphu-erp/db";
import { clearTelegramAccount, getTelegramAccount, logoutTelegramSession } from "@/lib/giaphu-erp/telegram";

export const runtime = "nodejs";

export async function POST() {
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
  if (account?.encryptedSession) {
    await logoutTelegramSession(account.encryptedSession);
  }
  await clearTelegramAccount(session.orgId, session.userId);

  const user = await currentUser();
  await recordGiaPhuActivity({
    organizationId: session.orgId,
    userId: session.userId,
    actorName: user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
    actorEmail: user?.primaryEmailAddress?.emailAddress ?? "",
    action: "telegramDisconnect",
    module: "telegram",
    summary: "Ngắt kết nối tài khoản Telegram",
  }).catch((error) => console.error("Failed to record Gia Phu activity", error));

  return NextResponse.json({ status: "success" });
}
