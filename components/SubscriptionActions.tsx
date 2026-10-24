"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pullSubscriptionUpdate, unsubscribeFromLibrary } from "@/actions/shares";

/**
 * 订阅副本的标题徽标 + 操作弹窗：
 * 徽标显示“已订阅”，点开弹窗里有“刷新同步”和“取消订阅”，
 * 点取消订阅会再弹一次确认框，确认后才真正取消。
 */
export default function SubscriptionActions({
  libraryId,
  libraryName,
}: {
  libraryId: string;
  libraryName: string;
}) {
  const [view, setView] = useState<"closed" | "menu" | "confirm">("closed");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  function close() {
    setView("closed");
    setMsg("");
    setBusy(false);
  }

  async function onRefresh() {
    if (busy) return;
    setBusy(true);
    setMsg("同步中…");
    const res = await pullSubscriptionUpdate(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg(`已同步 ${res.updated} 个产品`);
      setTimeout(() => {
        close();
        router.refresh();
      }, 1500);
    }
  }

  async function onUnsubscribe() {
    if (busy) return;
    setBusy(true);
    const res = await unsubscribeFromLibrary(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      setView("menu");
    } else {
      router.push("/products");
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={() => setView("menu")}
        className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      >
        已订阅
      </button>

      {view !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {view === "menu" ? (
              <>
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  已订阅「{libraryName}」
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={onRefresh}
                    disabled={busy}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy ? "同步中…" : "↻ 刷新同步"}
                  </button>
                  <button
                    onClick={() => setView("confirm")}
                    disabled={busy}
                    className="w-full rounded-xl bg-red-50 py-3 text-sm font-medium text-red-600 disabled:opacity-50 dark:bg-red-950 dark:text-red-400"
                  >
                    取消订阅
                  </button>
                  <button
                    onClick={close}
                    disabled={busy}
                    className="w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
                  >
                    取消
                  </button>
                </div>
                {msg && (
                  <p className="mt-3 text-center text-xs text-gray-400">{msg}</p>
                )}
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  确定取消订阅吗？
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  取消订阅「{libraryName}」后，该订阅库将从你的账号中删除。
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setView("menu")}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
                  >
                    再想想
                  </button>
                  <button
                    onClick={onUnsubscribe}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy ? "取消中…" : "确定取消"}
                  </button>
                </div>
                {msg && (
                  <p className="mt-3 text-center text-xs text-red-500">{msg}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
