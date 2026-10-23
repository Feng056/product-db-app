"use client";

import { signOut } from "@/actions/auth";

export default function SignOutButton({
  displayName,
  email,
}: {
  displayName?: string | null;
  email?: string | null;
}) {
  return (
    <button
      onClick={() => signOut()}
      className="text-xs text-gray-400 underline"
      title={email || ""}
    >
      {displayName || email || "登出"}
    </button>
  );
}
