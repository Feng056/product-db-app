"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importSharedLibraries, type SharedLibraryData } from "@/actions/shares";

/** 分享导入：多选库、改名后导入 */
export default function ShareImportClient({
  token,
  shared,
}: {
  token: string;
  shared: SharedLibraryData;
}) {
  const router = useRouter();
  const libs = shared.libraries || [];
  const [selected, setSelected] = useState<Set<number>>(new Set(libs.map((_, i) => i)));
  const [names, setNames] = useState<Record<number, string>>(
    Object.fromEntries(libs.map((l, i) => [i, l.library_name || ""]))
  );
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  async function onImport() {
    if (selected.size === 0 || importing) return;
    setImporting(true);
    setError(null);
    const selections = Array.from(selected).map((i) => ({
      index: i,
      name: (names[i] || libs[i].library_name || "").trim(),
    }));
    const res = await importSharedLibraries(token, selections);
    setImporting(false);
    if (res.error) {
      setError(res.error);
    } else if (res.libraryIds && res.libraryIds.length > 0) {
      router.push(`/products?lib=${res.libraryIds[0]}`);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        选择要导入的仓库（{selected.size}/{libs.length}）
      </div>
      <div className="space-y-3">
        {libs.map((lib, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-4 dark:bg-gray-900"
          >
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => toggle(i)}
                className="h-5 w-5 accent-blue-600"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {lib.library_name}
                </div>
                <div className="text-xs text-gray-400">
                  共 {lib.product_count} 个产品
                </div>
              </div>
            </label>
            {selected.has(i) && (
              <div className="mt-2 flex items-center gap-2 pl-8">
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  存为
                </span>
                <input
                  value={names[i] || ""}
                  onChange={(e) =>
                    setNames({ ...names, [i]: e.target.value })
                  }
                  maxLength={30}
                  placeholder={lib.library_name}
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-red-500">{error}</p>
      )}

      <button
        onClick={onImport}
        disabled={importing || selected.size === 0}
        className="mt-4 w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {importing ? "导入中…" : `导入选中（${selected.size} 个仓库）`}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
        导入会在你的账号下按上面的名字新建仓库
      </p>
    </div>
  );
}
