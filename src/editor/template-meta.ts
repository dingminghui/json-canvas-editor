export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  cover: string;
  documentType: "longform" | "pptx";
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "symbicort-longform-medical-comic",
    name: "信必可：从 GINA 原则看懂哮喘长期管理",
    description: "面向成人与青少年哮喘患者及家属的健康科普长图；不构成诊断、处方或个体化用药建议。",
    cover: "",
    documentType: "longform",
  },
  {
    id: "ppt-template-2-medical-brief",
    name: "PPT模板2：哮喘长期管理沟通简报",
    description:
      "八页规范演示模板，包含欢迎页、议程、统一页眉页脚、内容页、随访页与结束页；顶层 group 对应导出的单页 slide。",
    cover: "",
    documentType: "pptx",
  },
];
