"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  renameCategory,
  deleteCategory,
  renameTag,
  deleteTag,
} from "@/actions/products";
import { inputCls } from "./SpecsEditor";

export type NameCount = { name: string; count: number };

type Kind = "cat" | "tag";

type MergeConfirm = {
  kind: Kind;
  from: string;
  to: string;
  fromCount: number;
  toCount: number;
};

type DeleteConfirm = { kind: Kind; name: string; count: number };

/**
 * 分类/标签管理（手机端优先）：
 * 分类和标签跟着产品走，这里只做改名、删除、合并，产品本身不会被删。
 * 改名到已存在的名字 = 合并，需二次确认并写明两边产品数；
 * 删除需二次确认并写明影响（分类删除后产品变“未分类”，标签删除只删那一行规格）。
 */
export default function CategoryTagManager({
  libraryId,
  categories,
  tags,
}: {
  libraryId: string;
  categories: NameCount[];
  tags: NameCount[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [renaming, setRenaming] = useState<{
    kind: Kind;
    name: string;
    value: string;
  } | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState<MergeConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  const listFor = (kind: Kind) => (kind === "cat" ? categories : tags);
  const kindLabel = (kind: Kind) => (kind === "cat" ? "分类" : "标签");

  async function runRename(kind: Kind, from: string, to: string) {
    setBusy(true);
    setMsg(null);
    const res =
      kind === "cat"
        ? await renameCategory(libraryId, from, to)
        : await renameTag(libraryId, from, to);
    setBusy(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    setMsg({ ok: true, text: "已保存" });
    setRenaming(null);
    setMergeConfirm(null);
    router.refresh();
  }

  async function runDelete(kind: Kind, name: string) {
    setBusy(true);
    setMsg(null);
    const res =
      kind === "cat"
        ? await deleteCategory(libraryId, name)
        : await deleteTag(libraryId, name);
    setBusy(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    setMsg({ ok: true, text: "已删除" });
    setDeleteConfirm(null);
    router.refresh();
  }

  function startRename(kind: Kind, item: NameCount) {
    setMsg(null);
    setDeleteConfirm(null);
    setMergeConfirm(null);
    setRenaming({ kind, name: item.name, value: item.name });
  }

  function submitRename() {
    if (!renaming) return;
    const to = renaming.value.trim();
    if (!to) {
      setMsg({ ok: false, text: "名字不能为空" });
      return;
    }
    if (to === renaming.name) {
      setRenaming(null);
      return;
    }
    const target = listFor(renaming.kind).find((x) => x.name === to);
    if (target) {
      const fromCount =
        listFor(renaming.kind).find((x) => x.name === renaming.name)?.count || 0;
      setMergeConfirm({
        kind: renaming.kind,
        from: renaming.name,
        to,
        fromCount,
        toCount: target.count,
      });
      return;
    }
    runRename(renaming.kind, renaming.name, to);
  }

  function renderRow(kind: Kind, item: NameCount) {
    const isUncategorized = kind === "cat" && item.name === "未分类";
    const isRenaming = renaming?.kind === kind && renaming?.name === item.name;
    const isMerging = mergeConfirm?.kind === kind && mergeConfirm?.from === item.name;
    const isDeleting = deleteConfirm?.kind === kind && deleteConfirm?.name === item.name;
    return (
      <div key={item.name} className="rounded-2xl bg-white p-3 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="block truncate font-medium">
              {kind === "tag" ? `# ${item.name}` : item.name}
            </span>
            <span className="text-xs text-gray-400">{item.count} 个产品</span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => startRename(kind, item)}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300"
            >
              改名
            </button>
            {isUncategorized ? (
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 dark:bg-gray-800">
                不可删除
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMsg(null);
                  setRenaming(null);
                  setMergeConfirm(null);
                  setDeleteConfirm({ kind, name: item.name, count: item.count });
                }}
                className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60 dark:bg-red-950 dark:text-red-400"
              >
                删除
              </button>
            )}
          </div>
        </div>

        {isRenaming && renaming && (
          <div className="mt-3 flex gap-2">
            <input
              value={renaming.value}
              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
              placeholder="新名字"
              className={inputCls}
            />
            <button
              type="button"
              disabled={busy}
              onClick={submitRename}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setRenaming(null)}
              className="shrink-0 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              取消
            </button>
          </div>
        )}

        {isMerging && mergeConfirm && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p>
              改名后将并入“{mergeConfirm.to}”：{mergeConfirm.to}下原来有{" "}
              {mergeConfirm.toCount} 个产品，加上这 {mergeConfirm.fromCount}{" "}
              个，一共 {mergeConfirm.toCount + mergeConfirm.fromCount} 个产品。
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => runRename(kind, mergeConfirm.from, mergeConfirm.to)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                确认合并
              </button>
              <button
                type="button"
                onClick={() => setMergeConfirm(null)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {isDeleting && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <p>
              {kind === "cat"
                ? `删除分类“${item.name}”后，这 ${item.count} 个产品会变成“未分类”，产品本身不会被删除。`
                : `删除标签“${item.name}”后，这 ${item.count} 个产品的“标签”这一行会被删掉，产品本身还在，其他规格也不动。`}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => runDelete(kind, item.name)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                确认删除
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        分类和标签跟着产品走：这里改名、删除、合并，产品本身不会被删。改完后产品列表的筛选会跟着变。
      </p>
      {msg && (
        <p
          className={`rounded-2xl p-3 text-sm ${
            msg.ok
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div>
        <h2 className="mb-2 font-semibold">分类（{categories.length} 种）</h2>
        <div className="space-y-2">
          {categories.map((c) => renderRow("cat", c))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">标签（{tags.length} 个）</h2>
        {tags.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-gray-400 dark:bg-gray-900">
            这个库还没有标签，在产品的规格参数里加一行 key 为“标签”的行就有了。
          </p>
        ) : (
          <div className="space-y-2">{tags.map((t) => renderRow("tag", t))}</div>
        )}
      </div>
    </div>
  );
}
