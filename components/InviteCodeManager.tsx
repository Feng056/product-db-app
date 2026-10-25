"use client";

import { useState } from "react";
import CreateInviteCodeForm from "@/components/CreateInviteCodeForm";
import InviteCodeQR from "@/components/InviteCodeQR";
import { toggleInviteCode, deleteInviteCode, updateInviteCodeLabel } from "@/actions/admin";
import { formatDateTime } from "@/lib/utils";
import type { InviteCode, Group } from "@/lib/types";

function ToggleButton({ code }: { code: InviteCode }) {
  return (
    <button
      onClick={async () => {
        await toggleInviteCode(code.id, code.is_active);
      }}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
        code.is_active
          ? "bg-green-100 text-green-700 dark:text-green-300"
          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
      }`}
    >
      {code.is_active ? "启用中" : "已停用"}
    </button>
  );
}

function DeleteCodeButton({ id }: { id: string }) {
  return (
    <button
      onClick={async () => {
        if (!confirm("确定删除该邀请码吗？")) return;
        await deleteInviteCode(id);
      }}
      className="text-xs text-red-500"
    >
      删除
    </button>
  );
}

/** 邀请码管理 */
export default function InviteCodeManager({
  codes,
  groups,
}: {
  codes: InviteCode[];
  groups: Group[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSaveLabel(id: string) {
    setBusy(true);
    const res = await updateInviteCodeLabel(id, editValue);
    setBusy(false);
    if (res.error) {
      alert(res.error);
    } else {
      setEditingId(null);
    }
  }

  return (
    <>
      <div className="mt-3">
        <CreateInviteCodeForm groups={groups} />
      </div>
      <div className="mt-3 space-y-2">
        {codes.length === 0 && (
          <p className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-400 dark:text-gray-500">
            暂无邀请码
          </p>
        )}
        {codes.map((c) => (
          <div key={c.id} className="rounded-2xl bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between gap-2">
              <code className="truncate text-sm font-bold text-blue-700 dark:text-blue-300">
                {c.code}
              </code>
              <div className="flex shrink-0 items-center gap-2">
                <InviteCodeQR code={c.code} />
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setEditValue(c.source_label);
                  }}
                  className="text-xs text-blue-600"
                >
                  改名
                </button>
                <ToggleButton code={c} />
                <DeleteCodeButton id={c.id} />
              </div>
            </div>
            {editingId === c.id ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  maxLength={20}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800"
                />
                <button
                  onClick={() => onSaveLabel(c.id)}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="shrink-0 text-xs text-gray-500"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 ">
                来源：{(c as { source_label?: string }).source_label} · 已用 {c.used_count}/{c.max_uses} 次
                {c.group_id && groups.find((g) => g.id === c.group_id)
                  ? ` · 分组：${groups.find((g) => g.id === c.group_id)!.name}`
                  : ""}
              </div>
            )}
            <div className="text-xs text-gray-400 dark:text-gray-500">
              创建于 {formatDateTime(c.created_at)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
