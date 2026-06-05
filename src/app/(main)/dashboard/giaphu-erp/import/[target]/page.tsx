import { ERP_PERMISSIONS, enforceErpRoutePermission } from "@/lib/clerk/erp-rbac";

import { ExcelImportPage } from "../../_components/excel-import-page";

function getImportPermission(target: string) {
  if (["contracts", "payments", "projects"].includes(target)) return ERP_PERMISSIONS.crmManage;
  if (target === "catalogs") return ERP_PERMISSIONS.catalogsManage;
  if (target === "materials") return ERP_PERMISSIONS.materialsManage;
  if (["labor-norms", "progress", "staff"].includes(target)) return ERP_PERMISSIONS.workforceManage;
  if (["operations", "subcontractor-contracts", "subcontractors"].includes(target)) {
    return ERP_PERMISSIONS.subcontractorsManage;
  }

  return ERP_PERMISSIONS.overviewRead;
}

export default async function GiaPhuErpImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ target: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ target }, rawSearchParams] = await Promise.all([params, searchParams]);
  await enforceErpRoutePermission(getImportPermission(target));

  const query = Object.fromEntries(
    Object.entries(rawSearchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
    ]),
  );

  return <ExcelImportPage target={target} query={query} />;
}
