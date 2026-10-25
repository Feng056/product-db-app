"use client";

import { useState } from "react";
import { pullSubscriptionUpdate } from "@/actions/shares";

/**
 * 订阅副本的标题徽标：一点即刷新同步，不再弹菜单。
 * 取消订阅在仓库管理 → 订阅库里（有确认框）。
 */
export default function SubscriptionActions({ libraryId }: { libraryId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [doneMsg, setDoneMsg] = useState("");

  async function onRefresh() {
    if (state === "busy") return;
    setState("busy");
    const res = await pullSubscriptionUpdate(libraryId);
    if (res.error) {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    } else {
      setState("done");
      setDoneMsg(res.updated === 0 ? "已是最新" : `已同步 ${res.updated} 个产品`);
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label =
    state === "busy"
      ? "同步中"
      : state === "done"
        ? doneMsg
        : state === "error"
          ? "同步失败，点此重试"
          : "刷新订阅";

  return (
    <button
      onClick={onRefresh}
      disabled={state === "busy"}
      className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 disabled:opacity-60 dark:bg-blue-950 dark:text-blue-300"
    >
      {label}
    </button>
  );
}
