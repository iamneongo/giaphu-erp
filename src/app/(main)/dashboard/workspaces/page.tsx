import { Building2 } from "lucide-react";

import { ClerkWorkspacesPage } from "@/components/clerk/clerk-embedded";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata = {
  title: "Tổ chức | Gia Phú ERP",
};

export default function Page() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl">Tổ chức làm việc</h1>
        <p className="text-muted-foreground text-sm">
          Gia Phú ERP chạy theo workspace tổ chức. Hãy tạo hoặc chọn tổ chức trước khi vào dashboard.
        </p>
      </div>
      <Alert>
        <Building2 className="size-4" />
        <AlertTitle>Bắt buộc có tổ chức</AlertTitle>
        <AlertDescription>
          Mỗi tài khoản cần một tổ chức đang hoạt động để quản lý dữ liệu công trình, thành viên và phân quyền.
        </AlertDescription>
      </Alert>
      <ClerkWorkspacesPage />
    </div>
  );
}
