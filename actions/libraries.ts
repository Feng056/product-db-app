"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Library } from "@/lib/types";

type ActionResult = { error?: string };

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
