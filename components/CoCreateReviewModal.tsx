"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getCoCreateOverview,
  decideCoCreator,
  removeCoCreator,
  decideSubmission,
  type CoCreateDiff,
} from "@/actions/co-create";
import { formatDateTime } from "@/lib/utils";

type Overview = Awaited<ReturnType<typeof getCoCreateOverview>>;

/**
 * 发布者审核共同创作：申请（同意/驳回）、共同创作者（移除）、
 * 待审核修改（逐项新旧对比，通过后应用到源库并推送给所有订阅者）。
 */
export default function CoCreateReviewModal({
  sourceId,
  sourceName,
  onClose,
  onDone,
}: {
  sourceId: string;
  sourceName: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const imgUrl = (p: string) =>
    supabase.storage.from("product-images").getPublicUrl(p).data.publicUrl;

  async function load() {
    setLoading(true);
    const res = await getCoCreateOverview(sourceId);
    setLoading(false);
    if (res.error) setError(res.error);
    else setData(res);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  async function act(id: string, fn: () => Promise<{ message?: string; error?: string }>) {
    setBusyId(id);
    setError("");
    const res = await fn();
    setBusyId("");
    if (res.error) {
      setError(res.error);
    } else {
      if (res.message) onDone(res.message);
      await load();
      router.refresh();
    }
  }

  const creators = data?.creators || [];
  const approved = creators.filter((c) => c.status === "approved");
  const pendingApps = creators.filter((c) => c.status === "pending");
  const submissions = data?.submissions || [];

  function diffCounts(d: CoCreateDiff) {
    return {
      a: d.added?.length || 0,
      c: d.changed?.length || 0,
      r: d.removed?.length || 0,
    };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            共同创作「{sourceName}」
          </div>
          <button onClick={onClose} className="px-2 text-gray-400">
            ✕
          </button>
        </div>

        {loading && <p className="mt-4 text-center text-xs text-gray-400">加载中…</p>}
        {error && <p className="mt-4 text-center text-xs text-red-500">{error}</p>}

        {!loading && data && (
          <div className="mt-4 space-y-5">
            {/* 共同创作者 */}
            {approved.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500">共同创作者</h3>
                <div className="mt-2 space-y-1.5">
                  {approved.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
                    >
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {c.applicant_name}
                      </span>
                      <button
                        disabled={busyId === `rm-${c.user_id}`}
                        onClick={() => {
                          if (!window.confirm(`移除共同创作者「${c.applicant_name}」？其待审核提交一并驳回。`))
                            return;
                          void act(`rm-${c.user_id}`, () =>
                            removeCoCreator(sourceId, c.user_id)
                          );
                        }}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 disabled:opacity-50 dark:bg-red-950 dark:text-red-400"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 待审核申请 */}
            {pendingApps.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500">待审核申请</h3>
                <div className="mt-2 space-y-1.5">
                  {pendingApps.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-900/20"
                    >
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {c.applicant_name}
                      </span>
                      <span className="flex gap-1.5">
                        <button
                          disabled={busyId === `ok-${c.user_id}`}
                          onClick={() =>
                            void act(`ok-${c.user_id}`, () =>
                              decideCoCreator(sourceId, c.user_id, true)
                            )
                          }
                          className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          同意
                        </button>
                        <button
                          disabled={busyId === `no-${c.user_id}`}
                          onClick={() =>
                            void act(`no-${c.user_id}`, () =>
                              decideCoCreator(sourceId, c.user_id, false)
                            )
                          }
                          className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
                        >
                          驳回
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 待审核修改 */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500">待审核修改</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                对比口径：源库有、副本无的算删除；副本新增的算新增；逐项新旧值都列出。
                如发现源库新品被列为删除，说明源库有未推送的内容，请先推送更新再让对方重新提交。
              </p>
              {submissions.length === 0 && (
                <p className="mt-2 text-xs text-gray-400">暂无待审核修改</p>
              )}
              <div className="mt-2 space-y-2">
                {submissions.map((s) => {
                  const n = diffCounts(s.diff);
                  const expanded = expandedId === s.id;
                  return (
                    <div
                      key={s.id}
                      className="overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800/60"
                    >
                      <button
                        onClick={() => setExpandedId(expanded ? null : s.id)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {s.co_creator_name} 的修改
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {formatDateTime(s.created_at)} · 新增 {n.a} · 修改 {n.c} · 删除 {n.r}
                          </span>
                        </span>
                        <span className="shrink-0 text-gray-400">{expanded ? "▲" : "▼"}</span>
                      </button>
                      {expanded && (
                        <div className="space-y-3 border-t border-gray-100 px-3 py-3 dark:border-gray-700">
                          {/* 新增 */}
                          {n.a > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                新增 {n.a} 个
                              </p>
                              {s.diff.added.map((p) => (
                                <div key={p.copyId} className="mt-1.5 rounded-lg bg-white p-2 dark:bg-gray-900">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {p.name}
                                    <span className="ml-2 text-xs text-gray-400">
                                      {p.model} · {p.category} · ¥{p.price ?? "—"}
                                    </span>
                                  </p>
                                  {p.images.length > 0 && (
                                    <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
                                      {p.images.map((img) => (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          key={img}
                                          src={imgUrl(img)}
                                          alt=""
                                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 修改 */}
                          {n.c > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                修改 {n.c} 个
                              </p>
                              {s.diff.changed.map((p) => (
                                <div key={p.sourceId} className="mt-1.5 rounded-lg bg-white p-2 dark:bg-gray-900">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {p.name}
                                  </p>
                                  <div className="mt-1 space-y-0.5">
                                    {p.fields.map((f, i) => (
                                      <p key={i} className="text-xs">
                                        <span className="text-gray-400">{f.field}：</span>
                                        <span className="text-gray-400 line-through">{f.old}</span>
                                        <span className="mx-1 text-gray-300">→</span>
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                          {f.new}
                                        </span>
                                      </p>
                                    ))}
                                    {p.fields.length === 0 && (
                                      <p className="text-xs text-gray-400">仅图片有变化</p>
                                    )}
                                  </div>
                                  {p.imagesChanged && (
                                    <div className="mt-2 space-y-1.5">
                                      <div>
                                        <p className="text-[11px] text-gray-400">原图</p>
                                        <div className="mt-1 flex gap-1.5 overflow-x-auto">
                                          {p.sourceImages.map((img) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              key={img}
                                              src={imgUrl(img)}
                                              alt=""
                                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                            />
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-[11px] text-gray-400">改后</p>
                                        <div className="mt-1 flex gap-1.5 overflow-x-auto">
                                          {p.images.map((img) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              key={img}
                                              src={imgUrl(img)}
                                              alt=""
                                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 删除 */}
                          {n.r > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                删除 {n.r} 个
                              </p>
                              {s.diff.removed.map((p) => (
                                <p
                                  key={p.sourceId}
                                  className="mt-1 rounded-lg bg-white p-2 text-sm text-gray-500 line-through dark:bg-gray-900 dark:text-gray-400"
                                >
                                  {p.name}
                                  <span className="ml-2 text-xs no-underline">
                                    {p.model} · {p.category} · ¥{p.price ?? "—"}
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              disabled={busyId === `pass-${s.id}`}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `通过「${s.co_creator_name}」的修改？将按此对比应用到源库，并推送给所有订阅者，其他共同创作者未提交的修改将被覆盖。`
                                  )
                                )
                                  return;
                                void act(`pass-${s.id}`, () => decideSubmission(s.id, true));
                              }}
                              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {busyId === `pass-${s.id}` ? "应用中…" : "通过并推送"}
                            </button>
                            <button
                              disabled={busyId === `rej-${s.id}`}
                              onClick={() =>
                                void act(`rej-${s.id}`, () => decideSubmission(s.id, false))
                              }
                              className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300"
                            >
                              驳回
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
