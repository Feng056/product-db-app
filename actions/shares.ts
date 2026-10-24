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
    .insert({ library_id: ids[0], library_ids: ids, user_id: user.id, token })
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

/* ================= 订阅制（复制+同步） ================= */

/** 从源库复制产品到目标库（含图片重存） */
async function copyProductsToLibrary(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  sourceLibraryId: string,
  targetLibraryId: string,
  targetUserId: string
): Promise<number> {
  // 读源库产品（分享者已通过 get_library_share 授权，或主人自己）
  const { data: products } = await supabase
    .from("products")
    .select("name, model, category, price, specs, notes, images")
    .eq("library_id", sourceLibraryId);
  let copied = 0;
  for (const p of products || []) {
    const newImages: string[] = [];
    for (const imgPath of (p.images as string[]) || []) {
      try {
        const { data: pub } = supabase.storage
          .from("product-images")
          .getPublicUrl(imgPath);
        const res = await fetch(pub.publicUrl);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const ext = imgPath.split(".").pop()?.slice(0, 5) || "jpg";
        const newPath = `${targetUserId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(newPath, buf, { contentType: "image/jpeg", upsert: false });
        if (!upErr) newImages.push(newPath);
      } catch {
        /* 单张失败跳过 */
      }
    }
    const { error: insErr } = await supabase.from("products").insert({
      user_id: targetUserId,
      library_id: targetLibraryId,
      name: String(p.name || "未命名产品"),
      model: String(p.model || ""),
      category: String(p.category || "") || "未分类",
      price: (p as { price?: number | null }).price ?? null,
      specs: Array.isArray(p.specs) ? p.specs : [],
      notes: String(p.notes || ""),
      images: newImages,
      docs: [],
    });
    if (!insErr) copied++;
  }
  return copied;
}

/** 订阅：导入副本 + 建立订阅关系（副本只读） */
export async function subscribeToLibraries(
  token: string,
  selections: { index: number; name: string }[]
): Promise<{ subscribed: number; libraryIds?: string[]; error?: string }> {
  const { supabase, user } = await requireUser();

  const shared = await getSharedLibrary(token);
  if (!shared.ok || !shared.libraries) {
    return { subscribed: 0, error: shared.message || "分享链接无效" };
  }
  // 源库 id 列表
  const { data: shareRow } = await supabase
    .from("library_shares")
    .select("library_ids")
    .eq("token", token)
    .single();
  const sourceIds = (shareRow?.library_ids as string[]) || [];

  let subscribed = 0;
  const libraryIds: string[] = [];
  for (const sel of selections) {
    const lib = shared.libraries[sel.index];
    const sourceId = sourceIds[sel.index];
    if (!lib || !sourceId) continue;
    // 不能订阅自己的库
    const { data: srcLib } = await supabase
      .from("libraries")
      .select("user_id")
      .eq("id", sourceId)
      .single();
    if (!srcLib || srcLib.user_id === user.id) continue;
    // 已订阅过则跳过
    const { data: existing } = await supabase
      .from("library_subscriptions")
      .select("id")
      .eq("library_id", sourceId)
      .eq("subscriber_id", user.id)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const copyName = (sel.name || lib.library_name || "订阅产品库").slice(0, 30);
    const { data: newLib, error: libError } = await supabase
      .from("libraries")
      .insert({ user_id: user.id, name: copyName })
      .select("id")
      .single();
    if (libError || !newLib) continue;

    await copyProductsToLibrary(supabase, sourceId, newLib.id, user.id);
    await supabase.from("library_subscriptions").insert({
      library_id: sourceId,
      copy_library_id: newLib.id,
      subscriber_id: user.id,
    });
    subscribed++;
    libraryIds.push(newLib.id);
  }

  revalidatePath("/products");
  return { subscribed, libraryIds };
}

/** 同步单个副本：清空后从源库重拷 */
/** 内部：推送源库到所有订阅者副本（不校验调用者身份，供管理员审核通过后调用） */
export async function pushToAllSubscribers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceLibraryId: string
): Promise<number> {
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("id, copy_library_id, subscriber_id")
    .eq("library_id", sourceLibraryId);
  let updated = 0;
  for (const s of subs || []) {
    if (!s.copy_library_id) continue;
    await syncCopy(supabase, sourceLibraryId, s.copy_library_id, s.subscriber_id);
    // 标记有更新，提示订阅者
    await supabase
      .from("library_subscriptions")
      .update({ has_update: true })
      .eq("id", s.id);
    updated++;
  }
  return updated;
}

async function syncCopy(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  sourceId: string,
  copyId: string,
  copyOwnerId: string
): Promise<number> {
  await supabase.from("products").delete().eq("library_id", copyId);
  return copyProductsToLibrary(supabase, sourceId, copyId, copyOwnerId);
}

/** 主人一键推送：把源库最新内容覆盖到所有订阅者的副本 */
export async function pushSubscriptionUpdate(
  sourceLibraryId: string
): Promise<{ updated: number; error?: string }> {
  const { supabase, user } = await requireUser();
  // 校验是主人的库
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", sourceLibraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { updated: 0, error: "无权限" };

  const updated = await pushToAllSubscribers(supabase, sourceLibraryId);
  revalidatePath("/products");
  return { updated };
}

/** 订阅者刷新：把自己的副本同步到最新 */
export async function pullSubscriptionUpdate(
  copyLibraryId: string
): Promise<{ updated: number; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: sub } = await supabase
    .from("library_subscriptions")
    .select("library_id, subscriber_id")
    .eq("copy_library_id", copyLibraryId)
    .eq("subscriber_id", user.id)
    .single();
  if (!sub) return { updated: 0, error: "不是订阅的库" };
  const count = await syncCopy(supabase, sub.library_id, copyLibraryId, user.id);
  revalidatePath("/products");
  return { updated: count };
}

/** 取消订阅：删除副本 + 订阅关系（整库删除） */
export async function unsubscribeFromLibrary(
  copyLibraryId: string
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: sub } = await supabase
    .from("library_subscriptions")
    .select("id")
    .eq("copy_library_id", copyLibraryId)
    .eq("subscriber_id", user.id)
    .single();
  if (!sub) return { error: "不是订阅的库" };
  await supabase.from("library_subscriptions").delete().eq("id", sub.id);
  // 删除整个副本库（级联删除产品）
  const { error } = await supabase
    .from("libraries")
    .delete()
    .eq("id", copyLibraryId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/products");
  return {};
}

/** 查询某库的订阅信息 */
export async function getSubscriptionInfo(libraryId: string): Promise<{
  isCopy: boolean;
  sourceId?: string;
  subscriberCount?: number;
}> {
  const { supabase, user } = await requireUser();
  // 是不是订阅副本？
  const { data: asCopy } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .eq("copy_library_id", libraryId)
    .eq("subscriber_id", user.id)
    .single();
  if (asCopy) return { isCopy: true, sourceId: asCopy.library_id };
  // 是不是被订阅的源库？
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (lib) {
    const { count } = await supabase
      .from("library_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("library_id", libraryId);
    return { isCopy: false, subscriberCount: count || 0 };
  }
  return { isCopy: false };
}

/** 直接订阅已发布的库（发现页用，无需分享链接） */
export async function subscribeToPublished(
  sourceLibraryId: string
): Promise<{ libraryId?: string; error?: string }> {
  const { supabase, user } = await requireUser();

  // 校验是已发布的库且不是自己的
  const { data: srcLib } = await supabase
    .from("libraries")
    .select("id, name, user_id, publish_status")
    .eq("id", sourceLibraryId)
    .single();
  if (!srcLib || srcLib.publish_status !== "published") {
    return { error: "该库未发布或不存在" };
  }
  if (srcLib.user_id === user.id) return { error: "不能订阅自己的库" };

  // 已订阅过则直接返回
  const { data: existing } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("library_id", sourceLibraryId)
    .eq("subscriber_id", user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { libraryId: existing[0].copy_library_id };
  }

  const { data: newLib, error: libError } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name: srcLib.name.slice(0, 30) })
    .select("id")
    .single();
  if (libError || !newLib) return { error: "订阅失败" };

  await copyProductsToLibrary(supabase, sourceLibraryId, newLib.id, user.id);
  await supabase.from("library_subscriptions").insert({
    library_id: sourceLibraryId,
    copy_library_id: newLib.id,
    subscriber_id: user.id,
  });

  revalidatePath("/products");
  return { libraryId: newLib.id };
}

/** 直接导入已发布的库为独立副本（可自由修改，与发布者无关） */
export async function importPublishedLibrary(
  sourceLibraryId: string
): Promise<{ libraryId?: string; error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: srcLib } = await supabase
    .from("libraries")
    .select("id, name, publish_status")
    .eq("id", sourceLibraryId)
    .single();
  if (!srcLib || srcLib.publish_status !== "published") {
    return { error: "该库未发布或不存在" };
  }

  const { data: newLib, error: libError } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name: srcLib.name.slice(0, 30) })
    .select("id")
    .single();
  if (libError || !newLib) return { error: "导入失败" };

  await copyProductsToLibrary(supabase, sourceLibraryId, newLib.id, user.id);
  revalidatePath("/products");
  return { libraryId: newLib.id };
}

/** 清除订阅更新通知（用户已查看） */
export async function dismissUpdateNotify(copyLibraryId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("library_subscriptions")
    .update({ has_update: false })
    .eq("copy_library_id", copyLibraryId)
    .eq("subscriber_id", user.id);
}
