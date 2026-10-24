"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

/** 确保用户至少拥有一个产品库；返回该用户全部产品库（按创建时间升序） */
export async function ensureDefaultLibrary(): Promise<Library[]> {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("libraries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const list = (data || []) as Library[];
  if (list.length > 0) return list;

  const { data: created, error } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name: "我的产品库" })
    .select("*")
    .single();
  if (error || !created) return list;
  return [created as Library];
}

/** 新建产品库 */
export async function createLibrary(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") || "").trim().slice(0, 30);
  if (!name) return { error: "请填写产品库名称" };

  const { error } = await supabase
    .from("libraries")
    .insert({ user_id: user.id, name });
  if (error) return { error: `创建失败：${error.message}` };

  revalidatePath("/products");
  return {};
}

/** 重命名产品库（校验归属） */
export async function renameLibrary(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 30);
  if (!id || !name) return { error: "参数缺失" };

  const { error } = await supabase
    .from("libraries")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: `改名失败：${error.message}` };

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

/** 申请发布自己的库（进入待审核） */
export async function requestPublish(libraryId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id, publish_status")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  if (lib.publish_status === "published") return { error: "已发布" };
  if (lib.publish_status === "pending") return { error: "已在审核中" };
  const { error } = await supabase
    .from("libraries")
    .update({ publish_status: "pending", publish_requested_at: new Date().toISOString() })
    .eq("id", libraryId);
  if (error) return { error: error.message };
  revalidatePath("/products/new");
  return { message: "已提交审核，等待管理员通过" };
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

/** 管理员：通过发布申请 */
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
  revalidatePath("/settings");
  return {};
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

/** 获取已发布的库（发现页用，含主人昵称和产品数） */
export async function getPublishedLibraries(): Promise<
  { id: string; name: string; owner_name: string; product_count: number; created_at: string }[]
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: libs } = await supabase
    .from("libraries")
    .select("id, name, user_id, created_at")
    .eq("publish_status", "published")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
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
  // 已订阅的排除
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .eq("subscriber_id", user.id);
  const subbed = new Set((subs || []).map((s) => s.library_id));
  return libs
    .filter((l) => !subbed.has(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      owner_name: ownerMap.get(l.user_id) || "未知",
      product_count: countMap[l.id] || 0,
      created_at: l.created_at,
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
