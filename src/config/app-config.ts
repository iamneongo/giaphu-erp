import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Gia Phú ERP",
  version: packageJson.version,
  copyright: `© ${currentYear}, Gia Phú ERP.`,
  meta: {
    title: "Gia Phú ERP",
    description: "Hệ thống quản lý nhiều công trình, vật tư, nhân sự, hồ sơ và báo cáo trên cùng một tài khoản.",
  },
};
