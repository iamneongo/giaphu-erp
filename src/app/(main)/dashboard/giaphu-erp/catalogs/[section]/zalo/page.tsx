import { notFound, redirect } from "next/navigation";

import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { getCatalogSectionBySlug } from "../../../_lib/catalog-config";

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  await enforceErpRoutePermission(ERP_PERMISSIONS.materialsManage);
  const { section: sectionSlug } = await params;
  const section = getCatalogSectionBySlug(sectionSlug);

  if (!section || (section.kind !== "vatTu" && section.kind !== "vatTuPhu")) {
    notFound();
  }

  if (section.kind === "vatTu") {
    redirect("/dashboard/giaphu-erp/materials/vat-tu-chinh");
  }

  redirect("/dashboard/giaphu-erp/materials/vat-tu-phu");
}
