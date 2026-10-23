"use client";

import { signOut } from "@/actions/auth";

export default function SignOutButton({ email }: { email?: string | null }) {
  return (
    <button
      onClick={() => signOut()}
      className="text-xs text-gray-400 underline"
      title={email || ""}
    >
      登出
    </button>
  );
}
