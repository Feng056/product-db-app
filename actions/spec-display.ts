"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  SPEC_DISPLAY_KEY,
  parseSpecDisplayConfig,
  type SpecDisplayConfig,
} from "@/lib/spec-display";

/** 校验当前用户是管理员，返回 supabase client（与 actions/admin.ts 同口径） */
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

/** 读全局规格展示配置；行缺失/非法时回默认（全部显示、原顺序） */
export async function getSpecDisplayConfig(): Promise<SpecDisplayConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", SPEC_DISPLAY_KEY)
    .single();
  return parseSpecDisplayConfig((data as { value?: string } | null)?.value);
}

function cleanKeys(keys: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const t = (k || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 保存全局规格展示配置（仅管理员；顺序与隐藏键对资料库所有商品统一生效） */
export async function saveSpecDisplayConfig(
  order: string[],
  hidden: string[]
): Promise<{ error?: string; message?: string }> {
  const { supabase } = await requireAdmin();
  const cleanOrder = cleanKeys(order);
  const cleanHidden = cleanKeys(hidden);
  const { error } = await supabase.from("system_settings").upsert({
    key: SPEC_DISPLAY_KEY,
    value: JSON.stringify({ order: cleanOrder, hidden: cleanHidden }),
  });
  if (error) return { error: "保存失败，请重试" };
  revalidatePath("/settings");
  return { message: "已保存" };
}
