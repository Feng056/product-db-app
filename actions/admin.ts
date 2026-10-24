"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";

type ActionResult = { error?: string; message?: string };

/** 校验当前用户是管理员，返回 supabase client */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    throw new Error("无管理员权限");
  }
  return { supabase, user };
}

/** 创建邀请码（来源标注必填，可指定分组） */
export async function createInviteCode(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  const customCode = String(formData.get("code") || "").trim().toUpperCase();
  const sourceLabel = String(formData.get("sourceLabel") || "").trim();
  const maxUses = Math.max(1, parseInt(String(formData.get("maxUses") || "1"), 10) || 1);
  const groupId = String(formData.get("groupId") || "").trim() || null;

  if (!sourceLabel) return { error: "请填写来源标注" };

  const code = customCode || generateInviteCode("INVITE");

  const { error } = await supabase.from("invite_codes").insert({
    code,
    source_label: sourceLabel,
    created_by: user.id,
    max_uses: maxUses,
    group_id: groupId,
  });
  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { error: "该邀请码已存在，请换一个" };
    }
    return { error: `创建失败：${error.message}` };
  }

  revalidatePath("/settings");
  return { message: `邀请码 ${code} 创建成功` };
}

/** 启用 / 停用邀请码 */
export async function toggleInviteCode(id: string, isActive: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("invite_codes")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 删除邀请码（已有用户使用的码建议停用而非删除） */
export async function deleteInviteCode(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("invite_codes").delete().eq("id", id);
  if (error) return { error: `删除失败：${error.message}（可能已有用户使用该码）` };
  revalidatePath("/settings");
  return {};
}

/* ================= 分组管理 ================= */

/** 创建分组 */
export async function createGroup(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "请填写分组名称" };
  const { error } = await supabase.from("groups").insert({ name });
  if (error) return { error: `创建失败：${error.message}` };
  revalidatePath("/settings");
  return { message: `分组「${name}」创建成功` };
}

/** 重命名分组 */
export async function renameGroup(id: string, name: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  name = name.trim();
  if (!name) return { error: "分组名称不能为空" };
  const { error } = await supabase.from("groups").update({ name }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 启用 / 停用分组（停用后该组所有用户无法登录） */
export async function toggleGroup(id: string, isActive: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("groups")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 删除分组（组内用户自动移出分组） */
export async function deleteGroup(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  await supabase.from("profiles").update({ group_id: null }).eq("group_id", id);
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) return { error: `删除失败：${error.message}` };
  revalidatePath("/settings");
  return {};
}

/* ================= 用户管理 ================= */

/** 移动用户到指定分组（groupId 为 null 表示移出分组） */
export async function moveUserToGroup(
  userId: string,
  groupId: string | null
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (userId === user.id) return { error: "不能移动自己的分组" };
  const { error } = await supabase
    .from("profiles")
    .update({ group_id: groupId || null })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 启用 / 停用单个用户 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (userId === user.id) return { error: "不能停用自己" };
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: !isActive })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 设置用户标签（覆盖式） */
export async function setUserTags(
  userId: string,
  tags: string[]
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 20);
  const { error } = await supabase
    .from("profiles")
    .update({ tags: clean })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/* ================= 注册审核 ================= */

/** 获取待审核的注册申请 */
export async function getPendingRegistrations(): Promise<
  { id: string; username: string; display_name: string; registration_note: string; created_at: string }[]
> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, registration_note, created_at")
    .eq("registration_status", "pending")
    .order("created_at", { ascending: true });
  return (data || []) as {
    id: string;
    username: string;
    display_name: string;
    registration_note: string;
    created_at: string;
  }[];
}

/** 通过注册申请 */
export async function approveRegistration(userId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ registration_status: "approved" })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 驳回注册申请 */
export async function rejectRegistration(userId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ registration_status: "rejected" })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/* ================= 密码重置申请 ================= */

/** 获取待处理的密码重置申请 */
export async function getPendingPasswordResets(): Promise<
  { id: string; username: string; display_name: string; note: string | null; created_at: string }[]
> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("password_reset_requests")
    .select("id, username, display_name, note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data || []) as {
    id: string;
    username: string;
    display_name: string;
    note: string | null;
    created_at: string;
  }[];
}

/** 管理员重置用户密码：生成临时密码（需 SUPABASE_SERVICE_ROLE_KEY） */
export async function resetUserPassword(
  requestId: string
): Promise<{ tempPassword?: string; error?: string }> {
  const { supabase } = await requireAdmin();

  const { data: req } = await supabase
    .from("password_reset_requests")
    .select("id, user_id, username, status")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();
  if (!req) return { error: "申请不存在或已处理" };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return { error: "未配置 SUPABASE_SERVICE_ROLE_KEY，请联系技术支持" };
  }

  // 生成 8 位临时密码（字母+数字）
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let tempPassword = "";
  const rand = new Uint8Array(8);
  crypto.getRandomValues(rand);
  for (let i = 0; i < rand.length; i++) {
    tempPassword += chars[rand[i] % chars.length];
  }

  // 用 service_role 更新 Auth 密码
  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );
  const { error: updateError } = await admin.auth.admin.updateUserById(
    req.user_id,
    { password: tempPassword }
  );
  if (updateError) {
    return { error: `重置失败：${updateError.message}` };
  }

  await supabase
    .from("password_reset_requests")
    .update({ status: "done" })
    .eq("id", requestId);

  revalidatePath("/settings");
  return { tempPassword };
}

/** 驳回密码重置申请 */
export async function rejectPasswordReset(requestId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("password_reset_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}
