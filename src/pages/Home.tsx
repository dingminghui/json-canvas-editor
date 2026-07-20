import { Link } from "react-router";

export function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="font-bold text-4xl">首页</h1>
      <p className="text-gray-600 text-lg">欢迎使用 Kit Vite React 项目</p>
      <Link className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" to="/about">
        关于页面
      </Link>
    </div>
  );
}
