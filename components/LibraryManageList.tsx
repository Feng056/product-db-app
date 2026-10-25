"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { renameLibrary, deleteLibrary, requestPublish, unpublishLibrary, setLibraryTimeDisplay, saveLibraryOrder, setShowOnHome } from "@/actions/libraries";
import { pushSubscriptionUpdate, unsubscribeFromLibrary } from "@/actions/shares";
import PublishDialog from "./PublishDialog";
import CoCreateReviewModal from "./CoCreateReviewModal";
import type { Library } from "@/lib/types";

/** 仓库管理：改名 / 删除 / 推送订阅更新 */
export default function LibraryManageList({
  libraries,
  counts,
  subCounts = {},
  subCopyIds = new Set<string>(),
  coCreateCounts = {},
  isAdmin = false,
}: {
  libraries: Library[];
  counts: Record<string, number>;
  subCounts?: Record<string, number>;
  subCopyIds?: Set<string>;
  coCreateCounts?: Record<string, { applications: number; submissions: number }>;
  isAdmin?: boolean;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState("");
  const [publishLib, setPublishLib] = useState<{ id: string; name: string; isUpdate: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [coCreateLib, setCoCreateLib] = useState<{ id: string; name: string; coCreateEnabled: boolean } | null>(null);
  const [removeChoiceId, setRemoveChoiceId] = useState<string | null>(null);

  async function onRename(formData: FormData) {
    setError(null);
    const res = await renameLibrary(formData);
    if (res?.error) setError(res.error);
    else setRenamingId(null);
  }

  async function onDelete(id: string, name: string) {
    if (
      !window.confirm(
        `确定删除仓库「${name}」吗？库内所有产品和附件都会被删除，该操作不可恢复！`
      )
    )
      return;
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await deleteLibrary(fd);
    if (res?.error) setError(res.error);
  }

  async function onPush(lib: Library, count: number) {
    // 非管理员发布者：点推送即提交审核，管理端通过后自动推送，不直接同步
    if (!isAdmin) {
      if (!window.confirm(`将「${lib.name}」的最新内容提交审核？管理端通过后自动推送给 ${count} 个订阅者。`)) return;
      setPushingId(lib.id);
      setPushMsg("");
      const res = await requestPublish(lib.id, lib.publish_categories ?? null, lib.co_create_enabled === true);
      setPushingId(null);
      if (res.error) {
        setError(res.error);
      } else {
        setPushMsg(res.message || "已提交审核");
        setTimeout(() => setPushMsg(""), 3000);
      }
      return;
    }
    if (!window.confirm(`将「${lib.name}」的最新内容推送给 ${count} 个订阅者？对方的副本将被覆盖。`)) return;
    setPushingId(lib.id);
    setPushMsg("");
    const res = await pushSubscriptionUpdate(lib.id);
    setPushingId(null);
    if (res.error) {
      setError(res.error);
    } else {
      setPushMsg(`已推送给 ${res.updated} 个订阅者`);
      setTimeout(() => setPushMsg(""), 3000);
    }
  }

  async function onRequestPublish(id: string, name: string, isUpdate: boolean) {
    // 打开分类选择弹窗
    setPublishLib({ id, name, isUpdate });
  }

  async function onUnpublish(id: string, name: string, isPublished: boolean) {
    if (!window.confirm(isPublished ? `将「${name}」下架？订阅者不受影响。` : `取消「${name}」的发布申请？`)) return;
    setError(null);
    const res = await unpublishLibrary(id);
    if (res.error) setError(res.error);
  }

  async function onUnsubscribe(id: string, name: string) {
    if (!window.confirm(`取消订阅「${name}」？整个库将被删除。`)) return;
    setUnsubscribingId(id);
    setError(null);
    const res = await unsubscribeFromLibrary(id);
    setUnsubscribingId(null);
    if (res.error) setError(res.error);
  }

  async function onTimeDisplay(id: string, mode: string) {
    setError(null);
    const res = await setLibraryTimeDisplay(id, mode);
    if (res?.error) setError(res.error);
  }

  async function onToggleShowOnHome(id: string, show: boolean) {
    setError(null);
    const res = await setShowOnHome(id, show);
    if (res?.error) setError(res.error);
  }

  // 首页顺序：全部库按展示顺序排，点开面板里的 ↑↓/置顶调整，排第一位可见的即首页默认
  const router = useRouter();
  const [order, setOrder] = useState<string[]>(libraries.map((l) => l.id));
  const [orderBusy, setOrderBusy] = useState(false);
  const idsKey = libraries.map((l) => l.id).join(",");
  useEffect(() => {
    setOrder(libraries.map((l) => l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  const byId = new Map(libraries.map((l) => [l.id, l]));
  const ordered: Library[] = [];
  for (const id of order) {
    const lib = byId.get(id);
    if (lib) ordered.push(lib);
  }
  for (const l of libraries) {
    if (!order.includes(l.id)) ordered.push(l);
  }
  const defaultIdx = ordered.findIndex(
    (l) => l.show_on_home !== false || subCopyIds.has(l.id)
  );

  async function applyOrder(next: string[]) {
    setOrder(next);
    setOrderBusy(true);
    setError(null);
    const res = await saveLibraryOrder(next);
    setOrderBusy(false);
    if (!res.ok) {
      setError(res.message || "保存失败");
      setOrder(libraries.map((l) => l.id));
    } else {
      router.refresh();
    }
  }

  function moveOrder(id: string, dir: number) {
    const idx = ordered.findIndex((l) => l.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= ordered.length) return;
    const next = ordered.map((l) => l.id);
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;
    void applyOrder(next);
  }

  function toTopOrder(id: string) {
    void applyOrder([id, ...ordered.filter((l) => l.id !== id).map((l) => l.id)]);
  }

  const ownLibs = libraries.filter((l) => !subCopyIds.has(l.id));
  const subLibs = libraries.filter((l) => subCopyIds.has(l.id));

  function renderRow(lib: Library) {
    const isSubCopy = subCopyIds.has(lib.id);
    const pc = coCreateCounts[lib.id];
    const pendingCo = (pc?.applications || 0) + (pc?.submissions || 0);
    const orderIdx = ordered.findIndex((l) => l.id === lib.id);
    return (
      <div
        key={lib.id}
        className="rounded-2xl bg-white p-3 dark:bg-gray-900"
      >
        {renamingId === lib.id ? (
          <form action={onRename} className="flex items-center gap-2">
            <input type="hidden" name="id" value={lib.id} />
            <input
              name="name"
              defaultValue={lib.name}
              maxLength={30}
              required
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setRenamingId(null)}
              className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              取消
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {lib.name}
                {isSubCopy && <span className="ml-1 opacity-70">📡</span>}
              </div>
              {expandedId === lib.id ? (
                /* 展开时：改名和收起左右并排、按钮改大，避免上下叠放误触 */
                <div className="flex shrink-0 items-center gap-2">
                  {!isSubCopy && (
                    <button
                      onClick={() => setRenamingId(lib.id)}
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    >
                      改名
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(null)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    收起 ▲
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setExpandedId(lib.id)}
                  className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  管理
                </button>
              )}
            </div>

            {/* 管理面板：点开后可勾选首页显示、调整顺序 */}
            {expandedId === lib.id && (
              <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800/60">
                <div className="text-xs text-gray-400">
                  {counts[lib.id] || 0} 个产品
                  {!isSubCopy && (
                    <span className="ml-1 text-blue-600 dark:text-blue-400">
                      · {subCounts[lib.id] || 0} 人订阅
                    </span>
                  )}
                  {!isSubCopy && pendingCo > 0 && (
                    <span className="ml-1 text-red-500">· {pendingCo} 条共同创作待审核</span>
                  )}
                </div>
                {/* 首页显示：只给自建库勾选，订阅库始终显示 */}
                {!isSubCopy && (
                  <button
                    onClick={() => onToggleShowOnHome(lib.id, lib.show_on_home === false)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border text-sm leading-none ${
                        lib.show_on_home !== false
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-gray-800"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">在首页显示</span>
                    {lib.show_on_home === false && (
                      <span className="text-xs text-gray-400">（首页不显示）</span>
                    )}
                  </button>
                )}
                {/* 顺序：当前第几位，上下/置顶调整 */}
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    首页顺序：第 {orderIdx + 1} 位
                  </span>
                  {orderIdx === defaultIdx && defaultIdx !== -1 && (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      默认展示
                    </span>
                  )}
                  <span className="flex-1" />
                  <button disabled={orderBusy || orderIdx <= 0} onClick={() => moveOrder(lib.id, -1)} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300">
                    ↑
                  </button>
                  <button disabled={orderBusy || orderIdx >= ordered.length - 1} onClick={() => moveOrder(lib.id, 1)} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300">
                    ↓
                  </button>
                  <button disabled={orderBusy || orderIdx <= 0} onClick={() => toTopOrder(lib.id)} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300">
                    置顶
                  </button>
                </div>
                {!isSubCopy && (
                <>
                {/* 时间显示设置 */}
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">时间显示</span>
                  <select
                    value={lib.time_display || "both"}
                    onChange={(e) => onTimeDisplay(lib.id, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <option value="both">同时显示创建时间/更新时间</option>
                    <option value="created">仅显示创建时间</option>
                    <option value="updated">仅显示更新时间</option>
                  </select>
                </div>
                {/* 操作按钮：主操作独占一行，次要操作一行均分 */}
                <div className="space-y-2">
                  {(subCounts[lib.id] || 0) > 0 && (
                    <button
                      onClick={() => onPush(lib, subCounts[lib.id])}
                      disabled={pushingId === lib.id}
                      className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {pushingId === lib.id ? "推送中…" : "📡 推送更新"}
                    </button>
                  )}
                  {(!lib.publish_status || lib.publish_status === "private" || lib.publish_status === "rejected") && (
                    <button
                      onClick={() => onRequestPublish(lib.id, lib.name, false)}
                      className="w-full rounded-xl bg-green-50 px-5 py-2.5 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      发布
                    </button>
                  )}
                  {lib.publish_status === "pending" && (
                    <button
                      onClick={() => onUnpublish(lib.id, lib.name, false)}
                      className="w-full rounded-xl bg-amber-50 px-5 py-2.5 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    >
                      撤回申请
                    </button>
                  )}
                  <div className="flex gap-2">
                    {(lib.publish_status === "published" || pendingCo > 0) && (
                      <button
                        onClick={() => setCoCreateLib({ id: lib.id, name: lib.name, coCreateEnabled: lib.co_create_enabled === true })}
                        className="flex-1 rounded-xl bg-purple-50 px-5 py-2.5 text-sm text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        共同创作{pendingCo > 0 ? `（${pendingCo} 待审核）` : ""}
                      </button>
                    )}
                    {lib.publish_status === "published" ? (
                      <button
                        onClick={() => setRemoveChoiceId(removeChoiceId === lib.id ? null : lib.id)}
                        className="flex-1 rounded-xl bg-red-50 px-5 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      >
                        下架 / 删除
                      </button>
                    ) : (
                      <button
                        onClick={() => onDelete(lib.id, lib.name)}
                        className="flex-1 rounded-xl bg-red-50 px-5 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  {/* 下架/删除点开后的选择行 */}
                  {lib.publish_status === "published" && removeChoiceId === lib.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setRemoveChoiceId(null);
                          onUnpublish(lib.id, lib.name, true);
                        }}
                        className="flex-1 rounded-xl bg-amber-50 px-5 py-2.5 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      >
                        仅下架
                      </button>
                      <button
                        onClick={() => {
                          setRemoveChoiceId(null);
                          onDelete(lib.id, lib.name);
                        }}
                        className="flex-1 rounded-xl bg-red-50 px-5 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      >
                        彻底删除
                      </button>
                      <button
                        onClick={() => setRemoveChoiceId(null)}
                        className="flex-1 rounded-xl bg-gray-100 px-5 py-2.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>
                </>)}
                {isSubCopy && (
                  <>
                    <p className="text-xs text-gray-400">订阅库始终在首页显示，不想显示请取消订阅。</p>
                    <button
                      onClick={() => onUnsubscribe(lib.id, lib.name)}
                      disabled={unsubscribingId === lib.id}
                      className="w-full rounded-xl border border-gray-200 px-5 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400 disabled:opacity-50"
                    >
                      {unsubscribingId === lib.id ? "取消中…" : "取消订阅"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* 自建库 */}
      <div className="mb-2 text-xs font-medium text-gray-400">自建库（{ownLibs.length}）</div>
      <div className="space-y-2">
        {ownLibs.map(renderRow)}
      </div>

      {/* 订阅库 */}
      {subLibs.length > 0 && (
        <>
          <div className="mb-2 mt-4 text-xs font-medium text-gray-400">订阅库（{subLibs.length}）</div>
          <div className="space-y-2">
            {subLibs.map(renderRow)}
          </div>
        </>
      )}

      {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
      {pushMsg && <p className="mt-2 text-center text-xs text-green-600">{pushMsg}</p>}

      {publishLib && (
        <PublishDialog
          libraryId={publishLib.id}
          libraryName={publishLib.name}
          isUpdate={publishLib.isUpdate}
          onClose={() => setPublishLib(null)}
          onDone={(msg) => {
            setPushMsg(msg);
            setTimeout(() => setPushMsg(""), 3000);
          }}
        />
      )}

      {coCreateLib && (
        <CoCreateReviewModal
          sourceId={coCreateLib.id}
          sourceName={coCreateLib.name}
          coCreateEnabled={coCreateLib.coCreateEnabled}
          onClose={() => setCoCreateLib(null)}
          onDone={(msg) => {
            setPushMsg(msg);
            setTimeout(() => setPushMsg(""), 3000);
          }}
        />
      )}
    </div>
  );
}
