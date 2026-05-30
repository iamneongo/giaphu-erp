export const LEGACY_ERP_ROUTE_PREFIX = "/dashboard/giaphu-erp";
export const PROJECT_ROUTE_PREFIX = "/dashboard/projects";

type ProjectRouteInfo = {
  projectCode: string;
  legacyPathname: string;
  projectPathname: string;
};

function trimTrailingSlash(value: string) {
  if (value.length > 1 && value.endsWith("/")) return value.slice(0, -1);
  return value;
}

function normalizeChildPath(value = "") {
  if (!value || value === "/") return "";
  return value.startsWith("/") ? value : `/${value}`;
}

export function projectScopedPath(projectCode: string, childPath = "/overview") {
  const normalizedProjectCode = encodeURIComponent(projectCode);
  return `${PROJECT_ROUTE_PREFIX}/${normalizedProjectCode}${normalizeChildPath(childPath)}`;
}

export function erpPathForProject(projectCode: string, href: string) {
  if (!href.startsWith(LEGACY_ERP_ROUTE_PREFIX)) return href;

  const childPath = href.slice(LEGACY_ERP_ROUTE_PREFIX.length) || "/overview";
  return projectScopedPath(projectCode, childPath);
}

export function getProjectRouteInfo(pathname: string): ProjectRouteInfo | null {
  const normalizedPathname = trimTrailingSlash(pathname);
  const prefix = `${PROJECT_ROUTE_PREFIX}/`;

  if (!normalizedPathname.startsWith(prefix)) return null;

  const rest = normalizedPathname.slice(prefix.length);
  const [encodedProjectCode = "", ...segments] = rest.split("/");
  const projectCode = decodeURIComponent(encodedProjectCode);

  if (!projectCode) return null;

  const childPath = segments.length ? `/${segments.join("/")}` : "/overview";

  return {
    projectCode,
    legacyPathname: `${LEGACY_ERP_ROUTE_PREFIX}${childPath}`,
    projectPathname: `${PROJECT_ROUTE_PREFIX}/${encodeURIComponent(projectCode)}${childPath}`,
  };
}

export function legacyErpPathForProject(pathname: string, projectCode: string) {
  if (!pathname.startsWith(LEGACY_ERP_ROUTE_PREFIX)) return pathname;

  const childPath = pathname.slice(LEGACY_ERP_ROUTE_PREFIX.length) || "/overview";
  return projectScopedPath(projectCode, childPath);
}

export function switchProjectInPath(pathname: string, projectCode: string) {
  const projectRoute = getProjectRouteInfo(pathname);
  if (projectRoute) {
    const childPath = projectRoute.legacyPathname.slice(LEGACY_ERP_ROUTE_PREFIX.length) || "/overview";
    return projectScopedPath(projectCode, childPath);
  }

  return legacyErpPathForProject(pathname, projectCode);
}
