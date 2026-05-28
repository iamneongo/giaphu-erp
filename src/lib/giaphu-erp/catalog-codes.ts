import type { CatalogItem } from "./types";

export const catalogPrefixes: Record<CatalogItem["kind"], string> = {
  hangMuc: "HM",
  vatTu: "VT",
  vatTuPhu: "VTP",
  thauPhu: "TP",
  nhaCungCap: "NCC",
};

export const catalogKinds = Object.keys(catalogPrefixes) as CatalogItem["kind"][];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCatalogCode(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

export function buildNextCatalogCode(kind: CatalogItem["kind"], existingCodes: string[]) {
  const prefix = catalogPrefixes[kind];
  const codePattern = new RegExp(`^${escapeRegex(prefix)}[-_\\s]?(\\d+)$`, "i");
  const maxNumber = existingCodes.reduce((currentMax, code) => {
    const match = normalizeCatalogCode(code).match(codePattern);
    const nextNumber = match ? Number(match[1]) : 0;

    return Number.isFinite(nextNumber) ? Math.max(currentMax, nextNumber) : currentMax;
  }, 0);

  return `${prefix}${String(maxNumber + 1).padStart(3, "0")}`;
}
