"use client";

import { useState, useEffect } from "react";
import { getLibraryCategories, requestPublish } from "@/actions/libraries";

/** 发布时的分类选择弹窗：全部分类 或 勾选部分分类 */
export default function PublishDialog({
  libraryId,
  libraryName,
  isUpdate,
  onClose,
  onDone,
}: {
  libraryId: string;
  libraryName: string;
  isUpdate: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [categories, setCategories] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 懒加载分类
  useEffect(() => {
    getLibraryCategories(libraryId).then((cats) => {
      setCategories(cats);
      setSelected(new Set(cats));
    });
  }, [libraryId]);

  function toggle(cat: string) {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setSelected(next);
    setAllSelected(next.size === (categories || []).length);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      setAllSelected(false);
    } else {
      setSelected(new Set(categories || []));
      setAllSelected(true);
    }
  }

  async function onConfirm() {
    if (!allSelected && selected.size === 0) {
      setError("请至少勾选一个分类，或选择全部分类");
      return;
    }
    if (
      !window.confirm(
        `确定${isUpdate ? "申请更新" : "申请发布"}「${libraryName}」？\n${
          allSelected
            ? "将发布全部分类"
            : `将仅发布以下分类：${Array.from(selected).join("、")}`
        }`
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    const res = await requestPublish(
      libraryId,
      allSelected ? null : Array.from(selected)
    );
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      onDone(res.message || "已提交");
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-4 dark:bg-gray-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {isUpdate ? "申请更新" : "申请发布"}「{libraryName}」
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          选择要公开的分类，未勾选的分类订阅者将看不到
        </p>

        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          <label className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-950/40">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              全部分类
            </span>
          </label>
          {(categories || []).map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <input
                type="checkbox"
                checked={allSelected || selected.has(cat)}
                disabled={allSelected}
                onChange={() => toggle(cat)}
                className="h-4 w-4 accent-blue-600 disabled:opacity-40"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
            </label>
          ))}
          {categories === null && (
            <p className="py-4 text-center text-xs text-gray-400">加载分类中…</p>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "提交中…" : "确认提交"}
          </button>
        </div>
      </div>
    </div>
  );
}
