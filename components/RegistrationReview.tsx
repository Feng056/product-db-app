"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveRegistration, rejectRegistration } from "@/actions/admin";

export type PendingReg = {
  id: string;
  username: string;
  display_name: string;
  registration_note: string;
  created_at: string;
};

/** 管理员：注册申请人工审核 */
export default function RegistrationReview({ requests }: { requests: PendingReg[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onDecide(id: string, approve: boolean) {
    if (!confirm(approve ? "通过该注册申请？" : "驳回该注册申请？")) return;
    setBusyId(id);
    setError("");
    const res = approve ? await approveRegistration(id) : await rejectRegistration(id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  if (requests.length === 0) {
    return (
      <p className="mt-8 text-center text-sm text-gray-400">
        暂无待审核的注册申请
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl bg-white p-4 dark:bg-gray-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {r.display_name}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  @{r.username}
                </span>
              </div>
              <div className="mt-1 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                {r.registration_note || "（未填写说明）"}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {new Date(r.created_at).toLocaleString("zh-CN")}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onDecide(r.id, true)}
              disabled={busyId === r.id}
              className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              通过
            </button>
            <button
              onClick={() => onDecide(r.id, false)}
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
