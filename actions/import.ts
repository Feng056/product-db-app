"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ImportRow } from "@/lib/types";

export type ImportResult = {
  imported: number;
  skipped: number;
  skippedNames: string[];
  error?: string;
};

/**
 * 批量导入产品。跳过规则：同一用户同一产品库下「名称 + 型号」已存在的视为重复。
 * specs/images/docs 导入暂不支持（导入页仅处理文本字段）。
 */
export async function importProducts(
  rows: ImportRow[],
  libraryId?: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 如指定产品库，校验归属
  let libId: string | null = null;
  if (libraryId) {
    const { data: lib } = await supabase
      .from("libraries")
      .select("id")
      .eq("id", libraryId)
      .eq("user_id", user.id)
      .single();
    if (!lib) {
      return { imported: 0, skipped: 0, skippedNames: [], error: "所选产品库无效" };
    }
    libId = lib.id;
  }

  const clean = rows
    .map((r) => ({
      name: String(r.name || "").trim(),
      model: String(r.model || "").trim(),
      category: String(r.category || "").trim() || "未分类",
      price:
        r.price === null || r.price === undefined || Number.isNaN(Number(r.price))
          ? null
          : Number(r.price),
      specs: Array.isArray(r.specs) ? r.specs : [],
      notes: String(r.notes || ""),
    }))
    .filter((r) => r.name);

  if (clean.length === 0) {
    return { imported: 0, skipped: 0, skippedNames: [], error: "没有可导入的有效数据" };
  }

  // 查出该用户该库已有的 名称+型号 组合（未指定库时按用户全局去重）
  let existingQuery = supabase
    .from("products")
    .select("name, model")
    .eq("user_id", user.id);
  if (libId) existingQuery = existingQuery.eq("library_id", libId);
  const { data: existing } = await existingQuery;
  const seen = new Set(
    (existing || []).map((p) => `${p.name}|||${p.model || ""}`)
  );

  const toInsert: typeof clean = [];
  const skippedNames: string[] = [];
  for (const r of clean) {
    const key = `${r.name}|||${r.model}`;
    if (seen.has(key)) {
      skippedNames.push(`${r.name}${r.model ? `（${r.model}）` : ""}`);
      continue;
    }
    seen.add(key);
    toInsert.push(r);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products").insert(
      toInsert.map((r) => ({
        user_id: user.id,
        library_id: libId,
        name: r.name,
        model: r.model,
        category: r.category,
        price: r.price,
        specs: r.specs,
        notes: r.notes,
        images: [],
        docs: [],
      }))
    );
    if (error) {
      return {
        imported: 0,
        skipped: skippedNames.length,
        skippedNames,
        error: `导入失败：${error.message}`,
      };
    }
  }

  revalidatePath("/products");
  return {
    imported: toInsert.length,
    skipped: skippedNames.length,
    skippedNames: skippedNames.slice(0, 20),
  };
}
