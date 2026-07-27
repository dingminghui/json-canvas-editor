# json-canvas-editor

一个基于 React、Konva 与 shadcn/ui 的可视化模板编辑器，同时支持作为 Vite 演示应用运行，或作为 `JsonCanvasEditor` React 组件发布到 npm。

完整产品与技术说明见 [docs/](./docs/README.md)。

## 安装

```bash
pnpm add json-canvas-editor
```

React 与 React DOM 由业务项目提供，当前要求 React 19 或更高版本。

```tsx
import { JsonCanvasEditor, type CanvasDocument } from "json-canvas-editor";
import "json-canvas-editor/style.css";

const documents: CanvasDocument[] = [yourCanvasDocument];

export function Editor() {
  return (
    <div style={{ height: 720, minWidth: 1024 }}>
      <JsonCanvasEditor defaultValue={documents} />
    </div>
  );
}
```

编辑器是桌面端布局，外层容器必须提供明确高度，推荐宽度不小于 `1024px`。组件自带系统字体回退栈；如需与演示站一致的字体，可在业务入口按需引入：

```ts
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/noto-serif-sc";
```

## 组件传参

- `defaultValue`：非受控模式，组件内部维护编辑结果。
- `value + onChange`：受控模式，编辑后把完整文档数组回传给业务方。
- `initialDocumentId`：首次挂载时默认打开的文档。
- `readOnly`：禁用文档变更，保留导航、缩放、JSON 查看与导出。
- `onActiveDocumentChange`：文档切换回调。
- `onExport`：覆盖内置 PNG/PPTX 下载逻辑，可改为上传服务端。
- `className`、`style`：设置编辑器根节点。

可直接编译的多种传参案例见 [src/examples/JsonCanvasEditorExamples.tsx](./src/examples/JsonCanvasEditorExamples.tsx)，包含基础、指定初始文档、多文档、受控、只读、自定义导出和异步加载。

## 构建 npm 包

```bash
pnpm build:lib
npm pack --dry-run
npm pack
```

库产物输出到 `dist/`，包括 ESM、TypeScript 类型声明和组件样式。正式发布前需要确认 `package.json` 中的包名可用，然后登录 npm 执行 `npm publish`。

## 功能

- 三栏模板编辑工作区
- 文本、图形和图片元素的选择、拖动、缩放与旋转
- PPT 文档二级页面导航、单页编辑和幻灯片总览排序
- 图层结构、排序、显示和锁定控制
- 元素尺寸、位置和样式属性编辑
- 长图 PNG 与多页 PPTX 导出
- 多尺寸内置模板、页面记忆与会话内状态保留
- 面向桌面端的三栏编辑布局

## 技术栈

- Vite 7
- React 19
- TypeScript 5
- Tailwind CSS v4
- Konva + React Konva
- shadcn/ui
- Lucide React
- Vitest + Testing Library

## 开发

```bash
# 安装依赖
pnpm install

# 开发环境启动（读取 .env.develop）
pnpm dev

# 演示应用正式环境打包（读取 .env.production）
pnpm build

# npm 组件库打包
pnpm build:lib

# 预览
pnpm preview
```

## 环境变量

- `.env.develop`：开发环境变量
- `.env.production`：正式环境变量

## 测试

```bash
# 运行单元测试
pnpm test

# 运行所有测试（CI 模式）
pnpm test:ci
```

## 代码检查

```bash
# TypeScript + ESLint + Stylelint
pnpm lint

# 代码格式化
pnpm format

# 完整校验
pnpm validate
```
