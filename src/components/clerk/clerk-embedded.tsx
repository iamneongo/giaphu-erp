"use client";

import { OrganizationList, OrganizationProfile, PricingTable, SignIn, SignUp, UserProfile } from "@clerk/nextjs";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const clerkCardAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full border bg-card shadow-sm",
    card: "bg-card shadow-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton: "border-border bg-background text-foreground hover:bg-muted",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    formFieldInput: "border-input bg-background text-foreground",
    footerActionLink: "text-primary hover:text-primary/80",
  },
};

function ClerkMissingConfig({ title }: { title: string }) {
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Trang này dùng Clerk theo template Kiranism.</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTitle>Chưa cấu hình Clerk</AlertTitle>
          <AlertDescription>
            Thêm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` và `CLERK_SECRET_KEY` vào `.env.local` để bật đăng nhập, tổ chức,
            hồ sơ người dùng và quản lý đội nhóm.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function ClerkSignInPage() {
  if (!hasClerkKey) return <ClerkMissingConfig title="Đăng nhập" />;

  return (
    <SignIn
      routing="path"
      path="/auth/sign-in"
      signUpUrl="/auth/sign-up"
      fallbackRedirectUrl="/dashboard/giaphu-erp/overview"
      appearance={clerkCardAppearance}
    />
  );
}

export function ClerkSignUpPage() {
  if (!hasClerkKey) return <ClerkMissingConfig title="Đăng ký" />;

  return (
    <SignUp
      routing="path"
      path="/auth/sign-up"
      signInUrl="/auth/sign-in"
      fallbackRedirectUrl="/dashboard/workspaces"
      appearance={clerkCardAppearance}
    />
  );
}

export function ClerkProfilePage() {
  if (!hasClerkKey) return <ClerkMissingConfig title="Hồ sơ tài khoản" />;

  return <UserProfile routing="path" path="/dashboard/profile" appearance={clerkCardAppearance} />;
}

export function ClerkWorkspacesPage() {
  if (!hasClerkKey) return <ClerkMissingConfig title="Không gian làm việc" />;

  return (
    <OrganizationList
      hidePersonal
      afterCreateOrganizationUrl="/dashboard/giaphu-erp/overview"
      afterSelectOrganizationUrl="/dashboard/giaphu-erp/overview"
      appearance={{
        elements: {
          ...clerkCardAppearance.elements,
          organizationListBox: "space-y-2",
          organizationPreview: "rounded-lg border p-4 hover:bg-accent",
          organizationPreviewMainIdentifier: "text-lg font-semibold",
          organizationPreviewSecondaryIdentifier: "text-sm text-muted-foreground",
        },
      }}
    />
  );
}

export function ClerkTeamPage() {
  if (!hasClerkKey) return <ClerkMissingConfig title="Đội nhóm" />;

  return <OrganizationProfile routing="path" path="/dashboard/workspaces/team" appearance={clerkCardAppearance} />;
}

export function ClerkBillingPage() {
  if (!hasClerkKey) return <ClerkMissingConfig title="Thanh toán" />;

  return <PricingTable for="organization" appearance={clerkCardAppearance} />;
}
