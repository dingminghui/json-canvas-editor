# json-canvas-editor

一个基于 Vite 的 React 项目

## 技术栈

- Vite 7
- React 19
- TypeScript 5
- Tailwind CSS v4
- Biome V2
- Vitest + Testing Library
- React Query
- React Router

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
