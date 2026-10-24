"use client";

import { useState } from "react";
import { renameLibrary, deleteLibrary, requestPublish, unpublishLibrary, setLibraryTimeDisplay } from "@/actions/libraries";
import { pushSubscriptionUpdate, unsubscribeFromLibrary } from "@/actions/shares";
import PublishDialog from "./PublishDialog";
import type { Library } from "@/lib/types";

/** 仓库管理：改名 / 删除 / 推送订阅更新 */
export default function LibraryManageList({
  libraries,
  counts,
  subCounts = {},
  subCopyIds = new Set<string>(),
}: {
  libraries: Library[];
  counts: Record<string, number>;
  subCounts?: Record<string, number>;
  subCopyIds?: Set<string>;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState("");
  const [publishLib, setPublishLib] = useState<{ id: string; name: string; isUpdate: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  async function onPush(id: string, name: string, count: number) {
    if (!window.confirm(`将「${name}」的最新内容推送给 ${count} 个订阅者？对方的副本将被覆盖。`)) return;
    setPushingId(id);
    setPushMsg("");
    const res = await pushSubscriptionUpdate(id);
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

  function publishBadge(status?: string) {
    if (status === "published")
      return <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">已发布</span>;
    if (status === "pending")
      return <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">审核中</span>;
    if (status === "rejected")
      return <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">已驳回</span>;
    return null;
  }

  const ownLibs = libraries.filter((l) => !subCopyIds.has(l.id));
  const subLibs = libraries.filter((l) => subCopyIds.has(l.id));

  function renderRow(lib: Library) {
    const isSubCopy = subCopyIds.has(lib.id);
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
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {lib.name}
                  {publishBadge(lib.publish_status)}
                </div>
                <div className="text-xs text-gray-400">
                  {counts[lib.id] || 0} 个产品
                  {!isSubCopy && (
                    <span className="ml-1 text-blue-600 dark:text-blue-400">
                      · {subCounts[lib.id] || 0} 人订阅
                    </span>
                  )}
                </div>
              </div>
              {isSubCopy ? (
                /* 订阅副本：不可改名/发布，只能取消订阅（整库删除） */
                <button
                  onClick={() => onUnsubscribe(lib.id, lib.name)}
                  disabled={unsubscribingId === lib.id}
                  className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400 disabled:opacity-50"
                >
                  {unsubscribingId === lib.id ? "取消中…" : "取消订阅"}
                </button>
              ) : (
                /* 自建库：操作收进二级菜单 */
                <button
                  onClick={() => setExpandedId(expandedId === lib.id ? null : lib.id)}
                  className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  {expandedId === lib.id ? "收起 ▲" : "管理 ⋯"}
                </button>
              )}
            </div>

            {/* 二级菜单：自建库的各项操作 */}
            {!isSubCopy && expandedId === lib.id && (
              <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800/60">
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
                {/* 操作按钮 */}
                <div className="flex flex-wrap gap-2">
                  {(subCounts[lib.id] || 0) > 0 && (
                    <button
                      onClick={() => onPush(lib.id, lib.name, subCounts[lib.id])}
                      disabled={pushingId === lib.id}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {pushingId === lib.id ? "推送中…" : "📡 推送更新"}
                    </button>
                  )}
                  {(!lib.publish_status || lib.publish_status === "private" || lib.publish_status === "rejected") && (
                    <button
                      onClick={() => onRequestPublish(lib.id, lib.name, false)}
                      className="rounded-xl bg-green-50 px-5 py-2.5 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      发布
                    </button>
                  )}
                  {lib.publish_status === "published" && (
                    <button
                      onClick={() => onRequestPublish(lib.id, lib.name, true)}
                      className="rounded-xl bg-green-50 px-5 py-2.5 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      申请更新
                    </button>
                  )}
                  {(lib.publish_status === "pending" || lib.publish_status === "published") && (
                    <button
                      onClick={() => onUnpublish(lib.id, lib.name, lib.publish_status === "published")}
                      className="rounded-xl bg-amber-50 px-5 py-2.5 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    >
                      {lib.publish_status === "pending" ? "撤回申请" : "下架"}
                    </button>
                  )}
                  <button
                    onClick={() => setRenamingId(lib.id)}
                    className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    改名
                  </button>
                  <button
                    onClick={() => onDelete(lib.id, lib.name)}
                    className="rounded-xl bg-red-50 px-5 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  >
                    删除
                  </button>
                </div>
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
          <div className="mb-2 mt-4 text-xs font-medium text-gray-400">订阅库（{subLibs.length}）· 只读</div>
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
    </div>
  );
}
