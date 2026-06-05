import type { CatalogItem } from "@/lib/giaphu-erp/types";

export type CatalogKind = CatalogItem["kind"];

export type CatalogSection = {
  kind: CatalogKind;
  slug: string;
  title: string;
  navigationTitle: string;
  description: string;
  codeLabel: string;
  nameLabel: string;
  showUnit?: boolean;
  showSupplier?: boolean;
  showContact?: boolean;
  noteLabel: string;
};

export const catalogSections: CatalogSection[] = [
  {
    kind: "hangMuc",
    slug: "hang-muc",
    title: "Danh mục hạng mục",
    navigationTitle: "Hạng mục",
    description: "Hạng mục dùng cho vật tư, nhân công, thầu phụ và tiến độ.",
    codeLabel: "Mã hạng mục",
    nameLabel: "Tên hạng mục",
    noteLabel: "Ghi chú",
  },
  {
    kind: "vatTu",
    slug: "vat-tu",
    title: "Danh mục vật tư",
    navigationTitle: "Vật tư",
    description: "Mã vật tư chính, đơn vị tính và ghi chú.",
    codeLabel: "Mã vật tư",
    nameLabel: "Tên vật tư",
    showUnit: true,
    showSupplier: true,
    noteLabel: "Ghi chú",
  },
  {
    kind: "vatTuPhu",
    slug: "vat-tu-phu",
    title: "Danh mục vật tư phụ",
    navigationTitle: "Vật tư phụ",
    description: "Mã vật tư phụ và đơn vị tính.",
    codeLabel: "Mã vật tư phụ",
    nameLabel: "Tên vật tư phụ",
    showUnit: true,
    showSupplier: true,
    noteLabel: "Ghi chú",
  },
  {
    kind: "thauPhu",
    slug: "thau-phu",
    title: "Danh mục thầu phụ",
    navigationTitle: "Thầu phụ",
    description: "Đội thầu phụ, liên hệ và ghi chú.",
    codeLabel: "Mã thầu phụ",
    nameLabel: "Tên thầu phụ",
    showContact: true,
    noteLabel: "Ghi chú",
  },
  {
    kind: "nhaCungCap",
    slug: "nha-cung-cap",
    title: "Danh mục nhà cung cấp",
    navigationTitle: "Nhà cung cấp",
    description: "Nhà cung cấp, liên hệ và ghi chú công nợ.",
    codeLabel: "Mã nhà cung cấp",
    nameLabel: "Tên nhà cung cấp",
    showContact: true,
    noteLabel: "Ghi chú",
  },
];

export function getCatalogSectionBySlug(slug: string) {
  return catalogSections.find((section) => section.slug === slug);
}

export function getCatalogSectionByKind(kind: CatalogKind) {
  return catalogSections.find((section) => section.kind === kind) ?? catalogSections[0];
}
