"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { PublishedLib } from "@/components/DiscoverClient";
import {
  getSubscribeJob,
  subscribeToJob,
  startSubscribeJob,
  clearSubscribeJob,
} from "@/lib/subscribe-job";

/**
 * 订阅广场：他人发布的库仅可订阅（只读同步，不提供独立副本，防止改后冒充发布者）。
 * 点订阅后任务进后台跑，不弹阻塞窗口：按钮里显示进度且不可点，
 * 跑完后按钮变为“刷新订阅”可点，点后跳到新订阅的库。
 */
export default function SubscribePlaza({ libs }: { libs: PublishedLib[] }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const job = useSyncExternalStore(subscribeToJob, getSubscribeJob, () => null);
  const running = job?.status === "running";

  function onSubscribe(lib: PublishedLib) {
    if (running) return;
    startSubscribeJob(lib.id, lib.name);
  }

  function onRefresh() {
    const id = job?.copyId;
    clearSubscribeJob();
    if (id) router.push(`/products?lib=${id}`);
    else router.refresh();
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
          {libs.map((lib) => {
            const isMine = job?.sourceId === lib.id;
            const mineRunning = isMine && running;
            const mineDone = isMine && job?.status === "done";
            const pct =
              mineRunning && job && job.total > 0
                ? Math.round((job.copied / job.total) * 100)
                : 0;
            return (
              <div
                key={lib.id}
                className="rounded-xl bg-white p-3 dark:bg-gray-900"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {lib.name}
                      </div>
                      {lib.is_own && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          我的发布
                        </span>
                      )}
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
                  {lib.is_own ? (
                    <div className="flex-1 rounded-lg bg-green-50 py-2 text-center text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
                      👥 已有 {lib.sub_count} 人订阅
                    </div>
                  ) : lib.is_subscribed ? (
                    <button
                      onClick={() =>
                        lib.copy_id && router.push(`/products?lib=${lib.copy_id}`)
                      }
                      className="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      已订阅
                    </button>
                  ) : mineDone ? (
                    <button
                      onClick={onRefresh}
                      className="flex-1 rounded-lg bg-green-600 py-2 text-xs font-medium text-white"
                    >
                      刷新订阅
                    </button>
                  ) : (
                    <button
                      onClick={() => onSubscribe(lib)}
                      disabled={running}
                      className="flex-1 overflow-hidden rounded-lg bg-purple-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {mineRunning ? (
                        <span className="block px-2">
                          <span className="flex items-center justify-between">
                            <span>
                              同步中 {job?.copied}/{job?.total}
                            </span>
                            <span>{pct}%</span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-purple-400/50">
                            <span
                              className="block h-full rounded-full bg-white transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </span>
                      ) : (
                        "📡 订阅（只读同步）"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {job?.status === "error" && (
            <p className="text-center text-xs text-red-500">
              订阅失败：{job.error || "请重试"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
