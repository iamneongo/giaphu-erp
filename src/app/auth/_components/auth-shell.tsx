import type { ReactNode } from "react";

import Link from "next/link";

import { Building2 } from "lucide-react";

import { InteractiveGrid } from "@/app/auth/_components/interactive-grid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  children: ReactNode;
  mode: "sign-in" | "sign-up";
};

export function AuthShell({ children, mode }: AuthShellProps) {
  const isSignIn = mode === "sign-in";

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <Button asChild variant="ghost" className="absolute top-4 right-4 hidden md:top-8 md:right-8 md:inline-flex">
        <Link href={isSignIn ? "/auth/sign-up" : "/auth/sign-in"}>{isSignIn ? "Tạo tài khoản" : "Đăng nhập"}</Link>
      </Button>
      <section className="relative hidden h-full flex-col overflow-hidden p-10 lg:flex dark:border-r">
        <div className="absolute inset-0 bg-sidebar" />
        <div className="relative z-20 flex items-center font-medium text-lg text-sidebar-foreground">
          <div className="mr-2 flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="size-4" />
          </div>
          Gia Phú ERP
        </div>
        <InteractiveGrid
          className={cn(
            "inset-x-0 inset-y-0 h-full skew-y-12",
            "mask-[radial-gradient(420px_circle_at_center,white,transparent)]",
          )}
        />
        <div className="relative z-20 mt-auto text-sidebar-foreground">
          <blockquote className="space-y-2">
            <p className="text-lg">
              Quản lý nhiều công trình khác nhau, theo dõi vật tư, nhân công, hồ sơ và báo cáo trên cùng một tài khoản.
            </p>
            <footer className="text-sidebar-foreground/70 text-sm">Gia Phú ERP Project Hub</footer>
          </blockquote>
        </div>
      </section>
      <section className="flex h-full w-full items-center justify-center p-4 lg:p-8">
        <div className="flex w-full max-w-md flex-col items-center justify-center space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-lg border bg-background lg:hidden">
              <Building2 className="size-5" />
            </div>
            <h1 className="font-semibold text-2xl tracking-tight">{isSignIn ? "Đăng nhập" : "Tạo tài khoản"}</h1>
            <p className="text-muted-foreground text-sm">
              {isSignIn
                ? "Sau khi đăng nhập, nếu chưa có công trình hệ thống sẽ đưa bạn vào màn tạo công trình đầu tiên."
                : "Tạo tài khoản để bắt đầu quản lý các công trình trên dashboard."}
            </p>
          </div>
          {children}
          <p className="px-8 text-center text-muted-foreground text-sm">
            Tài khoản được bảo vệ bằng Clerk. Dữ liệu ERP sẽ bắt đầu ngay khi bạn tạo công trình đầu tiên.
          </p>
        </div>
      </section>
    </main>
  );
}
