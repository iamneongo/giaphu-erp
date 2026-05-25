import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Gia Phú ERP",
  version: packageJson.version,
  copyright: `© ${currentYear}, Gia Phú ERP.`,
  meta: {
    title: "Gia Phú ERP",
    description: "Hệ thống quản trị công trình, vật tư, nhân sự và báo cáo cho Gia Phú.",
  },
};
