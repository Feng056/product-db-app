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
    .select("id, images, docs")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "产品不存在或无权限" };

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
    .select("id, images, docs")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "产品不存在或无权限" };

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

  const { data, error } = await supabase
    .from("products")
    .select("name, model, category, price, specs, notes, images, docs")
    .eq("user_id", user.id)
    .eq("library_id", libraryId)
    .order("updated_at", { ascending: false });
  if (error) return { error: error.message };
  return { data: (data || []) as LibraryExportData[] };
}
