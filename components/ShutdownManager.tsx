"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestShutdown, cancelShutdown } from "@/actions/admin";

/** 管理员：服务停运管理 */
export default function ShutdownManager({ isShutdown }: { isShutdown: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function onRequest() {
    if (!confirm("确定要发起停运吗？所有有自建库的用户下次打开程序时将自动导出数据。")) return;
    setBusy(true);
    setMessage("");
    const res = await requestShutdown();
    setBusy(false);
    setMessage(res.error || res.message || "");
    router.refresh();
  }

  async function onCancel() {
    if (!confirm("确定取消停运吗？")) return;
    setBusy(true);
    setMessage("");
    const res = await cancelShutdown();
    setBusy(false);
    setMessage(res.error || res.message || "");
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-2xl bg-white dark:bg-gray-900 p-4">
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        服务停运
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        发起停运后，所有有自建库的用户下次打开程序时会自动导出数据到下载文件夹，防止数据丢失。
      </p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-gray-500 dark:text-gray-400">当前状态：</span>
        {isShutdown ? (
          <span className="rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
            已发起停运
          </span>
        ) : (
          <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            正常运行
          </span>
        )}
      </div>
      <div className="mt-3">
        {isShutdown ? (
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full rounded-xl bg-gray-200 dark:bg-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            {busy ? "处理中…" : "取消停运"}
          </button>
        ) : (
          <button
            onClick={onRequest}
            disabled={busy}
            className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "处理中…" : "发起停运"}
          </button>
        )}
      </div>
      {message && (
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          {message}
        </p>
      )}
    </div>
  );
}
