import type { Metadata } from "next";

import { AuthShell } from "@/app/auth/_components/auth-shell";
import { ClerkSignUpPage } from "@/components/clerk/clerk-embedded";

export const metadata: Metadata = {
  title: "Đăng ký | Gia Phú ERP",
  description: "Tạo tài khoản Gia Phú ERP.",
};

export default function Page() {
  return (
    <AuthShell mode="sign-up">
      <ClerkSignUpPage />
    </AuthShell>
  );
}
