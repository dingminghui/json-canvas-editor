# 开发指南

## 1. 环境

- Node.js：使用支持 Vite 7 的当前 LTS 版本。
- 包管理器：pnpm。
- 当前项目没有必需的环境变量。

## 2. 常用命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm test:ci
pnpm lint
pnpm validate
pnpm format
```

`pnpm validate` 依次执行 TypeScript、ESLint、Stylelint 和全部测试。

## 3. 开发约束

- 产品界面仅面向桌面端，不新增移动端断点、抽屉或移动端专属交互。
- 修改组件前先阅读对应框架或依赖的官方文档。
- 编辑器 reducer 必须保持纯函数。
- 不把可以从文档和当前页面推导出的值重复存入 state。
- 元素树更新要保留未变化分支的引用，避免无意义重绘。
- 文档操作必须进入历史；纯视图操作不进入历史。
- 新功能需要补充对应单元或集成测试。

## 4. 接入 CanvasDocument

项目不内置内容模板。编辑器通过 `defaultValue` 或 `value` 接收符合 `CanvasDocument` 契约的文档，AI PPT 流程会在生成视觉方案后构建并保存该文档。

1. 提供唯一且稳定的文档 ID、元素 ID。
2. 为所有字体使用 `CanvasFontFamily` 支持的字体 ID。
3. 图片使用可由 Vite 解析的 URL 或 data URL。
4. 在进入编辑器前完成运行时结构校验。
5. 为新增文档来源补充生成、存储和编辑器恢复测试。

### 4.1 长图文档

- `documentType` 使用 `longform`。
- `elements` 是页面根元素。
- `width`、`height` 是完整长图尺寸。

### 4.2 PPT 文档

- `documentType` 使用 `pptx`。
- `width`、`height` 是单张幻灯片尺寸。
- 每张幻灯片必须是一个顶层 `GroupElement`。
- 组内元素必须使用页面本地坐标，不要叠加上一页高度。
- 页面名称建议使用 `01 标题` 格式。
- 标准页码文本的元素名称应包含“页码”，内容使用 `01 / 08` 格式，以便排序后自动更新。

### 4.3 AI PPT 三阶段契约

- `PptProject` 是内容事实源。新增内容类型时需要同步更新 Zod schema、结构生成 Skill、提纲编辑表单、渲染器和测试。
- `PptVisualPlan` 只保存主题与页面视觉决策，包括 `rhythm`、`primaryVisual`、`composition`、`layoutVariant` 和强调块索引。
- `CanvasDocument` 是可编辑渲染产物。图表应创建 `ChartElement`，关系图应创建形状、文本和箭头，不要栅格化成整页图片。
- 旧提示词版本可以读取；渲染前使用 stale 检查提示重新生成，保留用户手动调整过的画布。
- 没有图片输入时优先使用排版、数据和结构关系建立变化，不添加装饰性占位图片。

## 5. 新增元素类型

需要同步修改：

1. `src/editor/types.ts`：类型定义和联合类型。
2. `CanvasStage.tsx`：Konva 渲染与交互。
3. `PropertiesPanel.tsx`：类型专属属性。
4. `LayerTree.tsx`：图层图标。
5. `element-creation.ts`：如需创建工具。
6. `pptx-export.ts`：如需 PPT 映射。
7. 对应测试。

所有 `switch` 使用 `never` 穷尽检查，避免新增类型后遗漏处理分支。

## 6. 修改 PPT 页面逻辑

主要入口：

| 文件                  | 作用                             |
| --------------------- | -------------------------------- |
| `document-pages.ts`   | 完整文档与单页视图转换           |
| `editor-state.ts`     | 当前页状态、页面内写入、页面排序 |
| `LayerSidebar.tsx`    | 文档和页面二级菜单               |
| `SlideOverview.tsx`   | 总览、真实缩略图和拖动排序       |
| `AiPptCanvasPage.tsx` | AI PPT 画布恢复与编辑器接入      |

不要把 PPT 页面重新拼成超长画板。CanvasStage 应始终接收当前单页文档，PPTX 导出应接收完整源文档。

## 7. 修改文本变换

文本框的约束：

- 拖动只更新 `x`、`y`。
- Transformer 只提供左右宽度锚点。
- 宽度变换时重置 Konva scale。
- 不根据缩放比例推导 `fontSize`、`lineHeight` 或 `height`。
- 实时宽度预览需要让 Markdown Canvas 重新生成，以避免位图拉伸。

修改后至少运行：

```bash
pnpm exec vitest run src/editor/components/CanvasStage.test.tsx src/pages/Home.test.tsx
```

## 8. 修改 PPTX 导出

- 只依赖完整 PPT 文档的可见顶层分组。
- 坐标必须由当前组的可见元素边界转换到宽屏 PPT 布局。
- 文本必须使用 `slide.addText`，不要用整体截图替代。
- PptxGenJS 的字体大小单位为 pt；画板像素按页面比例转换。
- `lineSpacingMultiple` 接收倍数，不要再乘 100。
- 图片导出要处理 WebP，并缓存重复资源。

修改后运行：

```bash
pnpm exec vitest run src/editor/pptx-export.test.ts
```

## 9. 质量检查

提交前执行：

```bash
pnpm validate
pnpm build
```

界面改动还应手动验证：

1. 长图选择、平移、缩放和 PNG 导出。
2. PPT 首次进入、第 1/3/8 页切换和页面记忆。
3. 总览缩略图、点击进入、鼠标排序和键盘排序。
4. 文本拖动前后字号一致。
5. 文本左右缩放后字号一致且换行正确。
6. PPTX 文件能打开并显示可编辑文本。

## 10. 当前无对应模块

项目目前没有以下层，因此不维护虚构文档：

- API endpoints
- 身份认证
- 数据库 schema
- 服务端任务
- 云端对象存储
