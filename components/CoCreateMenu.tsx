"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyCoCreate,
  submitCoCreateDiff,
  withdrawCoCreateSubmission,
} from "@/actions/co-create";

export type CoCreateState = {
  status: "none" | "pending" | "approved" | "rejected";
  hasPendingSubmission: boolean;
};

/**
 * 订阅副本的共同创作入口（标题旁的徽标 + 弹窗）：
 * 未申请 → 申请共同创作；审核中 → 仅提示；已批准 → 提交修改 / 撤回提交。
 * 提交后副本锁定，待发布者审核；刷新同步会覆盖未提交的修改，请先提交。
 */
export default function CoCreateMenu({
  libraryId,
  libraryName,
  initial,
}: {
  libraryId: string;
  libraryName: string;
  initial: CoCreateState;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<CoCreateState["status"]>(initial.status);
  const [hasPending, setHasPending] = useState(initial.hasPendingSubmission);
  const router = useRouter();

  function close() {
    setOpen(false);
    setMsg("");
    setBusy(false);
  }

  async function onApply() {
    if (busy) return;
    setBusy(true);
    const res = await applyCoCreate(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg(res.message || "申请已提交");
      setStatus("pending");
    }
  }

  async function onSubmit() {
    if (busy) return;
    setBusy(true);
    setMsg("正在对比修改…");
    const res = await submitCoCreateDiff(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg(
        `已提交：新增 ${res.added} · 修改 ${res.changed} · 删除 ${res.removed}，等待发布者审核`
      );
      setHasPending(true);
      setTimeout(() => {
        close();
        router.refresh();
      }, 2000);
    }
  }

  async function onWithdraw() {
    if (busy) return;
    setBusy(true);
    const res = await withdrawCoCreateSubmission(libraryId);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
    } else {
      setMsg(res.message || "已撤回");
      setHasPending(false);
      setTimeout(() => {
        close();
        router.refresh();
      }, 1500);
    }
  }

  const pillLabel =
    status === "approved"
      ? hasPending
        ? "修改待审核"
        : "共同创作中"
      : status === "pending"
        ? "申请审核中"
        : "共同创作";
  const pillClass =
    status === "approved"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : status === "pending"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${pillClass}`}
      >
        {pillLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              共同创作「{libraryName}」
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {status === "approved"
                ? hasPending
                  ? "修改已提交，等待发布者审核，期间本库不可再改。"
                  : "你已是共同创作者，可直接修改本库产品，改完点下方提交给发布者审核。"
                : status === "pending"
                  ? "申请已提交，等待发布者同意，同意后你就可以修改本库产品了。"
                  : "向发布者申请共同创作，同意后你就可以参与修改本库产品信息，改完提交给发布者审核，通过后同步给所有订阅者。"}
            </p>
            <div className="mt-4 space-y-2">
              {(status === "none" || status === "rejected") && (
                <button
                  onClick={onApply}
                  disabled={busy}
                  className="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "提交中…" : status === "rejected" ? "重新申请共同创作" : "申请共同创作"}
                </button>
              )}
              {status === "approved" && !hasPending && (
                <button
                  onClick={onSubmit}
                  disabled={busy}
                  className="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "对比中…" : "提交修改给发布者"}
                </button>
              )}
              {status === "approved" && hasPending && (
                <button
                  onClick={onWithdraw}
                  disabled={busy}
                  className="w-full rounded-xl bg-amber-50 py-3 text-sm font-medium text-amber-700 disabled:opacity-50 dark:bg-amber-950 dark:text-amber-300"
                >
                  {busy ? "撤回中…" : "撤回提交"}
                </button>
              )}
              <button
                onClick={close}
                disabled={busy}
                className="w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
              >
                关闭
              </button>
            </div>
            {status === "approved" && !hasPending && (
              <p className="mt-3 text-center text-xs text-gray-400">
                注意：刷新同步会覆盖未提交的修改，请先提交
              </p>
            )}
            {msg && <p className="mt-3 text-center text-xs text-gray-400">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
