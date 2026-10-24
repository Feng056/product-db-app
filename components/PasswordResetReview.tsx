"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetUserPassword, rejectPasswordReset } from "@/actions/admin";

export type ResetRequest = {
  id: string;
  username: string;
  display_name: string;
  note: string | null;
  created_at: string;
};

/** 管理员：密码重置申请处理 */
export default function PasswordResetReview({ requests }: { requests: ResetRequest[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tempPw, setTempPw] = useState<{ username: string; password: string } | null>(null);
  const router = useRouter();

  async function onReset(id: string, username: string) {
    if (!confirm(`为 @${username} 重置密码？将生成临时密码。`)) return;
    setBusyId(id);
    setError("");
    setTempPw(null);
    const res = await resetUserPassword(id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
    } else if (res.tempPassword) {
      setTempPw({ username, password: res.tempPassword });
      router.refresh();
    }
  }

  async function onReject(id: string) {
    if (!confirm("驳回该重置申请？")) return;
    setBusyId(id);
    setError("");
    const res = await rejectPasswordReset(id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  if (requests.length === 0 && !tempPw) {
    return (
      <p className="mt-8 text-center text-sm text-gray-400">
        暂无待处理的密码重置申请
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {tempPw && (
        <div className="rounded-2xl bg-green-50 dark:bg-green-950 p-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            @{tempPw.username} 的新临时密码：
          </p>
          <p className="mt-1 select-all rounded-xl bg-white dark:bg-gray-900 px-4 py-3 text-center text-xl font-mono font-bold tracking-widest">
            {tempPw.password}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            请通过微信等方式告诉对方，提醒其登录后在设置里修改密码
          </p>
          <button
            onClick={() => setTempPw(null)}
            className="mt-2 text-xs text-gray-400"
          >
            关闭
          </button>
        </div>
      )}

      {requests.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl bg-white p-4 dark:bg-gray-900"
        >
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {r.display_name}
            <span className="ml-2 text-xs font-normal text-gray-400">
              @{r.username}
            </span>
          </div>
          {r.note && (
            <div className="mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
              {r.note}
            </div>
          )}
          <div className="mt-1 text-xs text-gray-400">
            {new Date(r.created_at).toLocaleString("zh-CN")}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onReset(r.id, r.username)}
              disabled={busyId === r.id}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busyId === r.id ? "处理中…" : "重置密码"}
            </button>
            <button
              onClick={() => onReject(r.id)}
              disabled={busyId === r.id}
              className="flex-1 rounded-xl bg-red-50 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50"
            >
              驳回
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
