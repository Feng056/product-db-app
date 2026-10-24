"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; message?: string };

/** 账号制：内部邮箱域名（Supabase Auth 仍需要邮箱格式） */
const FAKE_EMAIL_DOMAIN = "productdb.local";

/** 账号 → 内部邮箱 */
function accountToEmail(account: string): string {
  return `${account.toLowerCase()}@${FAKE_EMAIL_DOMAIN}`;
}

/** 账号格式：3-20 位字母、数字、下划线、连字符、点 */
function isValidAccount(account: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,20}$/.test(account);
}

/** 注册：必须填写有效邀请码 */
export async function signUp(formData: FormData): Promise<ActionResult> {
  const account = String(formData.get("account") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  const inviteCode = String(formData.get("inviteCode") || "")
    .trim()
    .toUpperCase();
  const regNote = String(formData.get("regNote") || "").trim();

  if (!account || !password) {
    return { error: "请填写账号和密码" };
  }
  if (!isValidAccount(account)) {
    return { error: "账号为 3-20 位字母、数字、下划线、连字符或点" };
  }
  if (!displayName) {
    return { error: "请填写昵称" };
  }
  if (password.length < 6) {
    return { error: "密码至少 6 位" };
  }

  const email = accountToEmail(account);
  const supabase = await createClient();

  // 有邀请码：校验并自动通过
  let useInvite = false;
  if (inviteCode) {
    const { data: check } = await supabase.rpc("check_invite_code", {
      p_code: inviteCode,
    });
    const valid = (check as { valid?: boolean } | null)?.valid;
    const checkMsg = (check as { message?: string } | null)?.message;
    if (!valid) {
      return { error: checkMsg || "邀请码无效" };
    }
    useInvite = true;
  } else {
    // 无邀请码：需要填写申请说明，进入人工审核
    if (!regNote) {
      return { error: "请填写申请说明，或提供邀请码" };
    }
    if (regNote.length < 5) {
      return { error: "申请说明至少 5 个字" };
    }
  }

  // 创建 Auth 用户
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) {
    return { error: `注册失败：${signUpError.message}` };
  }

  if (useInvite) {
    // 核销邀请码（used_count+1，并记录到 profiles，含昵称）
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
  } else {
    // 无邀请码：写入申请说明，状态待审核
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({
          display_name: displayName.slice(0, 20),
          registration_status: "pending",
          registration_note: regNote.slice(0, 500),
        })
        .eq("id", user.id);
    }
    await supabase.auth.signOut();
    redirect("/login?pending=1");
  }
}

/** 登录：支持账号或邮箱 */
export async function signIn(formData: FormData): Promise<ActionResult> {
  const account = String(formData.get("account") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");
  if (!account || !password) {
    return { error: "请填写账号和密码" };
  }

  const supabase = await createClient();

  // 解析登录标识 → 真实邮箱
  let email: string;
  if (account.includes("@")) {
    email = account; // 兼容老用户直接用邮箱登录
  } else {
    // 先查 username 对应的邮箱（兼容老用户），查不到则拼内部域名
    const { data } = await supabase.rpc("get_email_by_username", {
      p_username: account.toLowerCase(),
    });
    email = (data as string) || accountToEmail(account);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "账号或密码错误" };
  }

  // 检查账号 / 分组是否被停用，以及注册审核状态
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, group_id, registration_status, groups(is_active)")
      .eq("id", user.id)
      .single();
    const groupActive = (profile as { groups?: { is_active?: boolean } | null } | null)?.groups?.is_active;
    if (profile && (!profile.is_active || (profile.group_id && groupActive === false))) {
      await supabase.auth.signOut();
      return { error: "该账号已被停用，请联系管理员" };
    }
    const regStatus = (profile as { registration_status?: string } | null)?.registration_status;
    if (regStatus === "pending") {
      await supabase.auth.signOut();
      return { error: "账号正在审核中，请等待管理员通过" };
    }
    if (regStatus === "rejected") {
      await supabase.auth.signOut();
      return { error: "注册申请未通过，请联系管理员" };
    }
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

/** 修改密码：校验当前密码后更新 */
export async function changePassword(
  formData: FormData
): Promise<ActionResult> {
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (!currentPassword || !newPassword) {
    return { error: "请填写当前密码和新密码" };
  }
  if (newPassword.length < 6) {
    return { error: "新密码至少 6 位" };
  }
  if (currentPassword === newPassword) {
    return { error: "新密码不能与当前密码相同" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "请先登录" };
  }

  // 先验证当前密码是否正确
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "当前密码不正确" };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { error: `修改失败：${updateError.message}` };
  }

  return { message: "密码修改成功" };
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
    .select("id, email, username, display_name, avatar_path, header_display, is_admin, invite_code_id, created_at")
    .eq("id", user.id)
    .single();

  return { user, profile };
}
