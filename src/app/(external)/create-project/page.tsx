import { ProjectOnboarding } from "@/app/(main)/dashboard/giaphu-erp/_components/project-onboarding";
import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";
import { createGiaPhuSchema } from "@/lib/giaphu-erp/db";

export const metadata = {
  title: "Tạo công trình | Gia Phú ERP",
};
export const dynamic = "force-dynamic";

export default async function Page() {
  await enforceErpRoutePermission(ERP_PERMISSIONS.crmManage);
  await createGiaPhuSchema();

  return <ProjectOnboarding />;
}
