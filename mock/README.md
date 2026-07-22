# 模板数据

项目只保留一份编辑器画布数据：

- `symbicort-longform.json`：信必可哮喘长期管理医学科普长图，包含画布尺寸、分组、文本、图片与图形元素。

加载时会在内存中执行两类适配，不回写原始 JSON：

- 将 `Microsoft YaHei` 映射为编辑器已有的 `noto-sans-sc` 字体配置。
- 将 `/assets/medical-comic/*.webp` 路径解析到 `assets/11-*.webp` 至 `assets/17-*.webp`。

文本的 `lineHeight`、图形描边、圆角和几何属性会作为编辑器文档字段保留。
