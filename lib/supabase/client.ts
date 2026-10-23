import { createBrowserClient } from "@supabase/ssr";

/**
 * 浏览器端 Supabase 客户端（Client Component 用）。
 * 构建时若没有配环境变量，用占位值避免构建崩溃；运行时必须配置真实凭证。
 */
export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createBrowserClient(url, key);
}

/** 是否配置了真实 Supabase 凭证 */
export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
