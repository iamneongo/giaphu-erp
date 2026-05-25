"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-2 text-center">
      <h1 className="font-semibold text-2xl">Không tìm thấy trang.</h1>
      <p className="text-muted-foreground">Trang bạn đang mở không tồn tại hoặc đã được di chuyển.</p>
      <Link prefetch={false} replace href="/dashboard/giaphu-erp/overview">
        <Button variant="outline">Quay về tổng quan</Button>
      </Link>
    </div>
  );
}
