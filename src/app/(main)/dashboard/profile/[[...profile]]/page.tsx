import { ClerkProfilePage } from "@/components/clerk/clerk-embedded";

export const metadata = {
  title: "Hồ sơ | Gia Phú ERP",
};

export default function Page() {
  return (
    <div className="flex justify-center">
      <ClerkProfilePage />
    </div>
  );
}
