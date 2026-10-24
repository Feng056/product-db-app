"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SpecItem } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { pushToAllSubscribers } from "@/actions/shares";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** 对比快照里的一行字段变化（给发布者看的中文名 + 新旧值） */
export type DiffFieldChange = { field: string; old: string; new: string };
export type DiffAdded = {
  copyId: string;
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: SpecItem[];
  notes: string;
  images: string[];
};
export type DiffRemoved = {
  sourceId: string;
  name: string;
  model: string;
  category: string;
  price: number | null;
};
export type DiffChanged = {
  sourceId: string;
  copyId: string;
  name: string;
  fields: DiffFieldChange[];
  newValues: {
    name: string;
    model: string;
    category: string;
    price: number | null;
    specs: SpecItem[];
    notes: string;
  };
  imagesChanged: boolean;
  images: string[];
  sourceImages: string[];
};
export type CoCreateDiff = {
  added: DiffAdded[];
  removed: DiffRemoved[];
  changed: DiffChanged[];
};

type ProductRow = {
  id: string;
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: SpecItem[];
  notes: string;
  images: string[];
  source_product_id?: string | null;
};

function normSpecs(specs: unknown): SpecItem[] {
  const arr = Array.isArray(specs) ? specs : [];
  return arr
    .filter((s) => s && (s.key || s.value))
    .map((s) => ({ key: String(s.key || ""), value: String(s.value || "") }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function specsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normSpecs(a)) === JSON.stringify(normSpecs(b));
}

/** 规格逐项对比：新增/删除/改值的 key 各列一行 */
function specFieldChanges(oldSpecs: unknown, newSpecs: unknown): DiffFieldChange[] {
  const oldMap = new Map(normSpecs(oldSpecs).map((s) => [s.key, s.value]));
  const newMap = new Map(normSpecs(newSpecs).map((s) => [s.key, s.value]));
  const out: DiffFieldChange[] = [];
  const keySet = new Set<string>();
  oldMap.forEach((_, k) => keySet.add(k));
  newMap.forEach((_, k) => keySet.add(k));
  const keys = Array.from(keySet).sort();
  for (const k of keys) {
    const o = oldMap.get(k);
    const n = newMap.get(k);
    if (o !== n) {
      out.push({ field: `规格·${k}`, old: o ?? "—", new: n ?? "—" });
    }
  }
  return out;
}

/**
 * 用 Storage list 的文件大小给图片做指纹：同一批图片数量相同且大小集合相同 → 视为未换图。
 * list 失败时返回 null（按有变化处理，宁可多重存也不丢改动）。
 */
async function buildImageSizeMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number> | null> {
  try {
    const map = new Map<string, number>();
    let offset = 0;
    const limit = 100;
    for (;;) {
      const { data, error } = await supabase.storage
        .from("product-images")
        .list(userId, { limit, offset });
      if (error || !data) return null;
      for (const f of data) {
        const size = (f.metadata as { size?: number } | null)?.size;
        map.set(`${userId}/${f.name}`, typeof size === "number" ? size : -1);
      }
      if (data.length < limit) break;
      offset += limit;
    }
    return map;
  } catch {
    return null;
  }
}

function imagesChanged(
  srcImages: string[],
  copyImages: string[],
  srcMap: Map<string, number> | null,
  copyMap: Map<string, number> | null
): boolean {
  if (srcImages.length !== copyImages.length) return true;
  if (!srcMap || !copyMap) return true; // 指纹拿不到时按有变化处理
  const a = srcImages.map((p) => srcMap.get(p)).sort((x, y) => (x ?? -1) - (y ?? -1));
  const b = copyImages.map((p) => copyMap.get(p)).sort((x, y) => (x ?? -1) - (y ?? -1));
  for (let i = 0; i < a.length; i++) {
    if (a[i] === undefined || a[i] === -1 || b[i] === undefined || b[i] === -1) return true;
    if (a[i] !== b[i]) return true;
  }
  return false;
}

/** 把副本图片重存一份到发布者名下（删除副本产品会删 Storage，绝不能让源库共用副本路径） */
async function reuploadImages(
  supabase: SupabaseClient,
  ownerId: string,
  paths: string[]
): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    try {
      const url = supabase.storage.from("product-images").getPublicUrl(p).data.publicUrl;
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const ext = p.split(".").pop()?.slice(0, 5) || "jpg";
      const newPath = `${ownerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(newPath, buf, { contentType: "image/jpeg", upsert: false });
      if (!error) out.push(newPath);
    } catch {
      /* 单张失败跳过 */
    }
  }
  return out;
}

/** 订阅副本的共同创作状态（给产品库页弹窗用） */
export async function getCopyCoCreateState(copyLibraryId: string): Promise<{
  isSub: boolean;
  status: "none" | "pending" | "approved" | "rejected";
  hasPendingSubmission: boolean;
}> {
  const { supabase, user } = await requireUser();
  const { data: sub } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .eq("copy_library_id", copyLibraryId)
    .eq("subscriber_id", user.id)
    .single();
  if (!sub) return { isSub: false, status: "none", hasPendingSubmission: false };
  const [ccRes, pendRes] = await Promise.all([
    supabase
      .from("library_co_creators")
      .select("status")
      .eq("source_library_id", sub.library_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("co_creation_submissions")
      .select("id")
      .eq("copy_library_id", copyLibraryId)
      .eq("status", "pending")
      .limit(1),
  ]);
  const status = (ccRes.data?.status as "pending" | "approved" | "rejected" | undefined) || "none";
  return {
    isSub: true,
    status,
    hasPendingSubmission: !!pendRes.data && pendRes.data.length > 0,
  };
}

/** 订阅者申请共同创作（被驳回后可重新申请） */
export async function applyCoCreate(
  copyLibraryId: string
): Promise<{ message?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: sub } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .eq("copy_library_id", copyLibraryId)
    .eq("subscriber_id", user.id)
    .single();
  if (!sub) return { error: "不是订阅的库" };
  const { data: srcLib } = await supabase
    .from("libraries")
    .select("publish_status")
    .eq("id", sub.library_id)
    .single();
  if (!srcLib || srcLib.publish_status !== "published") {
    return { error: "该库未发布，无法申请" };
  }
  const { data: existing } = await supabase
    .from("library_co_creators")
    .select("id, status")
    .eq("source_library_id", sub.library_id)
    .eq("user_id", user.id)
    .single();
  if (existing?.status === "approved") return { error: "已是共同创作者" };
  if (existing?.status === "pending") return { error: "申请审核中" };
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();
  const applicantName =
    (prof as { display_name?: string; username?: string } | null)?.display_name ||
    (prof as { username?: string } | null)?.username ||
    "未知";
  if (existing) {
    const { error } = await supabase
      .from("library_co_creators")
      .update({ status: "pending", applicant_name: applicantName, decided_at: null })
      .eq("id", existing.id);
    if (error) return { error: "申请失败" };
  } else {
    const { error } = await supabase.from("library_co_creators").insert({
      source_library_id: sub.library_id,
      user_id: user.id,
      applicant_name: applicantName,
      status: "pending",
    });
    if (error) return { error: "申请失败" };
  }
  revalidatePath("/warehouse");
  return { message: "申请已提交，等待发布者同意" };
}

/** 订阅者撤回待审核的提交（撤回后副本恢复可编辑） */
export async function withdrawCoCreateSubmission(
  copyLibraryId: string
): Promise<{ message?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: pend } = await supabase
    .from("co_creation_submissions")
    .select("id")
    .eq("copy_library_id", copyLibraryId)
    .eq("co_creator_id", user.id)
    .eq("status", "pending")
    .limit(1);
  if (!pend || pend.length === 0) return { error: "没有待审核的提交" };
  const { error } = await supabase
    .from("co_creation_submissions")
    .update({ status: "withdrawn", decided_at: new Date().toISOString() })
    .eq("id", pend[0].id);
  if (error) return { error: "撤回失败" };
  revalidatePath("/products");
  return { message: "已撤回，可继续修改" };
}

/**
 * 共同创作者提交修改：把副本与源库逐项对比并冻结成快照。
 * 匹配：优先 source_product_id（新副本自带），老副本按名称+型号匹配并回填。
 * 源库有、副本无的 → 删除；副本有、源库无的 → 新增；源产品被发布者删了的副本残留 → 忽略（不复活）。
 */
export async function submitCoCreateDiff(
  copyLibraryId: string
): Promise<{ added?: number; changed?: number; removed?: number; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: sub } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .eq("copy_library_id", copyLibraryId)
    .eq("subscriber_id", user.id)
    .single();
  if (!sub) return { error: "不是订阅的库" };
  const sourceId = sub.library_id;
  const { data: cc } = await supabase
    .from("library_co_creators")
    .select("status")
    .eq("source_library_id", sourceId)
    .eq("user_id", user.id)
    .single();
  if (!cc || cc.status !== "approved") return { error: "尚未获得共同创作权限" };
  const { data: pend } = await supabase
    .from("co_creation_submissions")
    .select("id")
    .eq("copy_library_id", copyLibraryId)
    .eq("status", "pending")
    .limit(1);
  if (pend && pend.length > 0) return { error: "已有待审核的提交" };
  const { data: srcLib } = await supabase
    .from("libraries")
    .select("publish_status, publish_categories, user_id")
    .eq("id", sourceId)
    .single();
  if (!srcLib || srcLib.publish_status !== "published") {
    return { error: "该库已下架，无法提交" };
  }
  const categories = (srcLib as { publish_categories?: string[] | null }).publish_categories || null;
  const publisherId = (srcLib as { user_id: string }).user_id;

  let srcQuery = supabase
    .from("products")
    .select("id, name, model, category, price, specs, notes, images")
    .eq("library_id", sourceId);
  if (categories && categories.length > 0) srcQuery = srcQuery.in("category", categories);
  const [{ data: srcProducts }, { data: copyProducts }] = await Promise.all([
    srcQuery,
    supabase
      .from("products")
      .select("id, name, model, category, price, specs, notes, images, source_product_id")
      .eq("library_id", copyLibraryId)
      .eq("user_id", user.id),
  ]);
  const srcList = (srcProducts || []) as ProductRow[];
  const copyList = (copyProducts || []) as ProductRow[];
  const srcById = new Map(srcList.map((p) => [p.id, p]));
  const matchedSrc = new Set<string>();
  const backfill: { copyId: string; sourceId: string }[] = [];
  const added: DiffAdded[] = [];
  const changed: DiffChanged[] = [];
  const removed: DiffRemoved[] = [];

  // 图片指纹（发布者目录 + 共同创作者目录）
  const [srcMap, copyMap] = await Promise.all([
    buildImageSizeMap(supabase, publisherId),
    buildImageSizeMap(supabase, user.id),
  ]);

  for (const cp of copyList) {
    let sp: ProductRow | undefined;
    if (cp.source_product_id) {
      sp = srcById.get(cp.source_product_id);
      if (!sp) continue; // 源产品已被发布者删除或移出发布分类，忽略，不复活
    } else {
      // 老副本：按名称+型号找第一个未匹配的源产品，并回填 linkage
      sp = srcList.find(
        (p) => !matchedSrc.has(p.id) && p.name === cp.name && p.model === cp.model
      );
      if (sp) backfill.push({ copyId: cp.id, sourceId: sp.id });
    }
    if (!sp) {
      added.push({
        copyId: cp.id,
        name: cp.name,
        model: cp.model,
        category: cp.category,
        price: cp.price,
        specs: normSpecs(cp.specs),
        notes: cp.notes,
        images: cp.images || [],
      });
      continue;
    }
    matchedSrc.add(sp.id);
    const fields: DiffFieldChange[] = [];
    if (sp.name !== cp.name) fields.push({ field: "名称", old: sp.name, new: cp.name });
    if (sp.model !== cp.model) fields.push({ field: "型号", old: sp.model, new: cp.model });
    if (sp.category !== cp.category) fields.push({ field: "分类", old: sp.category, new: cp.category });
    if (sp.price !== cp.price)
      fields.push({ field: "价格", old: formatPrice(sp.price), new: formatPrice(cp.price) });
    if (sp.notes !== cp.notes) fields.push({ field: "备注", old: sp.notes || "—", new: cp.notes || "—" });
    fields.push(...specFieldChanges(sp.specs, cp.specs));
    const imgChanged = imagesChanged(sp.images || [], cp.images || [], srcMap, copyMap);
    if (fields.length > 0 || imgChanged) {
      changed.push({
        sourceId: sp.id,
        copyId: cp.id,
        name: cp.name,
        fields,
        newValues: {
          name: cp.name,
          model: cp.model,
          category: cp.category,
          price: cp.price,
          specs: normSpecs(cp.specs),
          notes: cp.notes,
        },
        imagesChanged: imgChanged,
        images: cp.images || [],
        sourceImages: sp.images || [],
      });
    }
  }
  for (const sp of srcList) {
    if (!matchedSrc.has(sp.id)) {
      removed.push({
        sourceId: sp.id,
        name: sp.name,
        model: sp.model,
        category: sp.category,
        price: sp.price,
      });
    }
  }

  if (added.length === 0 && changed.length === 0 && removed.length === 0) {
    return { error: "没有可提交的修改" };
  }
  for (const b of backfill) {
    await supabase
      .from("products")
      .update({ source_product_id: b.sourceId })
      .eq("id", b.copyId)
      .eq("user_id", user.id);
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();
  const creatorName =
    (prof as { display_name?: string; username?: string } | null)?.display_name ||
    (prof as { username?: string } | null)?.username ||
    "未知";
  const { error } = await supabase.from("co_creation_submissions").insert({
    source_library_id: sourceId,
    copy_library_id: copyLibraryId,
    co_creator_id: user.id,
    co_creator_name: creatorName,
    status: "pending",
    diff: { added, removed, changed } as unknown as Record<string, unknown>,
  });
  if (error) return { error: "提交失败" };
  revalidatePath("/products");
  revalidatePath("/warehouse");
  return { added: added.length, changed: changed.length, removed: removed.length };
}

/** 发布者视角：某源库的共同创作申请 + 待审核提交（含对比快照） */
export async function getCoCreateOverview(sourceLibraryId: string): Promise<{
  creators: {
    id: string;
    user_id: string;
    applicant_name: string;
    status: string;
    created_at: string;
  }[];
  submissions: {
    id: string;
    co_creator_id: string;
    co_creator_name: string;
    created_at: string;
    diff: CoCreateDiff;
  }[];
  error?: string;
}> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", sourceLibraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { creators: [], submissions: [], error: "无权限" };
  const [{ data: creators }, { data: submissions }] = await Promise.all([
    supabase
      .from("library_co_creators")
      .select("id, user_id, applicant_name, status, created_at")
      .eq("source_library_id", sourceLibraryId)
      .order("created_at", { ascending: true }),
    supabase
      .from("co_creation_submissions")
      .select("id, co_creator_id, co_creator_name, created_at, diff")
      .eq("source_library_id", sourceLibraryId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);
  return {
    creators: (creators || []) as {
      id: string;
      user_id: string;
      applicant_name: string;
      status: string;
      created_at: string;
    }[],
    submissions: ((submissions || []) as {
      id: string;
      co_creator_id: string;
      co_creator_name: string;
      created_at: string;
      diff: CoCreateDiff;
    }[]).map((s) => ({ ...s, diff: (s.diff as CoCreateDiff) || { added: [], removed: [], changed: [] } })),
  };
}

/** 发布者视角：自己各源库的待审核数（仓库页角标用） */
export async function getCoCreatePendingCounts(): Promise<
  Record<string, { applications: number; submissions: number }>
> {
  const { supabase, user } = await requireUser();
  const { data: libs } = await supabase
    .from("libraries")
    .select("id")
    .eq("user_id", user.id);
  const ids = (libs || []).map((l) => l.id);
  if (ids.length === 0) return {};
  const [{ data: creators }, { data: submissions }] = await Promise.all([
    supabase
      .from("library_co_creators")
      .select("source_library_id")
      .in("source_library_id", ids)
      .eq("status", "pending"),
    supabase
      .from("co_creation_submissions")
      .select("source_library_id")
      .in("source_library_id", ids)
      .eq("status", "pending"),
  ]);
  const out: Record<string, { applications: number; submissions: number }> = {};
  for (const c of creators || []) {
    const id = (c as { source_library_id: string }).source_library_id;
    out[id] = out[id] || { applications: 0, submissions: 0 };
    out[id].applications++;
  }
  for (const s of submissions || []) {
    const id = (s as { source_library_id: string }).source_library_id;
    out[id] = out[id] || { applications: 0, submissions: 0 };
    out[id].submissions++;
  }
  return out;
}

/** 发布者审批共同创作申请 */
export async function decideCoCreator(
  sourceLibraryId: string,
  applicantId: string,
  approve: boolean
): Promise<{ message?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", sourceLibraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  const { error } = await supabase
    .from("library_co_creators")
    .update({ status: approve ? "approved" : "rejected", decided_at: new Date().toISOString() })
    .eq("source_library_id", sourceLibraryId)
    .eq("user_id", applicantId);
  if (error) return { error: "操作失败" };
  revalidatePath("/warehouse");
  return { message: approve ? "已同意共同创作" : "已驳回申请" };
}

/** 发布者移除共同创作者（其待审核提交一并驳回） */
export async function removeCoCreator(
  sourceLibraryId: string,
  applicantId: string
): Promise<{ message?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", sourceLibraryId)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  await supabase
    .from("library_co_creators")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("source_library_id", sourceLibraryId)
    .eq("user_id", applicantId);
  await supabase
    .from("co_creation_submissions")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("source_library_id", sourceLibraryId)
    .eq("co_creator_id", applicantId)
    .eq("status", "pending");
  revalidatePath("/warehouse");
  return { message: "已移除共同创作者" };
}

/**
 * 发布者审批修改提交：通过 → 按快照应用到源库（新增/改值/删除，图片重存），
 * 然后推送给所有订阅者；驳回 → 仅标记，副本恢复可编辑。
 * 通过前请仔细核对对比：源库有、副本无的会被当作删除。
 */
export async function decideSubmission(
  submissionId: string,
  approve: boolean
): Promise<{ message?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: s } = await supabase
    .from("co_creation_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();
  if (!s) return { error: "提交不存在" };
  const { data: lib } = await supabase
    .from("libraries")
    .select("id")
    .eq("id", s.source_library_id)
    .eq("user_id", user.id)
    .single();
  if (!lib) return { error: "无权限" };
  if (s.status !== "pending") return { error: "该提交已处理" };
  if (!approve) {
    await supabase
      .from("co_creation_submissions")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", submissionId);
    revalidatePath("/warehouse");
    return { message: "已驳回修改" };
  }
  const diff = (s.diff as CoCreateDiff) || { added: [], removed: [], changed: [] };
  for (const a of diff.added || []) {
    const images = await reuploadImages(supabase, user.id, a.images || []);
    await supabase.from("products").insert({
      user_id: user.id,
      library_id: s.source_library_id,
      name: a.name,
      model: a.model,
      category: a.category,
      price: a.price,
      specs: a.specs || [],
      notes: a.notes || "",
      images,
      docs: [],
    });
  }
  for (const c of diff.changed || []) {
    const update: Record<string, unknown> = { ...c.newValues };
    if (c.imagesChanged) {
      update.images = await reuploadImages(supabase, user.id, c.images || []);
    }
    await supabase
      .from("products")
      .update(update)
      .eq("id", c.sourceId)
      .eq("library_id", s.source_library_id);
  }
  for (const r of diff.removed || []) {
    // 仅删行，不删 Storage（与推送覆盖行为一致，避免误删）
    await supabase
      .from("products")
      .delete()
      .eq("id", r.sourceId)
      .eq("library_id", s.source_library_id);
  }
  await supabase
    .from("co_creation_submissions")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", submissionId);
  const pushed = await pushToAllSubscribers(supabase, s.source_library_id);
  revalidatePath("/warehouse");
  revalidatePath("/products");
  return { message: `已应用并推送给 ${pushed} 个订阅者` };
}
