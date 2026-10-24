"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { inputCls } from "@/components/SpecsEditor";

/** 忘记密码：提交重置申请，管理员审核后重置 */
export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    const res = await requestPasswordReset(formData);
    if (res?.error) {
      setError(res.error);
    } else {
      setDone(true);
    }
  }

  return (
    <main className="page-container">
      <div className="mt-10 text-center">
        <div className="text-5xl">🔑</div>
        <h1 className="mt-3 text-2xl font-bold">申请重置密码</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          提交后由管理员审核并重置
        </p>
      </div>

      {done ? (
        <div className="mt-8 rounded-2xl bg-green-50 dark:bg-green-950 p-6 text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            申请已提交
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            管理员处理后会通过其他方式告诉你新密码
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-blue-600"
          >
            返回登录
          </Link>
        </div>
      ) : (
        <form action={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              账号
            </label>
            <input
              name="account"
              required
              placeholder="abc/123/abc123"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              重置原因说明
            </label>
            <textarea
              name="note"
              required
              minLength={5}
              maxLength={200}
              rows={3}
              placeholder="请说明为什么需要重置密码，如：忘记密码、账号被他人登录过等"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white"
          >
            提交申请
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <Link href="/login" className="font-medium text-blue-600">
          返回登录
        </Link>
      </p>
    </main>
  );
}
