export const LEGACY_ERP_ROUTE_PREFIX = "/dashboard/giaphu-erp";
export const PROJECT_ROUTE_PREFIX = "/dashboard/projects";

type ProjectRouteInfo = {
  projectId: string;
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

export function decodeProjectRouteSegment(value: string) {
  let decoded = value.replace(/\+/g, " ");

  for (let index = 0; index < 3; index += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      break;
    }
  }

  return decoded;
}

export function projectScopedPath(projectRouteId: string, childPath = "/overview") {
  const normalizedProjectRouteId = encodeURIComponent(decodeProjectRouteSegment(projectRouteId));
  return `${PROJECT_ROUTE_PREFIX}/${normalizedProjectRouteId}${normalizeChildPath(childPath)}`;
}

export function erpPathForProject(projectRouteId: string, href: string) {
  if (!href.startsWith(LEGACY_ERP_ROUTE_PREFIX)) return href;

  const childPath = href.slice(LEGACY_ERP_ROUTE_PREFIX.length) || "/overview";
  return projectScopedPath(projectRouteId, childPath);
}

export function getProjectRouteInfo(pathname: string): ProjectRouteInfo | null {
  const normalizedPathname = trimTrailingSlash(pathname);
  const prefix = `${PROJECT_ROUTE_PREFIX}/`;

  if (!normalizedPathname.startsWith(prefix)) return null;

  const rest = normalizedPathname.slice(prefix.length);
  const [encodedProjectId = "", ...segments] = rest.split("/");
  const projectId = decodeProjectRouteSegment(encodedProjectId);

  if (!projectId) return null;

  const childPath = segments.length ? `/${segments.join("/")}` : "/overview";

  return {
    projectId,
    projectCode: projectId,
    legacyPathname: `${LEGACY_ERP_ROUTE_PREFIX}${childPath}`,
    projectPathname: `${PROJECT_ROUTE_PREFIX}/${encodeURIComponent(projectId)}${childPath}`,
  };
}

export function legacyErpPathForProject(pathname: string, projectRouteId: string) {
  if (!pathname.startsWith(LEGACY_ERP_ROUTE_PREFIX)) return pathname;

  const childPath = pathname.slice(LEGACY_ERP_ROUTE_PREFIX.length) || "/overview";
  return projectScopedPath(projectRouteId, childPath);
}

export function switchProjectInPath(pathname: string, projectRouteId: string) {
  const projectRoute = getProjectRouteInfo(pathname);
  if (projectRoute) {
    const childPath = projectRoute.legacyPathname.slice(LEGACY_ERP_ROUTE_PREFIX.length) || "/overview";
    return projectScopedPath(projectRouteId, childPath);
  }

  return legacyErpPathForProject(pathname, projectRouteId);
}
