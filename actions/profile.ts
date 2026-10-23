"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 修改昵称（最多 10 个字符） */
export async function updateDisplayName(
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("display_name") || "").trim();
  if (!name) return { error: "昵称不能为空" };
  if (Array.from(name).length > 10) return { error: "昵称最多 10 个字符" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 更换头像：上传新图，删除旧图 */
export async function updateAvatar(
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const file = formData.get("avatar") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "请选择图片" };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "请选择图片文件" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "图片不能超过 2MB" };
  }

  // 查出旧头像
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  const oldPath = (profile as { avatar_path?: string } | null)?.avatar_path || "";

  const ext = (file.name.split(".").pop() || "jpg").slice(0, 5).replace(/[^\w]/g, "") || "jpg";
  const newPath = `${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(newPath, file, { upsert: false, contentType: file.type });
  if (upErr) return { error: "头像上传失败" };

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_path: newPath })
    .eq("id", user.id);
  if (dbErr) {
    await supabase.storage.from("avatars").remove([newPath]);
    return { error: dbErr.message };
  }

  // 删除旧头像（忽略失败）
  if (oldPath && oldPath.startsWith(`${user.id}/`)) {
    await supabase.storage.from("avatars").remove([oldPath]);
  }

  revalidatePath("/settings");
  return {};
}
