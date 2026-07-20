import { Link } from "react-router";

export function About() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="font-bold text-4xl">关于</h1>
      <p className="text-gray-600 text-lg">基于 Vite + React 19 + TypeScript 5 构建</p>
      <Link className="rounded-md bg-gray-200 px-4 py-2 text-gray-900 hover:bg-gray-300" to="/">
        返回首页
      </Link>
    </div>
  );
}
