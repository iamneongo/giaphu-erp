import type { ProjectRow } from "./types";

export const PROJECT_PIN_UNLOCK_COOKIE_NAME = "giaphu_erp_unlocked_projects";
export const PROJECT_PIN_UNLOCK_MAX_AGE = 60 * 60 * 12;

export function parseUnlockedProjectIds(value = "") {
  return new Set(
    value
      .split(".")
      .map((item) => {
        try {
          return decodeURIComponent(item);
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
}

export function encodeUnlockedProjectIds(projectIds: Iterable<string>) {
  return Array.from(new Set(projectIds))
    .filter(Boolean)
    .map((item) => encodeURIComponent(item))
    .join(".");
}

export function isProjectPinUnlocked(project: Pick<ProjectRow, "id" | "hasPin">, cookieValue = "") {
  if (!project.hasPin) return true;
  return parseUnlockedProjectIds(cookieValue).has(project.id);
}
