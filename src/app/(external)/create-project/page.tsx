import { redirect } from "next/navigation";

import { ProjectOnboarding } from "@/app/(main)/dashboard/giaphu-erp/_components/project-onboarding";
import { GiaPhuErpProvider } from "@/app/(main)/dashboard/giaphu-erp/_hooks/use-giaphu-erp";
import { createGiaPhuSchema, getGiaPhuDashboardData, getGiaPhuProjectList } from "@/lib/giaphu-erp/db";

export const metadata = {
  title: "Tạo công trình | Gia Phú ERP",
};

export default async function Page() {
  await createGiaPhuSchema();
  const projects = await getGiaPhuProjectList();

  if (projects.length > 0) {
    redirect("/dashboard/giaphu-erp/overview");
  }

  const data = await getGiaPhuDashboardData();

  return (
    <GiaPhuErpProvider initialData={data}>
      <ProjectOnboarding />
    </GiaPhuErpProvider>
  );
}
