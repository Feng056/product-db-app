"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeLibraryName } from "@/lib/utils";
import { sortLibrariesByOrder } from "@/lib/library-order";
import type { Library } from "@/lib/types";

type ActionResult = { error?: string; message?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 确保用户至少拥有一个产品库；返回该用户全部产品库（按用户自定义顺序，未设置的按创建时间升序） */
export async function ensureDefaultLibrary(): Promise<Library[]> {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("libraries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const list = (data || []) as Library[];
  if (list.length > 0) {
    // 用户自定义顺序（列不存在时查询报错，静默回退到创建时间顺序）
    const { data: prof } = await supabase
      .from("profiles")
      .select("library_order")
      .eq("id", user.id)
      .maybeSingle();
    return sortLibrariesByOrder(list, (prof?.library_order as string[] | null) || null);
  }

  const { data: created, error } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name: "我的产品库" })
    .select("*")
    .single();
  if (error || !created) return list;
  return [created as Library];
}

/** 保存用户自定义的产品库显示顺序（仅限自己的库 id） */
export async function saveLibraryOrder(ids: string[]): Promise<{ ok: boolean; message?: string }> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("libraries").select("id").eq("user_id", user.id);
  const mine = new Set((data || []).map((d) => d.id));
  const clean = ids.filter((id) => mine.has(id));
  const { error } = await supabase
    .from("profiles")
    .update({ library_order: clean })
    .eq("id", user.id);
  if (error) return { ok: false, message: "保存顺序失败" };
  revalidatePath("/products");
  revalidatePath("/warehouse");
  return { ok: true };
}

/** 检查库名是否与已发布的公共库重名（规范化后比对；排除自己的库） */
async function checkDuplicatePublishedName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  currentUserId: string,
  excludeId?: string
): Promise<string | null> {
  const normalized = normalizeLibraryName(name);
  if (!normalized) return null;
  const { data: published } = await supabase
    .from("libraries")
    .select("id, name, user_id")
    .eq("publish_status", "published")
    .neq("user_id", currentUserId);
  for (const p of published || []) {
    if (excludeId && p.id === excludeId) continue;
    if (normalizeLibraryName(p.name) === normalized) {
      return p.name;
    }
  }
  return null;
}

/** 检查是否为订阅副本 */
async function isSubscriptionCopy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  libraryId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("library_subscriptions")
    .select("id")
    .eq("copy_library_id", libraryId)
    .eq("subscriber_id", userId)
    .limit(1);
  return !!data && data.length > 0;
}

/** 新建产品库（校验归属 + 重名检测） */
export async function createLibrary(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") || "").trim().slice(0, 30);
  if (!name) return { error: "请填写产品库名称" };

  const dup = await checkDuplicatePublishedName(supabase, name, user.id);
  if (dup) return { error: `库名与已发布的公共库「${dup}」重复，换个名字吧` };

  const { error } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name });
  if (error) return { error: `创建失败：${error.message}` };

  revalidatePath("/products");
  return {};
}

/** 重命名产品库（校验归属 + 订阅副本不可改名 + 重名检测） */
export async function renameLibrary(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 30);
  if (!id || !name) return { error: "参数缺失" };

  if (await isSubscriptionCopy(supabase, user.id, id)) {
    return { error: "订阅的库不可改名" };
  }

  const dup = await checkDuplicatePublishedName(supabase, name, user.id, id);
  if (dup) return { error: `库名与已发布的公共库「${dup}」重复，换个名字吧` };

  const { error } = await supabase
    .from("libraries")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: `改名失败：${error.message}` };

  revalidatePath("/products");
  return {};
}

/** 设置产品库的时间显示方式：both=同时显示 created=仅创建时间 updated=仅更新时间 */
export async function setLibraryTimeDisplay(
  libraryId: string,
  mode: string
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!["both", "created", "updated"].includes(mode)) {
    return { error: "参数无效" };
  }
  if (await isSubscriptionCopy(supabase, user.id, libraryId)) {
    return { error: "订阅的库不可修改此设置" };
  }
  const { error } = await supabase
    .from("libraries")
    .update({ time_display: mode })
    .eq("id", libraryId)
    .eq("user_id", user.id);
  if (error) return { error: `设置失败：${error.message}` };
  revalidatePath("/products");
  return {};
}

/** 删除产品库：先清该库下所有产品的附件文件，再删除（产品级联删除） */
export async function deleteLibrary(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const id = String(formData.get("id") || "");
  if (!id) return { error: "参数缺失" };

  // 校验归属
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "产品库不存在或无权限" };

  // 收集该库下所有产品的附件路径并删除文件
  const { data: products } = await supabase
    .from("products")
    .select("images, docs")
    .eq("library_id", id)
    .eq("user_id", user.id);
  const imagePaths: string[] = [];
  const docPaths: string[] = [];
  for (const p of products || []) {
    for (const img of ((p.images as string[]) || [])) imagePaths.push(img);
    for (const d of ((p.docs as { path: string }[]) || [])) {
      if (d?.path) docPaths.push(d.path);
    }
  }
  if (imagePaths.length)
    await supabase.storage.from("product-images").remove(imagePaths);
  if (docPaths.length)
    await supabase.storage.from("product-docs").remove(docPaths);

  const { error } = await supabase
    .from("libraries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: `删除失败：${error.message}` };

  revalidatePath("/products");
  return {};
}

/* ================= 发布审核 ================= */

/** 申请发布自己的库（进入待审核）；已发布的库可申请更新重新审核
 * @param categories 要发布的分类，null/空数组表示全部分类
 * @param coCreateEnabled 是否允许订阅者申请共同创作，默认关闭
 */
export async function requestPublish(
  libraryId: string,
  categories?: string[] | null,
  coCreateEnabled?: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id, publish_status")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  if (lib.publish_status === "pending") return { error: "已在审核中" };
  const publish_categories =
    categories && categories.length > 0 ? categories : null;
  const { error } = await supabase
    .from("libraries")
    .update({
      publish_status: "pending",
      publish_requested_at: new Date().toISOString(),
      publish_categories,
      co_create_enabled: coCreateEnabled === true,
    })
    .eq("id", libraryId);
  if (error) return { error: error.message };
  revalidatePath("/products/new");
  return { message: lib.publish_status === "published" ? "已提交更新审核，通过后自动推送给订阅者" : "已提交审核，等待管理员通过" };
}

/** 获取某库的共同创作开关（发布弹窗回显用，默认关闭） */
export async function getCoCreateEnabled(libraryId: string): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("libraries")
    .select("co_create_enabled")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  return (data as { co_create_enabled?: boolean } | null)?.co_create_enabled === true;
}

/** 发布者随时开关共同创作（仅本人库；关闭后仅已加入的创作者不受影响，其他人不再看到入口） */
export async function setCoCreateEnabled(
  libraryId: string,
  enabled: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  const { error } = await supabase
    .from("libraries")
    .update({ co_create_enabled: enabled })
    .eq("id", libraryId);
  if (error) return { error: error.message };
  revalidatePath("/warehouse");
  return {};
}

/** 库管理里自选是否在首页显示（仅本人库；关闭后首页切换条里不再显示，直达链接仍可打开） */
export async function setShowOnHome(
  libraryId: string,
  show: boolean
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  const { error } = await supabase
    .from("libraries")
    .update({ show_on_home: show })
    .eq("id", libraryId);
  if (error) return { error: "设置失败，稍后再试" };
  revalidatePath("/products");
  revalidatePath("/warehouse");
  return {};
}

/** 获取某库的去重分类列表（发布时勾选用） */
export async function getLibraryCategories(libraryId: string): Promise<string[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("products")
    .select("category")
    .eq("library_id", libraryId)
    .eq("user_id", user.id);
  const set = new Set<string>();
  for (const p of data || []) {
    const c = String((p as { category?: string }).category || "").trim() || "未分类";
    set.add(c);
  }
  return Array.from(set).sort();
}

/** 取消发布申请 / 下架已发布的库 */
export async function unpublishLibrary(libraryId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("libraries")
    .update({ publish_status: "private", publish_requested_at: null })
    .eq("id", libraryId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/products/new");
  return {};
}

/** 管理员：通过发布申请（通过后自动推送给所有订阅者） */
export async function approvePublish(libraryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "请先登录" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "无管理员权限" };
  const { error } = await supabase
    .from("libraries")
    .update({ publish_status: "published" })
    .eq("id", libraryId);
  if (error) return { error: error.message };
  // 自动推送给所有订阅者
  const { pushToAllSubscribers } = await import("@/actions/shares");
  const pushed = await pushToAllSubscribers(supabase, libraryId);
  revalidatePath("/settings");
  return { message: pushed > 0 ? `已通过，并推送给 ${pushed} 个订阅者` : "已通过发布" };
}

/** 管理员：驳回发布申请 */
export async function rejectPublish(libraryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "请先登录" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "无管理员权限" };
  const { error } = await supabase
    .from("libraries")
    .update({ publish_status: "rejected" })
    .eq("id", libraryId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

/** 获取已发布的库（发现页用，含主人昵称和产品数；含自己的已发布库和已订阅的库） */
export async function getPublishedLibraries(): Promise<
  { id: string; name: string; owner_name: string; product_count: number; created_at: string; publish_categories?: string[] | null; sub_count: number; is_own: boolean; is_subscribed: boolean; copy_id: string | null }[]
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: libs } = await supabase
    .from("libraries")
    .select("id, name, user_id, created_at, publish_categories")
    .eq("publish_status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!libs || libs.length === 0) return [];
  const ownerIds = Array.from(new Set(libs.map((l) => l.user_id)));
  // 发布者名字：profiles 仅本人可见，普通用户直接查会全是“未知”，
  // 改走仅返回 id/昵称/账号的 SECURITY DEFINER 函数；函数未建好时回退到直接查（不比以前差）
  const { data: rpcOwners, error: rpcError } = await supabase.rpc("get_publisher_names", {
    p_ids: ownerIds,
  });
  let owners = rpcOwners;
  if (rpcError || !owners) {
    const { data: profOwners } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", ownerIds);
    owners = profOwners;
  }
  const ownerMap = new Map(
    ((owners || []) as { id: string; display_name: string; username: string }[]).map((o) => [
      o.id,
      o.display_name || o.username || "未知",
    ])
  );
  // 产品数
  const { data: counts } = await supabase
    .from("products")
    .select("library_id")
    .in("library_id", libs.map((l) => l.id));
  const countMap: Record<string, number> = {};
  for (const c of counts || []) {
    const id = (c as { library_id: string }).library_id;
    countMap[id] = (countMap[id] || 0) + 1;
  }
  // 我订阅过的源库 → 我的副本 id（订阅过的库仍在广场显示，标为已订阅）
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("library_id, copy_library_id")
    .eq("subscriber_id", user.id);
  const subMap = new Map(
    ((subs || []) as { library_id: string; copy_library_id: string }[]).map((s) => [
      s.library_id,
      s.copy_library_id,
    ])
  );
  // 各发布库的订阅人数
  const { data: allSubs } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .in("library_id", libs.map((l) => l.id));
  const subCountMap: Record<string, number> = {};
  for (const s of allSubs || []) {
    const id = (s as { library_id: string }).library_id;
    subCountMap[id] = (subCountMap[id] || 0) + 1;
  }
  return libs
    .map((l) => ({
      id: l.id,
      name: l.name,
      owner_name: ownerMap.get(l.user_id) || "未知",
      product_count: countMap[l.id] || 0,
      created_at: l.created_at,
      publish_categories: (l as { publish_categories?: string[] | null }).publish_categories || null,
      sub_count: subCountMap[l.id] || 0,
      is_own: l.user_id === user.id,
      is_subscribed: subMap.has(l.id),
      copy_id: subMap.get(l.id) || null,
    }));
}

/** 管理员：获取待审核的发布申请 */
export async function getPendingPublishRequests(): Promise<
  { id: string; name: string; owner_name: string; product_count: number; publish_requested_at: string }[]
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return [];
  const { data: libs } = await supabase
    .from("libraries")
    .select("id, name, user_id, publish_requested_at")
    .eq("publish_status", "pending")
    .order("publish_requested_at", { ascending: true });
  if (!libs || libs.length === 0) return [];
  const ownerIds = Array.from(new Set(libs.map((l) => l.user_id)));
  const { data: owners } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", ownerIds);
  const ownerMap = new Map(
    ((owners || []) as { id: string; display_name: string; username: string }[]).map((o) => [
      o.id,
      o.display_name || o.username || "未知",
    ])
  );
  const { data: counts } = await supabase
    .from("products")
    .select("library_id")
    .in("library_id", libs.map((l) => l.id));
  const countMap: Record<string, number> = {};
  for (const c of counts || []) {
    const id = (c as { library_id: string }).library_id;
    countMap[id] = (countMap[id] || 0) + 1;
  }
  return libs.map((l) => ({
    id: l.id,
    name: l.name,
    owner_name: ownerMap.get(l.user_id) || "未知",
    product_count: countMap[l.id] || 0,
    publish_requested_at: l.publish_requested_at,
  }));
}
