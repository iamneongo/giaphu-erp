import type { ReactNode } from "react";

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { fontVars } from "@/lib/fonts/registry";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { ThemeBootScript } from "@/scripts/theme-boot";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
};

const clerkLocalization = {
  signIn: {
    start: {
      title: "Đăng nhập",
      subtitle: "Tiếp tục vào Gia Phú ERP",
      actionText: "Chưa có tài khoản?",
      actionLink: "Tạo tài khoản",
    },
  },
  signUp: {
    start: {
      title: "Tạo tài khoản",
      subtitle: "Tạo tài khoản để thiết lập tổ chức",
      actionText: "Đã có tài khoản?",
      actionLink: "Đăng nhập",
    },
  },
  organizationList: {
    titleWithoutPersonal: "Chọn tổ chức",
    title: "Chọn tổ chức",
    subtitle: "để tiếp tục vào Gia Phú ERP",
    action__createOrganization: "Tạo tổ chức",
    createOrganization: "Tạo tổ chức",
  },
  createOrganization: {
    title: "Tạo tổ chức",
    formButtonSubmit: "Tạo tổ chức",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { theme_mode, theme_preset, content_layout, navbar_style, sidebar_variant, sidebar_collapsible, font } =
    PREFERENCE_DEFAULTS;
  const app = (
    <TooltipProvider>
      <PreferencesStoreProvider
        themeMode={theme_mode}
        themePreset={theme_preset}
        contentLayout={content_layout}
        navbarStyle={navbar_style}
        font={font}
      >
        {children}
        <Toaster />
      </PreferencesStoreProvider>
    </TooltipProvider>
  );

  return (
    <html
      lang="vi"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme and layout preferences on load to avoid flicker and unnecessary server rerenders. */}
        <ThemeBootScript />
      </head>
      <body className={`${fontVars} min-h-screen antialiased`}>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
            localization={clerkLocalization}
          >
            {app}
          </ClerkProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
