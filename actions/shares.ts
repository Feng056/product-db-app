"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import type { SpecItem } from "@/lib/types";

type ActionResult = { error?: string; token?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 创建分享链接（支持单个或多个产品库） */
export async function createLibraryShare(
  libraryIds: string[]
): Promise<ActionResult & { share?: { id: string; token: string } }> {
  const { supabase, user } = await requireUser();
  const ids = Array.from(new Set(libraryIds)).filter(Boolean);
  if (ids.length === 0) return { error: "请选择要分享的产品库" };

  // 校验全部归属当前用户
  const { data: libs } = await supabase
    .from("libraries")
    .select("id")
    .eq("user_id", user.id)
    .in("id", ids);
  if (!libs || libs.length !== ids.length) return { error: "产品库不存在或无权限" };

  const token = randomBytes(12).toString("base64url");
  const { data, error } = await supabase
    .from("library_shares")
    .insert({ library_ids: ids, user_id: user.id, token })
    .select("id, token")
    .single();
  if (error) return { error: `创建分享失败：${error.message}` };

  revalidatePath("/products/new");
  return { share: data };
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
  revalidatePath("/products/new");
  return {};
}

/** 获取我的分享列表 */
export async function listLibraryShares(): Promise<
  { id: string; token: string; library_ids: string[]; created_at: string }[]
> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("library_shares")
    .select("id, token, library_ids, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data || []) as {
    id: string;
    token: string;
    library_ids: string[];
    created_at: string;
  }[];
}

export type SharedProduct = {
  name: string;
  model: string;
  category: string;
  specs: SpecItem[];
  price: number | null;
  notes: string;
  images: string[];
  docs: { name: string; path: string }[];
};

export type SharedLibraryData = {
  ok: boolean;
  message?: string;
  owner_name?: string;
  libraries?: {
    library_name: string;
    product_count: number;
    products: SharedProduct[];
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

export type ImportShareResult = {
  imported: number;
  libraryIds?: string[];
  error?: string;
};

/**
 * 导入分享的产品库（支持多选、改名）：为每个选中的库新建产品库并复制产品。
 * selections: [{ index, name }] index 为分享中 libraries 数组下标，name 为新库名
 */
export async function importSharedLibraries(
  token: string,
  selections: { index: number; name: string }[]
): Promise<ImportShareResult> {
  const { supabase, user } = await requireUser();

  const shared = await getSharedLibrary(token);
  if (!shared.ok || !shared.libraries) {
    return { imported: 0, error: shared.message || "分享链接无效" };
  }

  let imported = 0;
  const libraryIds: string[] = [];

  for (const sel of selections) {
    const lib = shared.libraries[sel.index];
    if (!lib) continue;
    const newLibName = (sel.name || lib.library_name || "分享产品库").slice(0, 30);

    const { data: newLib, error: libError } = await supabase
      .from("libraries")
      .insert({ user_id: user.id, name: newLibName })
      .select("id")
      .single();
    if (libError || !newLib) continue;
    libraryIds.push(newLib.id);

    for (const p of lib.products || []) {
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
  }

  revalidatePath("/products");
  return { imported, libraryIds };
}

// 兼容旧的单库导入（保留）
export async function importSharedLibrary(
  token: string
): Promise<{ imported: number; libraryId?: string; error?: string }> {
  const res = await importSharedLibraries(token, [{ index: 0, name: "" }]);
  return {
    imported: res.imported,
    libraryId: res.libraryIds?.[0],
    error: res.error,
  };
}
