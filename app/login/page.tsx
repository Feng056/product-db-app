"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/actions/auth";
import { inputCls } from "@/components/SpecsEditor";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; disabled?: string; pending?: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 全屏过场：点提交立刻出现，网慢时也不会看着像没点上
  const [overlay, setOverlay] = useState<"logging" | "entering" | null>(null);
  const next = searchParams.next || "";
  const disabled = searchParams.disabled === "1";
  const pending = searchParams.pending === "1";

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    setOverlay("logging");
    const res = await signIn(formData);
    if (res?.error) {
      setBusy(false);
      setOverlay(null);
      setError(res.error);
      return;
    }
    // 登录成功后硬跳转：保证服务端一定拿到最新会话，不再出现“刷新才进入”
    if (res?.redirectTo) {
      setOverlay("entering");
      window.location.href = res.redirectTo;
    }
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
            <Link href="/export-data" className="mt-2 block font-medium text-blue-600">
              📥 导出我的自建库数据
            </Link>
          </div>
        )}
        {pending && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950 px-4 py-3 text-sm text-blue-600 dark:text-blue-400">
            申请已提交，请等待管理员审核通过后再登录
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
          disabled={busy}
          className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? "登录中…" : "登录"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 ">
        还没有账号？
        <Link href="/register" className="font-medium text-blue-600">
          去注册
        </Link>
        <span className="mx-2">·</span>
        <Link href="/forgot-password" className="font-medium text-blue-600">
          忘记密码
        </Link>
      </p>

      {/* 全屏过场遮罩：提交瞬间出现，登录成功后文案切成“正在进入…” */}
      {overlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="text-sm font-medium text-white">
            {overlay === "logging" ? "正在登录…" : "正在进入…"}
          </p>
        </div>
      )}
    </main>
  );
}
