import type { CatalogItem, ProjectRow, StaffRow } from "@/lib/giaphu-erp/types";

export function optionsFrom(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

export function uniqueOptions(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "vi"))
    .map((value) => ({ label: value, value }));
}

export function projectOptions(projects: ProjectRow[]) {
  return projects.map((project) => ({ label: `${project.code} - ${project.name}`, value: project.code }));
}

export function catalogOptions(items: CatalogItem[]) {
  return items.filter((item) => !item.archived).map((item) => ({ label: item.name, value: item.name }));
}

export function catalogOptionsWithValues(items: CatalogItem[], values: Array<string | null | undefined>) {
  const options = catalogOptions(items);
  const optionValues = new Set(options.map((option) => option.value));
  const archivedValues = new Set(items.filter((item) => item.archived).map((item) => item.name));

  for (const value of values) {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue || optionValues.has(normalizedValue)) continue;

    options.push({
      label: archivedValues.has(normalizedValue) ? `${normalizedValue} (đã lưu trữ)` : normalizedValue,
      value: normalizedValue,
    });
    optionValues.add(normalizedValue);
  }

  return options;
}

export function catalogOptionsWithValue(items: CatalogItem[], value: string | null | undefined) {
  return catalogOptionsWithValues(items, [value]);
}

export function staffOptions(items: StaffRow[]) {
  return items.map((item) => ({ label: `${item.id} - ${item.name}`, value: item.name }));
}

export const materialTypeOptions = optionsFrom(["VT Chính", "VT Phụ", "VT MEP", "VT MEP-HVAC"]);
export const paymentStatusOptions = optionsFrom(["Chưa TT", "Đã TT"]);
export const shiftOptions = optionsFrom(["Sáng", "Chiều", "Tối"]);
