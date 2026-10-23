"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import type { LibraryShare, SpecItem } from "@/lib/types";

type ActionResult = { error?: string; token?: string; share?: LibraryShare };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function requireOwnLibrary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  libraryId: string
) {
  const { data: lib } = await supabase
    .from("libraries")
    .select("id, name")
    .eq("id", libraryId)
    .eq("user_id", userId)
    .single();
  return lib as { id: string; name: string } | null;
}

/** 创建分享链接（一个库可创建多个） */
export async function createLibraryShare(
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const libraryId = String(formData.get("library_id") || "");
  const lib = await requireOwnLibrary(supabase, user.id, libraryId);
  if (!lib) return { error: "产品库不存在或无权限" };

  const token = randomBytes(12).toString("base64url");
  const { data, error } = await supabase
    .from("library_shares")
    .insert({ library_id: libraryId, user_id: user.id, token })
    .select("*")
    .single();
  if (error) return { error: `创建分享失败：${error.message}` };

  revalidatePath("/products");
  return { share: data as LibraryShare };
}

/** 撤销分享 */
export async function revokeLibraryShare(
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  const { error } = await supabase
    .from("library_shares")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return {};
}

/** 获取某产品库的分享列表（属主） */
export async function listLibraryShares(
  libraryId: string
): Promise<LibraryShare[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("library_shares")
    .select("*")
    .eq("library_id", libraryId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data || []) as LibraryShare[];
}

export type SharedLibraryData = {
  ok: boolean;
  message?: string;
  library_name?: string;
  owner_name?: string;
  product_count?: number;
  products?: {
    name: string;
    model: string;
    category: string;
    specs: SpecItem[];
    price: number | null;
    notes: string;
    images: string[];
    docs: { name: string; path: string }[];
  }[];
};

/** 读取分享内容（公开，无需登录） */
export async function getSharedLibrary(
  token: string
): Promise<SharedLibraryData> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_library_share", {
    p_token: token,
  });
  return (data || { ok: false, message: "分享链接无效" }) as SharedLibraryData;
}

export type ImportShareResult = { imported: number; libraryId?: string; error?: string };

/**
 * 导入分享的产品库：新建「原名（分享）」库，复制产品及图片。
 * 文档附件（私有）不支持跨用户复制，会跳过。
 */
export async function importSharedLibrary(
  token: string
): Promise<ImportShareResult> {
  const { supabase, user } = await requireUser();

  const shared = await getSharedLibrary(token);
  if (!shared.ok || !shared.products) {
    return { imported: 0, error: shared.message || "分享链接无效" };
  }

  // 新建目标库
  const newLibName = `${shared.library_name || "分享产品库"}（分享）`.slice(0, 30);
  const { data: newLib, error: libError } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name: newLibName })
    .select("id")
    .single();
  if (libError || !newLib) {
    return { imported: 0, error: "创建产品库失败" };
  }

  let imported = 0;
  for (const p of shared.products) {
    // 复制图片到自己的目录（原图在公开 bucket，可直接读取）
    const newImages: string[] = [];
    for (const imgPath of p.images || []) {
      try {
        const { data: pub } = supabase.storage
          .from("product-images")
          .getPublicUrl(imgPath);
        const res = await fetch(pub.publicUrl);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const ext = imgPath.split(".").pop()?.slice(0, 5) || "jpg";
        const newPath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(newPath, buf, { contentType: "image/jpeg", upsert: false });
        if (!upErr) newImages.push(newPath);
      } catch {
        // 单张图片失败不影响整体
      }
    }

    const { error: insErr } = await supabase.from("products").insert({
      user_id: user.id,
      library_id: newLib.id,
      name: String(p.name || "未命名产品"),
      model: String(p.model || ""),
      category: String(p.category || "") || "未分类",
      price: p.price ?? null,
      specs: Array.isArray(p.specs) ? p.specs : [],
      notes: String(p.notes || ""),
      images: newImages,
      docs: [],
    });
    if (!insErr) imported++;
  }

  revalidatePath("/products");
  return { imported, libraryId: newLib.id };
}
