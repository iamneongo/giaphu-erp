export const ACTIVE_PROJECT_STORAGE_KEY = "giaphu-erp.active-project-code";
export const ACTIVE_PROJECT_CHANGE_EVENT = "giaphu-erp:active-project-change";
export const PROJECTS_REFRESH_EVENT = "giaphu-erp:projects-refresh";
export const ACTIVE_PROJECT_COOKIE_NAME = "giaphu_erp_active_project";

export type ActiveProjectChangeDetail = {
  code: string;
};

export function readActiveProjectCode() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? "";
}

export function writeActiveProjectCode(code: string) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, code);
  document.cookie = `${ACTIVE_PROJECT_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent<ActiveProjectChangeDetail>(ACTIVE_PROJECT_CHANGE_EVENT, { detail: { code } }));
}
