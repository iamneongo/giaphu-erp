import { ClerkTeamPage } from "@/components/clerk/clerk-embedded";

export const metadata = {
  title: "Đội nhóm | Gia Phú ERP",
};

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-2xl">Đội nhóm</h1>
        <p className="text-muted-foreground text-sm">Quản lý thành viên, vai trò và thiết lập tổ chức.</p>
      </div>
      <ClerkTeamPage />
    </div>
  );
}
