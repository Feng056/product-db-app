"use client";

import { useState } from "react";
import { renameLibrary, deleteLibrary } from "@/actions/libraries";
import type { Library } from "@/lib/types";

/** 仓库管理：改名 / 删除 */
export default function LibraryManageList({
  libraries,
  counts,
}: {
  libraries: Library[];
  counts: Record<string, number>;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRename(formData: FormData) {
    setError(null);
    const res = await renameLibrary(formData);
    if (res?.error) setError(res.error);
    else setRenamingId(null);
  }

  async function onDelete(id: string, name: string) {
    if (
      !window.confirm(
        `确定删除仓库「${name}」吗？库内所有产品和附件都会被删除，该操作不可恢复！`
      )
    )
      return;
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await deleteLibrary(fd);
    if (res?.error) setError(res.error);
  }

  return (
    <div>
      <div className="space-y-2">
        {libraries.map((lib) => (
          <div
            key={lib.id}
            className="rounded-2xl bg-white p-3 dark:bg-gray-900"
          >
            {renamingId === lib.id ? (
              <form action={onRename} className="flex items-center gap-2">
                <input type="hidden" name="id" value={lib.id} />
                <input
                  name="name"
                  defaultValue={lib.name}
                  maxLength={30}
                  required
                  autoFocus
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                >
                  取消
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {lib.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {counts[lib.id] || 0} 个产品
                  </div>
                </div>
                <button
                  onClick={() => setRenamingId(lib.id)}
                  className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                >
                  改名
                </button>
                <button
                  onClick={() => onDelete(lib.id, lib.name)}
                  className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
