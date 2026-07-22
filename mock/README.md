# Mock 数据

当前包含三份遵循同一结构的语义化医学长页：

- `kidney-awakening-story.json`：肾脏觉醒之路
- `lymphoma-transformation-story.json`：淋巴瘤转化之路
- `symbicort-longform-story.json`：信必可哮喘长期管理医学科普长图

每份数据包含：

- 页面来源、主题与版式 token
- Hero、章节、正文、引语、事实卡、表格、列表与页脚声明
- 图片素材清单、替代文本、说明文字、原始地址、尺寸和 SHA-256

图片保存在 `assets/`。前两份病例的原始地址扩展名为 `.png`，实际响应内容为 JPEG，因此本地文件使用 `.jpg`；信必可模板的 AI 原创插图保留为 `.webp`。

JSON 中图片内容块通过 `assetId` 引用顶层 `assets` 数组；`localPath` 相对于 JSON 文件所在目录。

## 原始画布结构 Mock

`symbicort-longform-original.json` 是输入数据的原样副本，JSON 内容、图片路径、字体、画布尺寸、分组、元素坐标和 ID 均未修改。它会作为独立页面显示在编辑器中；加载时仅在内存中把原图片路径解析到 `assets/11-*.webp` 至 `assets/17-*.webp`，并把系统字体映射到编辑器字体，不回写 Mock 文件。
