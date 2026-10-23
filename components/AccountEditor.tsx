"use client";

import { useRef, useState } from "react";
import { updateAvatar, updateDisplayName } from "@/actions/profile";

/** 账户信息编辑：头像更换 + 昵称修改（最多 10 字符） */
export default function AccountEditor({
  displayName,
  email,
  avatarUrl,
}: {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(displayName || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onAvatarChange(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("avatar", f);
    const res = await updateAvatar(fd);
    setBusy(false);
    if (res.error) setError(res.error);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSaveName() {
    const v = name.trim();
    if (!v) {
      setError("昵称不能为空");
      return;
    }
    if (Array.from(v).length > 10) {
      setError("昵称最多 10 个字符");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("display_name", v);
    const res = await updateDisplayName(fd);
    setBusy(false);
    if (res.error) setError(res.error);
    else setEditingName(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="relative shrink-0"
          title="更换头像"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="头像"
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
              {(displayName || email || "我").slice(0, 1)}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
            ✎
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onAvatarChange(e.target.files)}
        />

        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
                placeholder="输入昵称（最多10字）"
                className="min-w-0 flex-1 rounded-xl border border-blue-300 px-3 py-2 text-sm"
              />
              <button
                onClick={onSaveName}
                disabled={busy}
                className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setName(displayName || "");
                  setError(null);
                }}
                className="shrink-0 text-xs text-gray-400 dark:text-gray-500"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-semibold">
                {displayName || "未设置昵称"}
              </span>
              <button
                onClick={() => setEditingName(true)}
                className="shrink-0 text-xs text-blue-600"
              >
                修改
              </button>
            </div>
          )}
          <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{email}</div>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
