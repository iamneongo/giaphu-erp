export const ACTIVE_PROJECT_STORAGE_KEY = "giaphu-erp.active-project-code";
export const ACTIVE_PROJECT_ROUTE_ID_STORAGE_KEY = "giaphu-erp.active-project-route-id";
export const ACTIVE_PROJECT_CHANGE_EVENT = "giaphu-erp:active-project-change";
export const PROJECTS_REFRESH_EVENT = "giaphu-erp:projects-refresh";
export const ACTIVE_PROJECT_COOKIE_NAME = "giaphu_erp_active_project";

export type ActiveProjectChangeDetail = {
  code: string;
  routeId: string;
};

function decodeStoredProjectCode(value: string) {
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

export function readActiveProjectCode() {
  if (typeof window === "undefined") return "";
  return decodeStoredProjectCode(window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? "");
}

export function readActiveProjectRouteId() {
  if (typeof window === "undefined") return "";
  return decodeStoredProjectCode(window.localStorage.getItem(ACTIVE_PROJECT_ROUTE_ID_STORAGE_KEY) ?? "");
}

export function writeActiveProjectCode(code: string, routeId = code) {
  if (typeof window === "undefined") return;

  const normalizedCode = decodeStoredProjectCode(code);
  const normalizedRouteId = decodeStoredProjectCode(routeId || code);
  const currentCode = readActiveProjectCode();
  const currentRouteId = readActiveProjectRouteId();

  if (currentCode === normalizedCode && currentRouteId === normalizedRouteId) {
    return;
  }

  window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, normalizedCode);
  window.localStorage.setItem(ACTIVE_PROJECT_ROUTE_ID_STORAGE_KEY, normalizedRouteId);
  document.cookie = `${ACTIVE_PROJECT_COOKIE_NAME}=${encodeURIComponent(normalizedRouteId)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(
    new CustomEvent<ActiveProjectChangeDetail>(ACTIVE_PROJECT_CHANGE_EVENT, {
      detail: { code: normalizedCode, routeId: normalizedRouteId },
    }),
  );
}
