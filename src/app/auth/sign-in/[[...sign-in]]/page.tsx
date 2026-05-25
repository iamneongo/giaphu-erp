import type { Metadata } from "next";

import { AuthShell } from "@/app/auth/_components/auth-shell";
import { ClerkSignInPage } from "@/components/clerk/clerk-embedded";

export const metadata: Metadata = {
  title: "Đăng nhập | Gia Phú ERP",
  description: "Đăng nhập vào Gia Phú ERP.",
};

export default function Page() {
  return (
    <AuthShell mode="sign-in">
      <ClerkSignInPage />
    </AuthShell>
  );
}
