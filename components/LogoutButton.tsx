"use client";

import { signOut } from "@/actions/auth";

/** 退出登录按钮（带二次确认） */
export default function LogoutButton() {
  return (
    <button
      onClick={() => {
        if (window.confirm("确定要退出登录吗？")) signOut();
      }}
      className="w-full rounded-2xl bg-red-50 py-3 text-sm font-semibold text-red-600"
    >
      退出登录
    </button>
  );
}
