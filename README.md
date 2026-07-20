# json-canvas-editor

一个基于 React、Konva 与 shadcn/ui 的可视化模板编辑器。

## 功能

- 三栏模板编辑工作区
- 文本、图形和图片元素的选择、拖动、缩放与旋转
- 图层结构、排序、显示和锁定控制
- 元素尺寸、位置和样式属性编辑
- 多尺寸内置模板与会话内状态保留
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

# 正式环境打包（读取 .env.production）
pnpm build

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
