"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublishedLib } from "@/components/DiscoverClient";
import SubscribeProgressModal from "@/components/SubscribeProgressModal";
import { runSubscribeStream } from "@/lib/subscribe-stream";

/** 订阅广场：他人发布的库仅可订阅（只读同步，不提供独立副本，防止改后冒充发布者） */
export default function SubscribePlaza({ libs }: { libs: PublishedLib[] }) {
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({
    open: false,
    libName: "",
    copied: 0,
    total: 0,
    error: "",
  });
  const router = useRouter();

  async function onSubscribe(lib: PublishedLib) {
    setBusyId(lib.id);
    setError("");
    setProgress({ open: true, libName: lib.name, copied: 0, total: 0, error: "" });
    await runSubscribeStream({ sourceLibraryId: lib.id }, (e) => {
      if (e.type === "progress") {
        setProgress((p) => ({ ...p, copied: e.copied, total: e.total }));
      } else if (e.type === "done" || e.type === "skipped") {
        router.push(`/products?lib=${e.libraryId}`);
      } else if (e.type === "error") {
        setBusyId(null);
        setProgress((p) => ({ ...p, error: e.message }));
      }
    });
  }

  if (libs.length === 0) {
    return (
      <div className="mb-4 overflow-hidden rounded-2xl bg-purple-50 dark:bg-purple-950">
        <div className="px-4 py-3">
          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            🏪 订阅广场
          </span>
          <p className="mt-1 text-xs text-gray-400">暂无他人发布的公共库</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-purple-50 dark:bg-purple-950">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
          🏪 订阅广场（{libs.length}）
        </span>
        <span className="text-purple-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {libs.map((lib) => (
            <div
              key={lib.id}
              className="rounded-xl bg-white p-3 dark:bg-gray-900"
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {lib.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {lib.owner_name} · {lib.product_count} 个产品 · {lib.sub_count} 人订阅
                    {lib.publish_categories && lib.publish_categories.length > 0 && (
                      <span className="ml-1 text-purple-600 dark:text-purple-400">
                        · 仅{lib.publish_categories.length}个分类
                      </span>
                    )}
                  </div>
                  {lib.publish_categories && lib.publish_categories.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {lib.publish_categories.slice(0, 6).map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        >
                          {c}
                        </span>
                      ))}
                      {lib.publish_categories.length > 6 && (
                        <span className="text-xs text-gray-400">
                          等{lib.publish_categories.length}个分类
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onSubscribe(lib)}
                  disabled={busyId !== null}
                  className="flex-1 rounded-lg bg-purple-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busyId === lib.id ? "订阅中…" : "📡 订阅（只读同步）"}
                </button>
              </div>
            </div>
          ))}
          {error && <p className="text-center text-xs text-red-500">{error}</p>}
        </div>
      )}
      <SubscribeProgressModal
        open={progress.open}
        libraryName={progress.libName}
        copied={progress.copied}
        total={progress.total}
        error={progress.error}
        onClose={() => {
          setProgress((p) => ({ ...p, open: false, error: "" }));
          setBusyId(null);
        }}
      />
    </div>
  );
}
