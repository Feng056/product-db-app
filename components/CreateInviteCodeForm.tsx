"use client";

import { useState } from "react";
import { createInviteCode } from "@/actions/admin";
import { inputCls } from "./SpecsEditor";

/** 创建邀请码表单（客户端，展示创建结果提示） */
export default function CreateInviteCodeForm() {
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setResult(null);
    setPending(true);
    const res = await createInviteCode(formData);
    setPending(false);
    setResult(res);
    if (!res.error) {
      (document.getElementById("create-code-form") as HTMLFormElement)?.reset();
    }
  }

  return (
    <form id="create-code-form" action={onSubmit} className="mt-4 space-y-3 rounded-2xl bg-white p-4">
      <h2 className="text-sm font-semibold">创建新邀请码</h2>
      <input
        name="code"
        placeholder="自定义码（留空自动生成）"
        autoCapitalize="characters"
        className={`${inputCls} uppercase`}
      />
      <input
        name="sourceLabel"
        required
        placeholder="来源标注 *（如 展会/朋友介绍/微信群）"
        className={inputCls}
      />
      <div className="flex items-center gap-2">
        <input
          name="maxUses"
          type="number"
          min={1}
          defaultValue={1}
          className={`${inputCls} w-28`}
        />
        <span className="text-xs text-gray-500">可使用次数</span>
      </div>

      {result?.error && (
        <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {result.error}
        </div>
      )}
      {result?.message && (
        <div className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700">
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "创建中…" : "创建邀请码"}
      </button>
    </form>
  );
}
