import Link from "next/link";

/**
 * 首页。middleware 会把未登录用户导向 /login，
 * 已登录用户导向 /products，这里只是兜底展示。
 */
export default function Home() {
  return (
    <main className="page-container flex min-h-screen flex-col items-center justify-center text-center">
      <div className="text-5xl">📦</div>
      <h1 className="mt-4 text-2xl font-bold">产品资料库</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 ">
        随时随地整理你的产品信息
      </p>
      <div className="mt-8 flex w-full gap-3">
        <Link
          href="/login"
          className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-center font-semibold text-white"
        >
          登录
        </Link>
        <Link
          href="/register"
          className="flex-1 rounded-2xl bg-gray-100 dark:bg-gray-800 py-3.5 text-center font-semibold text-gray-700 dark:text-gray-300"
        >
          注册
        </Link>
      </div>
      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">注册需要邀请码</p>
    </main>
  );
}
