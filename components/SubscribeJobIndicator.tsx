"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getSubscribeJob,
  isSubscribeJobHidden,
  subscribeToJob,
  hideSubscribeJob,
  clearSubscribeJob,
} from "@/lib/subscribe-job";

/**
 * 后台订阅任务悬浮条：挂在全局布局里，切页也不消失、不阻塞使用。
 * - 同步中：进度条在条里显示，不可点（只能点 ✕ 隐藏，任务继续跑）
 * - 跑完后：“刷新订阅”变为可点，点后跳到新订阅的库
 */
export default function SubscribeJobIndicator() {
  const router = useRouter();
  const job = useSyncExternalStore(subscribeToJob, getSubscribeJob, () => null);
  const hidden = useSyncExternalStore(subscribeToJob, isSubscribeJobHidden, () => false);

  if (!job || hidden) return null;
  const pct = job.total > 0 ? Math.round((job.copied / job.total) * 100) : 0;

  const shell =
    "fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-xl";

  if (job.status === "running") {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs">
            正在同步「{job.sourceName}」 {job.copied}/{job.total}
          </span>
          <button
            onClick={hideSubscribeJob}
            aria-label="隐藏"
            className="shrink-0 px-1 text-gray-400"
          >
            ✕
          </button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full rounded-full bg-purple-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-[11px] text-gray-400">
          后台同步中，可继续使用，同步完成前刷新订阅不可点
        </p>
      </div>
    );
  }

  if (job.status === "done") {
    return (
      <div className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs">「{job.sourceName}」同步完成</span>
          <button
            onClick={hideSubscribeJob}
            aria-label="隐藏"
            className="shrink-0 px-1 text-gray-400"
          >
            ✕
          </button>
        </div>
        <button
          onClick={() => {
            const id = job.copyId;
            clearSubscribeJob();
            if (id) router.push(`/products?lib=${id}`);
            else router.refresh();
          }}
          className="mt-2 w-full rounded-lg bg-purple-600 py-2 text-xs font-medium text-white"
        >
          刷新订阅
        </button>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-red-300">
          订阅失败：{job.error || "请重试"}
        </span>
        <button
          onClick={clearSubscribeJob}
          aria-label="关闭"
          className="shrink-0 px-1 text-gray-400"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
