# Mock 数据

当前包含两个从 HTML 提取的语义化病例长页：

- `kidney-awakening-story.json`：肾脏觉醒之路
- `lymphoma-transformation-story.json`：淋巴瘤转化之路

每份数据包含：

- 页面来源、主题与版式 token
- Hero、章节、正文、引语、事实卡、表格、列表与页脚声明
- 图片素材清单、替代文本、说明文字、原始地址、尺寸和 SHA-256

图片保存在 `assets/`。原始地址的扩展名是 `.png`，实际响应内容为 JPEG，因此本地文件使用 `.jpg`。

JSON 中图片内容块通过 `assetId` 引用顶层 `assets` 数组；`localPath` 相对于 JSON 文件所在目录。
