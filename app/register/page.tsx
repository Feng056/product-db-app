"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/actions/auth";
import { inputCls } from "@/components/SpecsEditor";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const res = await signUp(formData);
    if (res?.error) setError(res.error);
    // 成功时 server action 会 redirect，无需前端处理
  }

  return (
    <main className="page-container">
      <div className="mt-10 text-center">
        <div className="text-5xl">📦</div>
        <h1 className="mt-3 text-2xl font-bold">注册产品资料库</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">需要有效的邀请码才能注册</p>
      </div>

      <form action={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
          <input name="displayName" required maxLength={20} placeholder="别人看到的名字，如 张三" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">邮箱</label>
          <input name="email" type="email" required placeholder="you@example.com" className={inputCls} />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">仅用于登录，不会展示给别人</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">密码（至少 6 位）</label>
          <input name="password" type="password" required minLength={6} placeholder="请设置密码" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            邀请码 <span className="text-red-500">*</span>
          </label>
          <input
            name="inviteCode"
            required
            placeholder="如 INVITE-A3F9K2"
            autoCapitalize="characters"
            className={`${inputCls} uppercase`}
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">请向管理员索取邀请码</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <button
          type="submit"
          className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white"
        >
          注册
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 ">
        已有账号？
        <Link href="/login" className="font-medium text-blue-600">
          去登录
        </Link>
      </p>
    </main>
  );
}
