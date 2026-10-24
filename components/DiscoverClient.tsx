"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToPublished } from "@/actions/shares";

export type PublishedLib = {
  id: string;
  name: string;
  owner_name: string;
  product_count: number;
  created_at: string;
  publish_categories?: string[] | null;
  sub_count: number;
  is_own?: boolean;
  is_subscribed?: boolean;
  copy_id?: string | null;
};

/** 已发布库列表 + 一键订阅 */
export default function DiscoverClient({ libs }: { libs: PublishedLib[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubscribe(id: string) {
    setBusyId(id);
    setError("");
    const res = await subscribeToPublished(id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
    } else if (res.libraryId) {
      router.push(`/products?lib=${res.libraryId}`);
    }
  }

  if (libs.length === 0) {
    return (
      <p className="mt-12 text-center text-sm text-gray-400">
        暂无已发布的公共库
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {libs.map((lib) => (
        <div
          key={lib.id}
          className="rounded-2xl bg-white p-4 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {lib.name}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {lib.owner_name} · {lib.product_count} 个产品 · {lib.sub_count} 人订阅
              </div>
            </div>
            <button
              onClick={() => onSubscribe(lib.id)}
              disabled={busyId === lib.id}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busyId === lib.id ? "订阅中…" : "订阅"}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  );
}
