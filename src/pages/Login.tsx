import { Link } from "react-router";

export function Login() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="font-bold text-4xl">登录</h1>
      <p className="text-gray-600 text-lg">请登录后继续访问</p>
      <Link className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" to="/">
        返回首页
      </Link>
    </div>
  );
}
