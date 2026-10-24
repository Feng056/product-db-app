"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/actions/auth";
import { inputCls } from "@/components/SpecsEditor";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [noCode, setNoCode] = useState(false);
  const presetCode = (searchParams.code || "").toUpperCase();

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
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">
          {presetCode ? "邀请码已填入，直接注册" : "有邀请码直接通过，无邀请码需人工审核"}
        </p>
      </div>

      <form action={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
          <input name="displayName" required maxLength={20} placeholder="别人看到的名字，如 张三" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">账号</label>
          <input name="account" required minLength={3} maxLength={20} placeholder="abc/123/abc123" className={inputCls} />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">仅用于登录，不会展示给别人</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">密码（至少 6 位）</label>
          <input name="password" type="password" required minLength={6} placeholder="请设置密码" className={inputCls} />
        </div>

        {!noCode ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              邀请码
            </label>
            <input
              name="inviteCode"
              defaultValue={presetCode}
              placeholder="如 INVITE-A3F9K2"
              autoCapitalize="characters"
              className={`${inputCls} uppercase`}
            />
            <button
              type="button"
              onClick={() => setNoCode(true)}
              className="mt-2 text-xs text-blue-600"
            >
              没有邀请码？填写申请说明走人工审核 →
            </button>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              申请说明 <span className="text-red-500">*</span>
            </label>
            <textarea
              name="regNote"
              required
              minLength={5}
              maxLength={500}
              rows={4}
              placeholder="请说明你的身份和用途，如：我是XX公司的采购，需要查看产品资料"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setNoCode(false)}
              className="mt-2 text-xs text-blue-600"
            >
              ← 我有邀请码
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <button
          type="submit"
          className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white"
        >
          {noCode ? "提交审核" : "注册"}
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
