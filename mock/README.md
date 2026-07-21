# Mock 数据

`kidney-awakening-story.json` 是从 `index_fa881ff4.html` 提取的语义化长页数据，包含：

- 页面来源、主题与版式 token
- Hero、章节、正文、引语、事实卡、表格、列表与页脚声明
- 图片素材清单、替代文本、说明文字、原始地址、尺寸和 SHA-256

图片保存在 `assets/`。原始地址的扩展名是 `.png`，实际响应内容为 JPEG，因此本地文件使用 `.jpg`。

JSON 中图片内容块通过 `assetId` 引用顶层 `assets` 数组；`localPath` 相对于 JSON 文件所在目录。
