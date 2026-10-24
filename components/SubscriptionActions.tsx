"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pullSubscriptionUpdate, unsubscribeFromLibrary } from "@/actions/shares";

/** 订阅副本的操作：刷新同步 / 取消订阅 */
export default function SubscriptionActions({ libraryId }: { libraryId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function onRefresh() {
    setBusy(true);
    setMsg("同步中…");
    const res = await pullSubscriptionUpdate(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg(`已同步 ${res.updated} 个产品`);
      router.refresh();
      setTimeout(() => setMsg(""), 2000);
    }
  }

  async function onUnsubscribe() {
    if (!confirm("取消订阅将删除整个库，确定吗？")) return;
    setBusy(true);
    const res = await unsubscribeFromLibrary(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      router.push("/products");
      router.refresh();
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={onRefresh}
        disabled={busy}
        className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {busy ? "同步中…" : "↻ 刷新同步"}
      </button>
      <button
        onClick={onUnsubscribe}
        disabled={busy}
        className="rounded-full border border-gray-200 px-4 py-1.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        取消订阅
      </button>
      {msg && <span className="text-xs text-gray-400">{msg}</span>}
    </div>
  );
}
