"use client";

import { useState } from "react";
import { createLibrary } from "@/actions/libraries";

/** 新建产品库表单（用于新增页的产品库管理区） */
export default function CreateLibraryForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(formData: FormData) {
    setError(null);
    const res = await createLibrary(formData);
    if (res?.error) setError(res.error);
    else setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        ＋ 新建产品库
      </button>
    );
  }

  return (
    <form action={onCreate} className="rounded-2xl bg-white p-4 dark:bg-gray-900">
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        新产品库名称
      </label>
      <input
        name="name"
        maxLength={30}
        required
        autoFocus
        placeholder="例如：新瑞包装"
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          创建
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >
          取消
        </button>
      </div>
    </form>
  );
}
