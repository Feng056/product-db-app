"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePublish, rejectPublish } from "@/actions/libraries";

export type PublishRequest = {
  id: string;
  name: string;
  owner_name: string;
  product_count: number;
  publish_requested_at: string;
};

/** 管理员：发布申请审核 */
export default function PublishReview({ requests }: { requests: PublishRequest[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onDecide(id: string, approve: boolean) {
    if (!confirm(approve ? "通过该发布申请？" : "驳回该发布申请？")) return;
    setBusyId(id);
    setError("");
    const res = approve ? await approvePublish(id) : await rejectPublish(id);
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
        暂无待审核的发布申请
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl bg-white p-3 dark:bg-gray-900"
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {r.name}
              </div>
              <div className="text-xs text-gray-400">
                {r.owner_name} · {r.product_count} 个产品
              </div>
            </div>
            <button
              onClick={() => onDecide(r.id, true)}
              disabled={busyId === r.id}
              className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              通过
            </button>
            <button
              onClick={() => onDecide(r.id, false)}
              disabled={busyId === r.id}
              className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50"
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
