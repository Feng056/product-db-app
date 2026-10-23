"use client";

import { useState } from "react";
import {
  createLibraryShare,
  revokeLibraryShare,
  listLibraryShares,
} from "@/actions/shares";
import type { LibraryShare } from "@/lib/types";

/** 产品库分享面板：生成/复制/撤销分享链接 */
export default function LibrarySharePanel({
  libraryId,
  libraryName,
}: {
  libraryId: string;
  libraryName: string;
}) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<LibraryShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setShares(await listLibraryShares(libraryId));
    } catch {
      setError("加载失败");
    }
    setLoading(false);
  }

  async function onCreate() {
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("library_id", libraryId);
    const res = await createLibraryShare(fd);
    if (res.error) {
      setError(res.error);
    } else {
      await refresh();
    }
    setLoading(false);
  }

  async function onRevoke(id: string) {
    if (!window.confirm("确定撤销这个分享链接吗？已发出去的链接将失效。")) return;
    const fd = new FormData();
    fd.set("id", id);
    const res = await revokeLibraryShare(fd);
    if (res.error) setError(res.error);
    else await refresh();
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 剪贴板不可用时用传统方式
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-center gap-1 rounded-xl bg-blue-50 py-2 text-xs font-semibold text-blue-700"
      >
        🔗 分享「{libraryName}」
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="text-xs text-gray-500">
            生成链接发给别人，对方打开后可一键导入整个产品库（含图片）
          </p>
          <button
            type="button"
            onClick={onCreate}
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? "处理中…" : "生成新的分享链接"}
          </button>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          {shares.length > 0 && (
            <div className="mt-2 space-y-2">
              {shares.map((s) => {
                const url = `/share/${s.token}`;
                return (
                  <div key={s.id} className="rounded-xl bg-white p-2">
                    <p className="truncate text-xs text-gray-500">
                      {typeof window !== "undefined" ? window.location.origin : ""}{url}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(s.token)}
                        className="flex-1 rounded-lg bg-gray-100 py-1.5 text-xs font-medium text-gray-700"
                      >
                        {copied === s.token ? "已复制 ✓" : "复制链接"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRevoke(s.id)}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-500"
                      >
                        撤销
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
