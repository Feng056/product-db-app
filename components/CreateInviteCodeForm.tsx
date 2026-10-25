"use client";

import { useState } from "react";
import { createInviteCode } from "@/actions/admin";
import { inputCls } from "./SpecsEditor";

/** 创建邀请码表单（客户端，展示创建结果提示） */
export default function CreateInviteCodeForm({ groups }: { groups: { id: string; name: string; is_active: boolean }[] }) {
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
    <form id="create-code-form" action={onSubmit} className="mt-4 space-y-3 rounded-2xl bg-white dark:bg-gray-900 p-4">
      <h2 className="text-sm font-semibold">创建新邀请码</h2>
      <input
        name="code"
        placeholder="自定义码（留空自动生成）"
        autoCapitalize="characters"
        className={`${inputCls} uppercase`}
      />
      <input
        name="sourceLabel"
        placeholder="来源标注（留空默认使用分组名）"
        className={inputCls}
      />
      <p className="-mt-2 text-xs text-gray-400">留空则默认用所选分组名，不选分组则为「未分组」，创建后可在列表里改名</p>
      <div className="flex items-center gap-2">
        <input
          name="maxUses"
          type="number"
          min={1}
          defaultValue={1}
          className={`${inputCls} w-28`}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 ">可使用次数</span>
      </div>
      <div>
        <select
          name="groupId"
          className={inputCls}
          defaultValue=""
        >
          <option value="">不指定分组（注册后未分组）</option>
          {groups.filter(g => g.is_active !== false).map((g) => (
            <option key={g.id} value={g.id}>
              注册后加入：{g.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">用此码注册的用户会自动加入所选分组</p>
      </div>

      {result?.error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
          {result.error}
        </div>
      )}
      {result?.message && (
        <div className="rounded-xl bg-green-50 dark:bg-green-950 px-4 py-2.5 text-sm text-green-700 dark:text-green-300">
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
