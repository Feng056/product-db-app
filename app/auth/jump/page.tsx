"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 跨应用免登录跳转回调（只加这一页，不动现有鉴权管线）。
 * 进销存那边点“修改”确认后跳到这里：token 只放在 URL fragment（#…）里，
 * fragment 不会发给服务器、不会进服务器日志；本页读 fragment 设好会话，
 * 再用 location.replace 跳到 next（回退键跳过本页）。
 * next 只允许站内商品页（/products/…），其它一律回 /products；
 * 设会话失败（token 过期等）时退到 /login?next=…，登录一次后仍落在目标商品页。
 */
function JumpInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawNext = searchParams.get("next") || "";
    const next =
      rawNext.startsWith("/products/") && !rawNext.startsWith("//")
        ? rawNext
        : "/products";
    const loginFallback = `/login?next=${encodeURIComponent(next)}`;
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) {
      window.location.replace(loginFallback);
      return;
    }
    const supabase = createClient();
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        // 整页 replace：既让回退键跳过回调页，也保证会话 cookie 一定带上再渲染目标页。
        window.location.replace(error ? loginFallback : next);
      })
      .catch(() => {
        window.location.replace(loginFallback);
      });
  }, [searchParams]);

  return (
    <main className="page-container">
      <p className="p-8 text-center text-sm text-gray-400">正在跳转…</p>
    </main>
  );
}

export default function AuthJumpPage() {
  return (
    <Suspense
      fallback={
        <main className="page-container">
          <p className="p-8 text-center text-sm text-gray-400">正在跳转…</p>
        </main>
      }
    >
      <JumpInner />
    </Suspense>
  );
}
