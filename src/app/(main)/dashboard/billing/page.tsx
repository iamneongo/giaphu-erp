import { ClerkBillingPage } from "@/components/clerk/clerk-embedded";

export const metadata = {
  title: "Thanh toán | Gia Phú ERP",
};

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-2xl">Thanh toán</h1>
        <p className="text-muted-foreground text-sm">Quản lý gói và thanh toán theo Clerk Billing.</p>
      </div>
      <ClerkBillingPage />
    </div>
  );
}
