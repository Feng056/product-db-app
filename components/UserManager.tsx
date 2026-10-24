"use client";

import { useMemo, useState } from "react";
import {
  moveUserToGroup,
  toggleUserActive,
  setUserTags,
} from "@/actions/admin";
import type { Group, Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type UserRow = Profile & {
  invite_codes: { source_label: string } | null;
  groups?: { name: string } | null;
};

/** 用户管理：按分组/标签/状态筛选，移动分组，启停，打标签 */
export default function UserManager({
  users,
  groups,
  allTags,
  adminId,
}: {
  users: UserRow[];
  groups: Group[];
  allTags: string[];
  adminId: string;
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all");
  const [tagFilter, setTagFilter] = useState("__all");
  const [activeFilter, setActiveFilter] = useState("__all");
  const [tagEditingId, setTagEditingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search) {
        const s = search.toLowerCase();
        const hit =
          (u.username || "").toLowerCase().includes(s) ||
          (u.display_name || "").toLowerCase().includes(s);
        if (!hit) return false;
      }
      if (groupFilter === "__none") {
        if (u.group_id) return false;
      } else if (groupFilter !== "__all") {
        if (u.group_id !== groupFilter) return false;
      }
      if (tagFilter !== "__all" && !(u.tags || []).includes(tagFilter)) return false;
      if (activeFilter === "active" && !u.is_active) return false;
      if (activeFilter === "inactive" && u.is_active) return false;
      return true;
    });
  }, [users, search, groupFilter, tagFilter, activeFilter]);

  async function onMoveGroup(u: UserRow, groupId: string) {
    setBusy(true);
    const res = await moveUserToGroup(u.id, groupId === "__none" ? null : groupId);
    setBusy(false);
    if (res.error) alert(res.error);
  }

  async function onToggleActive(u: UserRow) {
    if (!u.is_active || confirm(`停用账号「${u.username || u.display_name}」？该用户将无法登录。`)) {
      setBusy(true);
      const res = await toggleUserActive(u.id, u.is_active);
      setBusy(false);
      if (res.error) alert(res.error);
    }
  }

  async function onSaveTags(u: UserRow, tags: string[]) {
    setBusy(true);
    const res = await setUserTags(u.id, tags);
    setBusy(false);
    if (res.error) {
      alert(res.error);
    } else {
      setTagEditingId(null);
      setTagInput("");
    }
  }

  const groupName = (u: UserRow) =>
    u.groups?.name || groups.find((g) => g.id === u.group_id)?.name || "未分组";

  return (
    <div className="mt-3 space-y-2">
      {/* 筛选栏 */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 p-3 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索账号 / 昵称"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <div className="flex gap-2">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="__all">全部分组</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="__none">未分组</option>
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="__all">全部标签</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="__all">全部状态</option>
            <option value="active">已启用</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
        <p className="text-xs text-gray-400">
          共 {users.length} 个账号，筛选出 {filtered.length} 个
        </p>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-400">
          没有符合条件的账号
        </p>
      )}

      {filtered.map((u) => {
        const isSelf = u.id === adminId;
        return (
          <div key={u.id} className="rounded-2xl bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {u.display_name || u.username || u.email}
                </span>
                {u.is_admin && (
                  <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                    管理员
                  </span>
                )}
                {!u.is_active && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
                    已停用
                  </span>
                )}
              </div>
              {!isSelf && (
                <button
                  onClick={() => onToggleActive(u)}
                  disabled={busy}
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${
                    u.is_active ? "text-orange-600" : "text-green-600"
                  }`}
                >
                  {u.is_active ? "停用" : "启用"}
                </button>
              )}
            </div>
            <div className="mt-0.5 text-xs text-gray-400">
              账号：{u.username || u.email} · {groupName(u)}
            </div>

            {/* 标签 */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(u.tags || []).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  #{t}
                </span>
              ))}
              {!isSelf &&
                (tagEditingId === u.id ? (
                  <TagEditor
                    initial={u.tags || []}
                    allTags={allTags}
                    input={tagInput}
                    setInput={setTagInput}
                    onSave={(tags) => onSaveTags(u, tags)}
                    onCancel={() => {
                      setTagEditingId(null);
                      setTagInput("");
                    }}
                    busy={busy}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setTagEditingId(u.id);
                      setTagInput("");
                    }}
                    className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 dark:border-gray-600"
                  >
                    + 标签
                  </button>
                ))}
            </div>

            {/* 移动分组 */}
            {!isSelf && (
              <div className="mt-2 flex items-center gap-2">
                <span className="shrink-0 text-xs text-gray-400">分组</span>
                <select
                  value={u.group_id || "__none"}
                  onChange={(e) => onMoveGroup(u, e.target.value)}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="__none">未分组</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {!g.is_active ? "（已停用）" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-1.5 text-xs text-gray-400">
              注册：{formatDateTime(u.created_at)}
              {u.invite_codes?.source_label
                ? ` · 来源：${u.invite_codes.source_label}`
                : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 标签编辑器：可选已有标签，也可新建 */
function TagEditor({
  initial,
  allTags,
  input,
  setInput,
  onSave,
  onCancel,
  busy,
}: {
  initial: string[];
  allTags: string[];
  input: string;
  setInput: (v: string) => void;
  onSave: (tags: string[]) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const suggestions = allTags.filter(
    (t) => !tags.includes(t) && (!input || t.includes(input))
  );

  const addTag = (t: string) => {
    t = t.trim();
    if (t && !tags.includes(t) && tags.length < 20) {
      setTags([...tags, t]);
    }
    setInput("");
  };

  return (
    <div className="w-full rounded-xl border border-gray-200 p-2 dark:border-gray-700">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTags(tags.filter((x) => x !== t))}
            className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white"
            title="点击移除"
          >
            #{t} ×
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder="输入新标签，回车添加"
          maxLength={12}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
        >
          添加
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-400">已有标签（点击添加）：</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 12).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addTag(t)}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-500 dark:border-gray-700"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => onSave(tags)}
          disabled={busy}
          className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          保存标签
        </button>
      </div>
    </div>
  );
}
