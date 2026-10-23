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

/** 创建邀请码（来源标注必填） */
export async function createInviteCode(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();

  const customCode = String(formData.get("code") || "").trim().toUpperCase();
  const sourceLabel = String(formData.get("sourceLabel") || "").trim();
  const maxUses = Math.max(1, parseInt(String(formData.get("maxUses") || "1"), 10) || 1);

  if (!sourceLabel) return { error: "请填写来源标注" };

  const code = customCode || generateInviteCode("INVITE");

  const { error } = await supabase.from("invite_codes").insert({
    code,
    source_label: sourceLabel,
    created_by: user.id,
    max_uses: maxUses,
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
