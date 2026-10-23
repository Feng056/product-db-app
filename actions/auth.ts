"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; message?: string };

/** 注册：必须填写有效邀请码 */
export async function signUp(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  const inviteCode = String(formData.get("inviteCode") || "")
    .trim()
    .toUpperCase();

  if (!email || !password || !inviteCode) {
    return { error: "请填写邮箱、密码和邀请码" };
  }
  if (!displayName) {
    return { error: "请填写昵称" };
  }
  if (password.length < 6) {
    return { error: "密码至少 6 位" };
  }

  const supabase = await createClient();

  // 1. 先校验邀请码（SECURITY DEFINER 函数，匿名可调用）
  const { data: check } = await supabase.rpc("check_invite_code", {
    p_code: inviteCode,
  });
  const valid = (check as { valid?: boolean } | null)?.valid;
  const checkMsg = (check as { message?: string } | null)?.message;
  if (!valid) {
    return { error: checkMsg || "邀请码无效" };
  }

  // 2. 创建 Auth 用户
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) {
    return { error: `注册失败：${signUpError.message}` };
  }

  // 3. 核销邀请码（used_count+1，并记录到 profiles，含昵称）
  const { data: redeem } = await supabase.rpc("redeem_invite_code", {
    p_code: inviteCode,
    p_email: email,
    p_display_name: displayName,
  });
  const ok = (redeem as { ok?: boolean } | null)?.ok;
  if (!ok) {
    const msg = (redeem as { message?: string } | null)?.message;
    return { error: `账号已创建，但邀请码核销失败：${msg || "未知错误"}，请联系管理员` };
  }

  redirect("/products");
}

/** 登录 */
export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");
  if (!email || !password) {
    return { error: "请填写邮箱和密码" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "邮箱或密码错误" };
  }
  // 只允许站内跳转，防止开放重定向
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/products";
  redirect(target);
}

/** 登出 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** 获取当前登录用户 + profile（含是否管理员） */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_admin, invite_code_id, created_at")
    .eq("id", user.id)
    .single();

  return { user, profile };
}
