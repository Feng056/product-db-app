"use client";

import { useState } from "react";
import { changePassword } from "@/actions/auth";

/** 设置页 - 修改密码表单 */
export default function PasswordChangeForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const form = e.currentTarget;
    const newPassword = String(new FormData(form).get("newPassword") || "");
    const confirm = String(new FormData(form).get("confirmPassword") || "");
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    setLoading(true);
    const result = await changePassword(new FormData(form));
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(result.message || "密码修改成功");
      form.reset();
      setTimeout(() => {
        setOpen(false);
        setSuccess("");
      }, 1500);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
      >
        修改密码
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
    >
      <div className="space-y-2.5">
        <div className="relative">
          <input
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            placeholder="当前密码"
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showCurrent ? "🙈" : "👁️"}
          </button>
        </div>
        <div className="relative">
          <input
            name="newPassword"
            type={showNew ? "text" : "password"}
            placeholder="新密码（至少 6 位）"
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showNew ? "🙈" : "👁️"}
          </button>
        </div>
        <input
          name="confirmPassword"
          type="password"
          placeholder="确认新密码"
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {success && <p className="mt-2 text-xs text-green-600">{success}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "修改中…" : "确认修改"}
        </button>
      </div>
    </form>
  );
}
