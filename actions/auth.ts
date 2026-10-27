"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; message?: string; redirectTo?: string };

/** 账号制：内部邮箱域名（Supabase Auth 仍需要邮箱格式，且会校验域名真实存在，
    故必须用已解析的真实域名，不能用 .local 这类假域名） */
const FAKE_EMAIL_DOMAIN = "xinruibz.top";

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
      .select("is_active, group_id, registration_status, export_pending, groups(is_active)")
      .eq("id", user.id)
      .single();
    const pf = profile as {
      is_active?: boolean;
      group_id?: string | null;
      registration_status?: string;
      export_pending?: boolean;
      groups?: { is_active?: boolean } | null;
    } | null;
    const groupActive = pf?.groups?.is_active;
    if (pf && (!pf.is_active || (pf.group_id && groupActive === false))) {
      // 停用触发数据保护：如有待导出标记，预生成导出包并跳转自动下载
      if (pf.export_pending) {
        const token = await prepareDeactivatedExport(supabase, user.id);
        await supabase.auth.signOut();
        if (token) {
          redirect(`/export-data?token=${token}`);
        }
      }
      await supabase.auth.signOut();
      redirect("/login?disabled=1");
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
  // 只允许站内跳转，防止开放重定向。
  // 成功时不直接 redirect，改把目标地址返回给客户端，由客户端硬跳转
  // （window.location.href），保证服务端一定拿到最新会话，杜绝“点了没反应、
  // 刷新才进入”的竞态；目标地址的计算逻辑与原来完全一致。
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/products";
  return { redirectTo: target };
}

/** 申请重置密码（未登录可调用） */
export async function requestPasswordReset(
  formData: FormData
): Promise<ActionResult> {
  const account = String(formData.get("account") || "").trim().toLowerCase();
  const note = String(formData.get("note") || "").trim().slice(0, 200);
  if (!account) return { error: "请填写账号" };
  if (!note) return { error: "请填写重置原因说明" };
  if (note.length < 5) return { error: "重置原因说明至少 5 个字" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_password_reset", {
    p_username: account,
    p_note: note,
  });
  if (error) return { error: `提交失败：${error.message}` };
  const ok = (data as { ok?: boolean; message?: string } | null)?.ok;
  if (!ok) {
    return { error: (data as { message?: string } | null)?.message || "提交失败" };
  }
  return {};
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

/** 已停用账号导出自建库：验证密码 → 仅限已停用账号 → 只导自建库（排除订阅库） */
export async function exportDeactivatedData(
  formData: FormData
): Promise<{
  data?: {
    library_name: string;
    name: string;
    model: string;
    category: string;
    price: number | null;
    specs: Record<string, string>;
    notes: string;
  }[];
  error?: string;
}> {
  const account = String(formData.get("account") || "").trim();
  const password = String(formData.get("password") || "");
  if (!account || !password) {
    return { error: "请填写账号和密码" };
  }

  const supabase = await createClient();

  // 解析账号 → 邮箱
  let email: string;
  if (account.includes("@")) {
    email = account;
  } else {
    const { data } = await supabase.rpc("get_email_by_username", {
      p_username: account.toLowerCase(),
    });
    email = (data as string) || accountToEmail(account);
  }

  // 验证密码
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return { error: "账号或密码错误" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "验证失败" };
  }

  // 仅限已停用账号使用此通道（正常账号请走设置里的导出）
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, group_id, registration_status, groups(is_active)")
    .eq("id", user.id)
    .single();
  const p = profile as {
    is_active?: boolean;
    group_id?: string | null;
    registration_status?: string;
    groups?: { is_active?: boolean } | null;
  } | null;
  const deactivated =
    p &&
    (!p.is_active ||
      (p.group_id && p.groups?.is_active === false) ||
      p.registration_status === "rejected");
  if (!deactivated) {
    await supabase.auth.signOut();
    return { error: "该账号未被停用，请登录后在设置中导出" };
  }

  // 只取自建库，排除订阅副本
  const { data: libs } = await supabase
    .from("libraries")
    .select("id, name")
    .eq("user_id", user.id);
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", user.id);
  const subIds = new Set((subs || []).map((s) => s.copy_library_id));
  const ownLibs = ((libs || []) as { id: string; name: string }[]).filter(
    (l) => !subIds.has(l.id)
  );
  const libMap = new Map(ownLibs.map((l) => [l.id, l.name]));

  let items: {
    library_name: string;
    name: string;
    model: string;
    category: string;
    price: number | null;
    specs: Record<string, string>;
    notes: string;
  }[] = [];

  if (libMap.size > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("library_id, name, model, category, price, specs, notes")
      .eq("user_id", user.id)
      .in("library_id", Array.from(libMap.keys()))
      .order("updated_at", { ascending: false });
    items = ((products || []) as {
      library_id: string;
      name: string;
      model: string;
      category: string;
      price: number | null;
      specs: Record<string, string>;
      notes: string;
    }[]).map((p) => ({
      library_name: libMap.get(p.library_id) || "",
      name: p.name,
      model: p.model || "",
      category: p.category || "",
      price: p.price,
      specs: p.specs || {},
      notes: p.notes || "",
    }));
  }

  await supabase.auth.signOut();
  return { data: items };
}

/** 停用触发：预生成自建库导出包，返回单次领取 token */
async function prepareDeactivatedExport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  // 只取自建库，排除订阅副本
  const { data: libs } = await supabase
    .from("libraries")
    .select("id, name")
    .eq("user_id", userId);
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", userId);
  const subIds = new Set((subs || []).map((s) => s.copy_library_id));
  const ownLibs = ((libs || []) as { id: string; name: string }[]).filter(
    (l) => !subIds.has(l.id)
  );
  const libMap = new Map(ownLibs.map((l) => [l.id, l.name]));

  let items: object[] = [];
  if (libMap.size > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("library_id, name, model, category, price, specs, notes")
      .eq("user_id", userId)
      .in("library_id", Array.from(libMap.keys()))
      .order("updated_at", { ascending: false });
    items = ((products || []) as {
      library_id: string;
      name: string;
      model: string;
      category: string;
      price: number | null;
      specs: Record<string, string>;
      notes: string;
    }[]).map((p) => ({
      library_name: libMap.get(p.library_id) || "",
      name: p.name,
      model: p.model || "",
      category: p.category || "",
      price: p.price,
      specs: p.specs || {},
      notes: p.notes || "",
    }));
  }

  // 生成 token 并存储
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  let token = "";
  for (let i = 0; i < tokenBytes.length; i++) {
    token += tokenBytes[i].toString(16).padStart(2, "0");
  }

  const { error } = await supabase.from("pending_exports").insert({
    user_id: userId,
    token,
    data: items,
  });
  if (error) return null;

  // 清除待导出标记
  await supabase
    .from("profiles")
    .update({ export_pending: false })
    .eq("id", userId);

  return token;
}

/** 用 token 领取预生成的导出包（单次有效） */
export async function claimPendingExport(
  token: string
): Promise<{ data?: object[]; error?: string }> {
  if (!token) return { error: "无效的领取凭证" };
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("pending_exports")
    .select("id, data, expires_at")
    .eq("token", token)
    .single();

  if (!row) return { error: "导出包不存在或已领取" };
  if (new Date((row as { expires_at: string }).expires_at) < new Date()) {
    await supabase.from("pending_exports").delete().eq("id", (row as { id: string }).id);
    return { error: "导出包已过期，请重新登录" };
  }

  // 单次领取后删除
  await supabase.from("pending_exports").delete().eq("id", (row as { id: string }).id);
  return { data: (row as { data: object[] }).data || [] };
}

/** 检查当前登录用户是否有待自动导出（停运或停用触发），有则预生成并返回 token */
export async function checkAndPrepareAutoExport(): Promise<{ token?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from("profiles")
    .select("export_pending")
    .eq("id", user.id)
    .single();
  if (!(profile as { export_pending?: boolean } | null)?.export_pending) {
    return {};
  }

  const token = await prepareDeactivatedExport(supabase, user.id);
  return token ? { token } : {};
}
