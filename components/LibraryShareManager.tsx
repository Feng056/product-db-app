"use client";

import { useState } from "react";
import { createLibraryShare, revokeLibraryShare } from "@/actions/shares";
import type { Library } from "@/lib/types";

/** 仓库管理：多选产品库并生成分享链接；管理已有分享 */
export default function LibraryShareManager({
  libraries,
  counts,
}: {
  libraries: Library[];
  counts: Record<string, number>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shares, setShares] = useState<
    { id: string; token: string; library_ids: string[]; created_at: string }[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadShares() {
    const { listLibraryShares } = await import("@/actions/shares");
    const list = await listLibraryShares();
    setShares(list as { id: string; token: string; library_ids: string[]; created_at: string }[]);
    setLoaded(true);
  }

  if (!loaded) {
    loadShares();
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  async function onShare() {
    if (selected.size === 0) return;
    setCreating(true);
    setError(null);
    const res = await createLibraryShare(Array.from(selected));
    setCreating(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSelected(new Set());
      loadShares();
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm("确定撤销这个分享链接吗？")) return;
    const fd = new FormData();
    fd.set("id", id);
    await revokeLibraryShare(fd);
    loadShares();
  }

  const shareUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}`;

  const libName = (id: string) => libraries.find((l) => l.id === id)?.name || "未知";

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        选择要分享的产品库（可多选）
      </div>
      <div className="space-y-2">
        {libraries.map((lib) => (
          <label
            key={lib.id}
            className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 dark:bg-gray-900"
          >
            <input
              type="checkbox"
              checked={selected.has(lib.id)}
              onChange={() => toggle(lib.id)}
              className="h-5 w-5 accent-blue-600"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {lib.name}
            </span>
            <span className="text-xs text-gray-400">{counts[lib.id] || 0} 个产品</span>
          </label>
        ))}
      </div>

      <button
        onClick={onShare}
        disabled={creating || selected.size === 0}
        className="mt-3 w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {creating ? "生成中…" : `生成分享链接（${selected.size} 个库）`}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}

      {shares.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            我的分享链接
          </div>
          <div className="space-y-2">
            {shares.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl bg-white p-3 dark:bg-gray-900"
              >
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {s.library_ids.map(libName).join("、")}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    {shareUrl(s.token)}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl(s.token));
                      setCopied(s.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {copied === s.id ? "已复制" : "复制"}
                  </button>
                  <button
                    onClick={() => onRevoke(s.id)}
                    className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  >
                    撤销
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
