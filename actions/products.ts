"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DocItem, SpecItem } from "@/lib/types";

type ActionResult = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 校验产品库可编辑：自建库可写；订阅副本仅已批准的共同创作者可写，且有待审核提交时锁定 */
async function assertLibraryWritable(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  libraryId: string
): Promise<string | null> {
  const { data: sub } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .eq("copy_library_id", libraryId)
    .eq("subscriber_id", userId)
    .limit(1);
  if (!sub || sub.length === 0) return null; // 自建库
  // 订阅副本：需为该源库已批准的共同创作者
  const { data: cc } = await supabase
    .from("library_co_creators")
    .select("status")
    .eq("source_library_id", sub[0].library_id)
    .eq("user_id", userId)
    .limit(1);
  if (!cc || cc.length === 0 || cc[0].status !== "approved") {
    return "订阅的库为只读，不可修改。如需最新内容请点刷新";
  }
  // 有待审核的提交时锁定副本，防止提交后继续改导致对比失真
  const { data: pend } = await supabase
    .from("co_creation_submissions")
    .select("id")
    .eq("copy_library_id", libraryId)
    .eq("status", "pending")
    .limit(1);
  if (pend && pend.length > 0) return "修改已提交，等待发布者审核，期间不可再改";
  return null;
}

/** 严格版：订阅副本一律不可写（导出用，防止订阅内容被导出后改头换面冒充发布者） */
async function assertLibraryNotCopy(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  libraryId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("library_subscriptions")
    .select("id")
    .eq("copy_library_id", libraryId)
    .eq("subscriber_id", userId)
    .limit(1);
  if (data && data.length > 0) {
    return "订阅的库为只读，不可修改。如需最新内容请点刷新";
  }
  return null;
}

function parseSpecs(raw: string): SpecItem[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && (s.key || s.value))
      .map((s) => ({ key: String(s.key || ""), value: String(s.value || "") }));
  } catch {
    return [];
  }
}

function parseDocs(raw: string): DocItem[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((d) => d && d.path)
      .map((d) => ({ name: String(d.name || d.path), path: String(d.path) }));
  } catch {
    return [];
  }
}

/** 上传一批文件到指定 bucket，返回 Storage 路径数组 */
async function uploadFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: string,
  userId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    const safeName = file.name.replace(/[^\w.\-()[\] ]+/g, "_");
    const path = `${userId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
    });
    if (error) throw new Error(`文件上传失败：${file.name}`);
    paths.push(path);
  }
  return paths;
}

/** 新建产品 */
export async function createProduct(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "请填写产品名称" };

  // 校验目标产品库归属；未传时用默认库（第一个）
  const libraryIdRaw = String(formData.get("library_id") || "").trim();
  let libraryId: string | null = null;
  if (libraryIdRaw) {
    const { data: lib } = await supabase
      .from("libraries")
      .select("id")
      .eq("id", libraryIdRaw)
      .eq("user_id", user.id)
      .single();
    if (!lib) return { error: "所选产品库无效" };
    libraryId = lib.id;
  } else {
    const { data: libs } = await supabase
      .from("libraries")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    libraryId = libs?.[0]?.id || null;
  }
  if (!libraryId) return { error: "请先创建产品库" };
  const readonlyErr = await assertLibraryWritable(supabase, user.id, libraryId);
  if (readonlyErr) return { error: readonlyErr };

  try {
    const imageFiles = (formData.getAll("newImages") as File[]).filter(
      (f) => f instanceof File && f.size > 0
    );
    const docFiles = (formData.getAll("newDocs") as File[]).filter(
      (f) => f instanceof File && f.size > 0
    );
    const imagePaths = await uploadFiles(supabase, "product-images", user.id, imageFiles);
    const docPaths = await uploadFiles(supabase, "product-docs", user.id, docFiles);

    const priceRaw = String(formData.get("price") || "").trim();
    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      library_id: libraryId,
      name,
      model: String(formData.get("model") || "").trim(),
      category: String(formData.get("category") || "").trim() || "未分类",
      specs: parseSpecs(String(formData.get("specs") || "")),
      price: priceRaw === "" ? null : Number(priceRaw),
      notes: String(formData.get("notes") || ""),
      images: imagePaths,
      docs: docPaths.map((path, i) => ({
        name: docFiles[i]?.name || path,
        path,
      })),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "保存失败" };
  }

  revalidatePath("/products");
  redirect("/products");
}

/** 更新产品 */
export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id) return { error: "缺少产品 ID" };
  if (!name) return { error: "请填写产品名称" };

  // 确认是自己的产品
  const { data: existing } = await supabase
    .from("products")
    .select("id, images, docs, library_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "产品不存在或无权限" };
  const readonlyErr = await assertLibraryWritable(supabase, user.id, existing.library_id);
  if (readonlyErr) return { error: readonlyErr };

  try {
    const imageFiles = (formData.getAll("newImages") as File[]).filter(
      (f) => f instanceof File && f.size > 0
    );
    const docFiles = (formData.getAll("newDocs") as File[]).filter(
      (f) => f instanceof File && f.size > 0
    );
    const newImagePaths = await uploadFiles(supabase, "product-images", user.id, imageFiles);
    const newDocPaths = await uploadFiles(supabase, "product-docs", user.id, docFiles);

    // 保留的图片 / 文档（表单传回的 JSON）
    const keepImages: string[] = JSON.parse(String(formData.get("keepImages") || "[]"));
    const keepDocs: DocItem[] = parseDocs(String(formData.get("keepDocs") || ""));

    // 删除被移除的文件
    const removedImages = (existing.images as string[]).filter(
      (p) => !keepImages.includes(p)
    );
    const removedDocPaths = ((existing.docs as DocItem[]) || [])
      .map((d) => d.path)
      .filter((p) => !keepDocs.some((k) => k.path === p));
    if (removedImages.length)
      await supabase.storage.from("product-images").remove(removedImages);
    if (removedDocPaths.length)
      await supabase.storage.from("product-docs").remove(removedDocPaths);

    const priceRaw = String(formData.get("price") || "").trim();
    const { error } = await supabase
      .from("products")
      .update({
        name,
        model: String(formData.get("model") || "").trim(),
        category: String(formData.get("category") || "").trim() || "未分类",
        specs: parseSpecs(String(formData.get("specs") || "")),
        price: priceRaw === "" ? null : Number(priceRaw),
        notes: String(formData.get("notes") || ""),
        images: [...keepImages, ...newImagePaths],
        docs: [
          ...keepDocs,
          ...newDocPaths.map((path, i) => ({
            name: docFiles[i]?.name || path,
            path,
          })),
        ],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "保存失败" };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

/** 删除产品（含 Storage 文件） */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("products")
    .select("id, images, docs, library_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "产品不存在或无权限" };
  const readonlyErr = await assertLibraryWritable(supabase, user.id, existing.library_id);
  if (readonlyErr) return { error: readonlyErr };

  const imagePaths = (existing.images as string[]) || [];
  const docPaths = ((existing.docs as DocItem[]) || []).map((d) => d.path);
  if (imagePaths.length)
    await supabase.storage.from("product-images").remove(imagePaths);
  if (docPaths.length)
    await supabase.storage.from("product-docs").remove(docPaths);

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/products");
  redirect("/products");
}

/** 获取文档的临时下载链接（product-docs 是私有 bucket） */
export async function getDocDownloadUrl(path: string): Promise<{ url?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!path.startsWith(`${user.id}/`)) return { error: "无权限" };
  const { data, error } = await supabase.storage
    .from("product-docs")
    .createSignedUrl(path, 300);
  if (error || !data) return { error: "获取下载链接失败" };
  return { url: data.signedUrl };
}

export type LibraryExportData = {
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: SpecItem[];
  notes: string;
  images: string[];
  docs: DocItem[];
};

/** 按需获取整个产品库的导出数据（避免列表页每次全量加载） */
export async function getLibraryExportData(
  libraryId: string
): Promise<{ data?: LibraryExportData[]; error?: string }> {
  const { supabase, user } = await requireUser();

  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "产品库不存在或无权限" };
  const readonlyErr = await assertLibraryNotCopy(supabase, user.id, libraryId);
  if (readonlyErr) return { error: "订阅的库不支持导出" };

  const { data, error } = await supabase
    .from("products")
    .select("name, model, category, price, specs, notes, images, docs")
    .eq("user_id", user.id)
    .eq("library_id", libraryId)
    .order("updated_at", { ascending: false });
  if (error) return { error: error.message };
  return { data: (data || []) as LibraryExportData[] };
}

export type MultiLibraryExportItem = LibraryExportData & { library_name: string };

/** 多库导出：一次获取多个产品库的产品（校验归属） */
export async function getMultiLibraryExportData(
  libraryIds: string[]
): Promise<{ data?: MultiLibraryExportItem[]; error?: string }> {
  const { supabase, user } = await requireUser();

  const ids = Array.from(new Set(libraryIds.filter(Boolean))).slice(0, 20);
  if (ids.length === 0) return { error: "请至少选择一个产品库" };

  const { data: libs } = await supabase
    .from("libraries")
    .select("id, name")
    .eq("user_id", user.id)
    .in("id", ids);
  const libMap = new Map(((libs || []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));
  if (libMap.size === 0) return { error: "所选产品库无效" };

  // 剔除订阅副本（不支持导出）
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", user.id)
    .in("copy_library_id", Array.from(libMap.keys()));
  for (const s of subs || []) {
    libMap.delete(s.copy_library_id);
  }
  if (libMap.size === 0) return { error: "订阅的库不支持导出" };

  const { data, error } = await supabase
    .from("products")
    .select("library_id, name, model, category, price, specs, notes, images, docs")
    .eq("user_id", user.id)
    .in("library_id", Array.from(libMap.keys()))
    .order("library_id")
    .order("updated_at", { ascending: false });
  if (error) return { error: error.message };

  const items = ((data || []) as (LibraryExportData & { library_id: string })[]).map((p) => ({
    library_name: libMap.get(p.library_id) || "",
    name: p.name,
    model: p.model,
    category: p.category,
    price: p.price,
    specs: p.specs,
    notes: p.notes,
    images: p.images,
    docs: p.docs,
  }));
  return { data: items };
}

/** 批量修改价格：一键更新多个产品的价格 */
export async function batchUpdatePrice(
  libraryId: string,
  productIds: string[],
  newPrice: number
): Promise<{ updated?: number; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!productIds.length) return { error: "未选择产品" };
  if (!Number.isFinite(newPrice) || newPrice < 0) return { error: "价格无效" };

  // 校验产品库归属
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", libraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "产品库不存在或无权限" };
  const readonlyErr = await assertLibraryWritable(supabase, user.id, libraryId);
  if (readonlyErr) return { error: readonlyErr };

  // 仅更新属于该用户该库的产品
  const { data: updated, error } = await supabase
    .from("products")
    .update({ price: newPrice })
    .eq("user_id", user.id)
    .eq("library_id", libraryId)
    .in("id", productIds)
    .select("id");
  if (error) return { error: error.message };

  revalidatePath("/products");
  return { updated: (updated || []).length };
}

/** 分类/标签管理专用校验：必须是调用者自己的自建库，订阅副本一律不可管理 */
async function assertLibraryManageable(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  libraryId: string
): Promise<string | null> {
  const { data: lib } = await supabase
    .from("libraries")
    .select("user_id")
    .eq("id", libraryId)
    .single();
  if (!lib || lib.user_id !== userId) return "只能管理自己的产品库";
  return assertLibraryNotCopy(supabase, userId, libraryId);
}

type NameCount = { name: string; count: number };

/**
 * 分类/标签统计（管理页用）：
 * 分类按产品行统计，空分类归入“未分类”；标签按产品统计，
 * 同一产品多行同值标签只算一次。分页拉取，库大也不丢行。
 */
export async function getCategoryTagStats(libraryId: string): Promise<{
  categories: NameCount[];
  tags: NameCount[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();
  if (!libraryId) return { categories: [], tags: [], error: "请先选择产品库" };
  const manageableErr = await assertLibraryManageable(supabase, user.id, libraryId);
  if (manageableErr) return { categories: [], tags: [], error: manageableErr };
  const catCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("category, specs")
      .eq("library_id", libraryId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { categories: [], tags: [], error: error.message };
    for (const r of data || []) {
      const row = r as { category?: string | null; specs?: SpecItem[] | null };
      const bucket = row.category || "未分类";
      catCount.set(bucket, (catCount.get(bucket) || 0) + 1);
      const seen = new Set<string>();
      for (const s of row.specs || []) {
        if (s && s.key === "标签" && s.value && !seen.has(s.value)) {
          seen.add(s.value);
          tagCount.set(s.value, (tagCount.get(s.value) || 0) + 1);
        }
      }
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  const byCountThenName = (a: NameCount, b: NameCount) =>
    b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const categories: NameCount[] = [];
  const tags: NameCount[] = [];
  catCount.forEach((count, name) => {
    categories.push({ name, count });
  });
  tagCount.forEach((count, name) => {
    tags.push({ name, count });
  });
  categories.sort(byCountThenName);
  tags.sort(byCountThenName);
  return { categories, tags };
}

/**
 * 分类改名：批量改该分类下所有产品的 category。
 * 改成已存在的名字即合并。更新时间由数据库触发器正常盖，不手动处理。
 */
export async function renameCategory(
  libraryId: string,
  oldName: string,
  newName: string
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const o = oldName.trim();
  const n = newName.trim();
  if (!o || !n) return { error: "分类名不能为空" };
  if (o === n) return { error: "新名字和原来一样" };
  const manageableErr = await assertLibraryManageable(supabase, user.id, libraryId);
  if (manageableErr) return { error: manageableErr };
  // “未分类”桶包含 category = '未分类' 或空值的行
  const match = o === "未分类" ? ["未分类", ""] : [o];
  const { error } = await supabase
    .from("products")
    .update({ category: n })
    .eq("library_id", libraryId)
    .eq("user_id", user.id)
    .in("category", match);
  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath("/products/new");
  return {};
}

/**
 * 分类删除：该分类下所有产品变为“未分类”，不删产品。
 * “未分类”本身不可删除（它就是“没有分类”的意思）。
 */
export async function deleteCategory(
  libraryId: string,
  name: string
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const n = name.trim();
  if (!n) return { error: "分类名不能为空" };
  if (n === "未分类") return { error: "“未分类”不可删除，它表示没有分类" };
  const manageableErr = await assertLibraryManageable(supabase, user.id, libraryId);
  if (manageableErr) return { error: manageableErr };
  const { error } = await supabase
    .from("products")
    .update({ category: "未分类" })
    .eq("library_id", libraryId)
    .eq("user_id", user.id)
    .eq("category", n);
  if (error) return { error: error.message };
  revalidatePath("/products");
  revalidatePath("/products/new");
  return {};
}

/**
 * 标签改名：批量改所有含该标签的产品的 specs，把 key 为“标签”且 value 为旧值的行
 * 改成新值（同一产品多行同值全改）。改成已存在的名字即合并。
 * 只动这些行，其他规格不动；更新时间由数据库触发器正常盖。
 */
export async function renameTag(
  libraryId: string,
  oldName: string,
  newName: string
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const o = oldName;
  const n = newName.trim();
  if (!o || !n) return { error: "标签名不能为空" };
  if (o === n) return { error: "新名字和原来一样" };
  const manageableErr = await assertLibraryManageable(supabase, user.id, libraryId);
  if (manageableErr) return { error: manageableErr };
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, specs")
      .eq("library_id", libraryId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { error: error.message };
    for (const r of data || []) {
      const specs = (r as { specs?: SpecItem[] | null }).specs || [];
      if (!specs.some((s) => s && s.key === "标签" && s.value === o)) continue;
      const renamed = specs.map((s) =>
        s && s.key === "标签" && s.value === o ? { ...s, value: n } : s
      );
      // 合并去重：该产品若原本已有目标标签，改名后只保留一行，不留重复
      let kept = false;
      const next = renamed.filter((s) => {
        if (s && s.key === "标签" && s.value === n) {
          if (kept) return false;
          kept = true;
        }
        return true;
      });
      const { error: upErr } = await supabase
        .from("products")
        .update({ specs: next })
        .eq("id", (r as { id: string }).id)
        .eq("user_id", user.id);
      if (upErr) return { error: upErr.message };
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  revalidatePath("/products");
  revalidatePath("/products/new");
  return {};
}

/**
 * 标签删除：删掉所有含该标签的产品的“标签”行，只删这一行 spec，
 * 不动其他规格，不删产品。更新时间由数据库触发器正常盖。
 */
export async function deleteTag(
  libraryId: string,
  name: string
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const n = name;
  if (!n) return { error: "标签名不能为空" };
  const manageableErr = await assertLibraryManageable(supabase, user.id, libraryId);
  if (manageableErr) return { error: manageableErr };
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, specs")
      .eq("library_id", libraryId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { error: error.message };
    for (const r of data || []) {
      const specs = (r as { specs?: SpecItem[] | null }).specs || [];
      if (!specs.some((s) => s && s.key === "标签" && s.value === n)) continue;
      const next = specs.filter((s) => !(s && s.key === "标签" && s.value === n));
      const { error: upErr } = await supabase
        .from("products")
        .update({ specs: next })
        .eq("id", (r as { id: string }).id)
        .eq("user_id", user.id);
      if (upErr) return { error: upErr.message };
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  revalidatePath("/products");
  revalidatePath("/products/new");
  return {};
}
