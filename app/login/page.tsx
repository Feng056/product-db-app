"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/actions/auth";
import { inputCls } from "@/components/SpecsEditor";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; disabled?: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const next = searchParams.next || "";
  const disabled = searchParams.disabled === "1";

  async function onSubmit(formData: FormData) {
    setError(null);
    const res = await signIn(formData);
    if (res?.error) setError(res.error);
  }

  return (
    <main className="page-container">
      <div className="mt-10 text-center">
        <div className="text-5xl">📦</div>
        <h1 className="mt-3 text-2xl font-bold">登录产品资料库</h1>
      </div>

      <form action={onSubmit} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        {disabled && (
          <div className="rounded-xl bg-orange-50 dark:bg-orange-950 px-4 py-3 text-sm text-orange-600 dark:text-orange-400">
            该账号已被停用，请联系管理员
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">账号</label>
          <input name="account" required placeholder="abc/123/abc123" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">密码</label>
          <input name="password" type="password" required placeholder="请输入密码" className={inputCls} />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <button
          type="submit"
          className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white"
        >
          登录
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 ">
        还没有账号？
        <Link href="/register" className="font-medium text-blue-600">
          去注册（需要邀请码）
        </Link>
      </p>
    </main>
  );
}
