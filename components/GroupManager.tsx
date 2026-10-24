"use client";

import { useState } from "react";
import {
  createGroup,
  renameGroup,
  toggleGroup,
  deleteGroup,
} from "@/actions/admin";
import type { Group } from "@/lib/types";

/** 分组管理：新建 / 重命名 / 启用停用 / 删除 */
export default function GroupManager({
  groups,
  memberCounts,
}: {
  groups: Group[];
  memberCounts: Record<string, number>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(formData: FormData) {
    setMsg("");
    setBusy(true);
    const res = await createGroup(formData);
    setBusy(false);
    setMsg(res.error || res.message || "");
    if (!res.error) {
      const input = document.getElementById("new-group-name") as HTMLInputElement | null;
      if (input) input.value = "";
    }
  }

  async function onRename(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    const res = await renameGroup(id, editName);
    setBusy(false);
    if (res.error) setMsg(res.error);
    else {
      setEditingId(null);
      setMsg("");
    }
  }

  async function onToggle(g: Group) {
    if (!g.is_active && !confirm(`停用分组「${g.name}」后，该组所有用户将无法登录。确定吗？`)) return;
    setBusy(true);
    const res = await toggleGroup(g.id, g.is_active);
    setBusy(false);
    if (res.error) setMsg(res.error);
  }

  async function onDelete(g: Group) {
    const count = memberCounts[g.id] || 0;
    if (!confirm(`删除分组「${g.name}」？${count > 0 ? `组内 ${count} 个用户将移出分组。` : ""}`)) return;
    setBusy(true);
    const res = await deleteGroup(g.id);
    setBusy(false);
    if (res.error) setMsg(res.error);
  }

  return (
    <div className="mt-3 space-y-2">
      <form
        action={onCreate}
        className="flex gap-2 rounded-2xl bg-white dark:bg-gray-900 p-3"
      >
        <input
          id="new-group-name"
          name="name"
          required
          maxLength={20}
          placeholder="新分组名称，如 华东经销商"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          新建
        </button>
      </form>
      {msg && <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{msg}</p>}

      {groups.length === 0 && (
        <p className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-400">
          暂无分组
        </p>
      )}
      {groups.map((g) => (
        <div key={g.id} className="rounded-2xl bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center justify-between gap-2">
            {editingId === g.id ? (
              <div className="flex min-w-0 flex-1 gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                />
                <button
                  onClick={() => onRename(g.id)}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="shrink-0 rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 dark:border-gray-700"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">{g.name}</span>
                  {!g.is_active && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                      已停用
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-gray-400">
                    {memberCounts[g.id] || 0} 人
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditingId(g.id);
                      setEditName(g.name);
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-blue-600"
                  >
                    改名
                  </button>
                  <button
                    onClick={() => onToggle(g)}
                    disabled={busy}
                    className={`rounded-lg px-2 py-1 text-xs ${
                      g.is_active ? "text-orange-600" : "text-green-600"
                    }`}
                  >
                    {g.is_active ? "停用" : "启用"}
                  </button>
                  <button
                    onClick={() => onDelete(g)}
                    disabled={busy}
                    className="rounded-lg px-2 py-1 text-xs text-red-500"
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
