"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ImportRow, SpecItem } from "@/lib/types";

export type ExistingProduct = {
  id: string;
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: SpecItem[];
  notes: string;
};

export type ImportCheckItem = {
  index: number;
  status: "new" | "same" | "different";
  existing: ExistingProduct | null;
};

export type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  importedIds: string[];
  updatedIds: string[];
  skippedNames: string[];
  error?: string;
};

type CleanRow = {
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: SpecItem[];
  notes: string;
};

async function requireUserAndLib(libraryId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let libId: string | null = null;
  if (libraryId) {
    const { data: lib } = await supabase
      .from("libraries")
      .select("id")
      .eq("id", libraryId)
      .eq("user_id", user.id)
      .single();
    if (!lib) throw new Error("所选产品库无效");
    libId = lib.id;
  }
  return { supabase, user, libId };
}

function cleanRows(rows: ImportRow[]): (CleanRow & { index: number })[] {
  return rows
    .map((r, index) => ({
      index,
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
}

function specsEqual(a: SpecItem[], b: SpecItem[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (s: SpecItem) => `${s.key}|||${s.value}`;
  const sa = a.map(norm).sort().join(";;");
  const sb = b.map(norm).sort().join(";;");
  return sa === sb;
}

function isSame(a: CleanRow, b: ExistingProduct): boolean {
  return (
    a.model === b.model &&
    a.category === b.category &&
    (a.price ?? null) === (b.price ?? null) &&
    a.notes === b.notes &&
    specsEqual(a.specs, b.specs)
  );
}

/**
 * 导入前检查：逐行判断是新增 / 完全相同 / 有差异（返回已有数据供对比）
 */
export async function checkImport(
  rows: ImportRow[],
  libraryId?: string
): Promise<{ items: ImportCheckItem[]; error?: string }> {
  try {
    const { supabase, user, libId } = await requireUserAndLib(libraryId);
    const clean = cleanRows(rows);
    if (clean.length === 0) return { items: [], error: "没有可导入的有效数据" };

    let q = supabase
      .from("products")
      .select("id, name, model, category, price, specs, notes")
      .eq("user_id", user.id);
    if (libId) q = q.eq("library_id", libId);
    const { data: existing } = await q;

    const map = new Map<string, ExistingProduct>();
    for (const p of existing || []) {
      const e: ExistingProduct = {
        id: p.id,
        name: p.name,
        model: p.model || "",
        category: p.category || "",
        price: p.price ?? null,
        specs: Array.isArray(p.specs) ? p.specs : [],
        notes: p.notes || "",
      };
      map.set(`${p.name}|||${p.model || ""}`, e);
    }

    const items: ImportCheckItem[] = clean.map((r) => {
      const ex = map.get(`${r.name}|||${r.model}`) || null;
      if (!ex) return { index: r.index, status: "new" as const, existing: null };
      return {
        index: r.index,
        status: isSame(r, ex) ? ("same" as const) : ("different" as const),
        existing: ex,
      };
    });
    return { items };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "检查失败" };
  }
}

/**
 * 执行导入：新增 + 按选择覆盖重复项（覆盖前自动备份到 product_history）
 * overwriteIndices: 需要覆盖的 row.index 列表
 */
export async function importProducts(
  rows: ImportRow[],
  libraryId?: string,
  overwriteIndices: number[] = []
): Promise<ImportResult> {
  const empty = {
    imported: 0,
    updated: 0,
    skipped: 0,
    importedIds: [],
    updatedIds: [],
    skippedNames: [],
  };
  try {
    const { supabase, user, libId } = await requireUserAndLib(libraryId);
    const clean = cleanRows(rows);
    if (clean.length === 0) return { ...empty, error: "没有可导入的有效数据" };

    let q = supabase
      .from("products")
      .select("id, name, model, category, price, specs, notes")
      .eq("user_id", user.id);
    if (libId) q = q.eq("library_id", libId);
    const { data: existing } = await q;
    const map = new Map<string, ExistingProduct>();
    for (const p of existing || []) {
      map.set(`${p.name}|||${p.model || ""}`, {
        id: p.id,
        name: p.name,
        model: p.model || "",
        category: p.category || "",
        price: p.price ?? null,
        specs: Array.isArray(p.specs) ? p.specs : [],
        notes: p.notes || "",
      });
    }

    const overwriteSet = new Set(overwriteIndices);
    const toInsert: CleanRow[] = [];
    const toUpdate: { row: CleanRow; existing: ExistingProduct }[] = [];
    const skippedNames: string[] = [];
    const seenInFile = new Set<string>();

    for (const r of clean) {
      const key = `${r.name}|||${r.model}`;
      // 文件内部重复：只保留第一行
      if (seenInFile.has(key)) {
        skippedNames.push(`${r.name}${r.model ? `（${r.model}）` : ""}（文件内重复）`);
        continue;
      }
      seenInFile.add(key);

      const ex = map.get(key);
      if (!ex) {
        toInsert.push(r);
        continue;
      }
      if (isSame(r, ex)) {
        skippedNames.push(`${r.name}${r.model ? `（${r.model}）` : ""}（无变化）`);
        continue;
      }
      if (overwriteSet.has(r.index)) {
        toUpdate.push({ row: r, existing: ex });
      } else {
        skippedNames.push(`${r.name}${r.model ? `（${r.model}）` : ""}`);
      }
    }

    const importedIds: string[] = [];
    const updatedIds: string[] = [];

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .insert(
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
        )
        .select("id");
      if (error) return { ...empty, error: `导入失败：${error.message}` };
      importedIds.push(...(data || []).map((d) => d.id));
    }

    for (const { row, existing: ex } of toUpdate) {
      // 备份旧数据
      const { error: hErr } = await supabase.from("product_history").insert({
        product_id: ex.id,
        user_id: user.id,
        data: {
          name: ex.name,
          model: ex.model,
          category: ex.category,
          price: ex.price,
          specs: ex.specs,
          notes: ex.notes,
        },
        reason: "import",
      });
      if (hErr) return { ...empty, error: `备份失败：${hErr.message}` };

      const { error: uErr } = await supabase
        .from("products")
        .update({
          category: row.category,
          price: row.price,
          specs: row.specs,
          notes: row.notes,
        })
        .eq("id", ex.id)
        .eq("user_id", user.id);
      if (uErr) return { ...empty, error: `更新失败：${uErr.message}` };
      updatedIds.push(ex.id);
    }

    revalidatePath("/products");
    return {
      imported: importedIds.length,
      updated: updatedIds.length,
      skipped: skippedNames.length,
      importedIds,
      updatedIds,
      skippedNames: skippedNames.slice(0, 20),
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "导入失败" };
  }
}

/**
 * 回退本次导入：删除新增的，恢复被覆盖的（从 product_history 取最近一次备份）
 */
export async function rollbackImport(
  importedIds: string[],
  updatedIds: string[],
  libraryId?: string
): Promise<{ restored: number; deleted: number; error?: string }> {
  try {
    const { supabase, user, libId } = await requireUserAndLib(libraryId);

    let deleted = 0;
    if (importedIds.length > 0) {
      let dq = supabase.from("products").delete().eq("user_id", user.id).in("id", importedIds);
      if (libId) dq = dq.eq("library_id", libId);
      const { error, count } = await dq;
      if (error) return { restored: 0, deleted: 0, error: `回退删除失败：${error.message}` };
      deleted = count ?? importedIds.length;
    }

    let restored = 0;
    for (const pid of updatedIds) {
      // 取该产品最近一次 import 备份
      const { data: hist } = await supabase
        .from("product_history")
        .select("data")
        .eq("product_id", pid)
        .eq("user_id", user.id)
        .eq("reason", "import")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (!hist?.data) continue;
      const d = hist.data as {
        name: string;
        model: string;
        category: string;
        price: number | null;
        specs: SpecItem[];
        notes: string;
      };
      let uq = supabase
        .from("products")
        .update({
          category: d.category,
          price: d.price,
          specs: d.specs,
          notes: d.notes,
        })
        .eq("id", pid)
        .eq("user_id", user.id);
      if (libId) uq = uq.eq("library_id", libId);
      const { error } = await uq;
      if (error) return { restored, deleted, error: `回退恢复失败：${error.message}` };
      restored++;
    }

    revalidatePath("/products");
    return { restored, deleted };
  } catch (e) {
    return { restored: 0, deleted: 0, error: e instanceof Error ? e.message : "回退失败" };
  }
}
