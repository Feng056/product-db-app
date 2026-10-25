import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 从源库复制产品到目标库（含图片重存）。
 * onProgress 在每复制完一个产品后回调（开始时先回调一次 (0, total)），供订阅进度条使用。
 * 注意：本函数不带 "use server"，供 Server Action 和 Route Handler 共用。
 */
export async function copyProductsToLibrary(
  supabase: SupabaseClient,
  sourceLibraryId: string,
  targetLibraryId: string,
  targetUserId: string,
  categories?: string[] | null,
  onProgress?: (copied: number, total: number) => void
): Promise<number> {
  // 读源库产品（分享者已通过 get_library_share 授权，或主人自己）
  // categories 非空时只复制这些分类的产品
  let query = supabase
    .from("products")
    .select("id, name, model, category, price, specs, notes, images")
    .eq("library_id", sourceLibraryId);
  if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }
  const { data: products } = await query;
  const total = (products || []).length;
  onProgress?.(0, total);
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
      source_product_id: (p as { id?: string }).id || null,
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
    onProgress?.(copied, total);
  }
  return copied;
}

type SyncProductRow = {
  id: string;
  user_id?: string;
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: unknown;
  notes: string;
  images: string[];
  source_product_id?: string | null;
};

function normSyncSpecs(specs: unknown): { key: string; value: string }[] {
  const arr = Array.isArray(specs) ? specs : [];
  return arr
    .filter((s) => s && (s.key || s.value))
    .map((s) => ({ key: String(s.key || ""), value: String(s.value || "") }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function syncSpecsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normSyncSpecs(a)) === JSON.stringify(normSyncSpecs(b));
}

/**
 * 用 Storage list 的文件大小给图片做指纹：同一批图片数量相同且大小集合相同 → 视为未换图。
 * list 失败时返回 null（按有变化处理，宁可多重存也不丢改动）。与共同创作的对比逻辑一致。
 */
async function buildSyncImageSizeMap(
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

function syncImagesChanged(
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

/** 把源图重存一份到副本主人名下（与全量复制同一做法） */
async function reuploadSyncImages(
  supabase: SupabaseClient,
  ownerId: string,
  paths: string[]
): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    try {
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(p);
      const res = await fetch(pub.publicUrl);
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

/**
 * 增量同步：源库为准，只同步改动的部分，没改动的不动。
 * 新增的插入、源库删了的删行（只删行）、字段改了的只更新改了的列——只改价格就只改价格，
 * 图片没变不重传，图片变了才重传。返回受影响的产品数（新增 + 删除 + 更新），0 表示已一致。
 * 首次订阅仍走全量复制（copyProductsToLibrary），这里只用于刷新/推送。
 */
export async function syncProductsToLibrary(
  supabase: SupabaseClient,
  sourceLibraryId: string,
  targetLibraryId: string,
  targetUserId: string,
  categories?: string[] | null
): Promise<number> {
  let srcQuery = supabase
    .from("products")
    .select("id, user_id, name, model, category, price, specs, notes, images")
    .eq("library_id", sourceLibraryId);
  if (categories && categories.length > 0) {
    srcQuery = srcQuery.in("category", categories);
  }
  const [{ data: srcProducts }, { data: copyProducts }] = await Promise.all([
    srcQuery,
    supabase
      .from("products")
      .select("id, name, model, category, price, specs, notes, images, source_product_id")
      .eq("library_id", targetLibraryId)
      .eq("user_id", targetUserId),
  ]);
  const srcList = (srcProducts || []) as SyncProductRow[];
  const copyList = (copyProducts || []) as SyncProductRow[];
  const srcById = new Map(srcList.map((p) => [p.id, p]));
  const matchedSrc = new Set<string>();
  const publisherId = srcList.length > 0 ? (srcList[0].user_id as string | undefined) : undefined;

  const [srcMap, copyMap] = await Promise.all([
    publisherId ? buildSyncImageSizeMap(supabase, publisherId) : Promise.resolve(null),
    buildSyncImageSizeMap(supabase, targetUserId),
  ]);

  let affected = 0;

  for (const cp of copyList) {
    let sp: SyncProductRow | undefined;
    if (cp.source_product_id) {
      sp = srcById.get(cp.source_product_id);
      if (!sp) {
        // 源产品已被删或移出发布分类 → 删掉副本行（只删行，不清 Storage，与旧全量同步一致）
        await supabase.from("products").delete().eq("id", cp.id).eq("user_id", targetUserId);
        affected++;
        continue;
      }
    } else {
      // 老副本：按名称+型号找第一个未匹配的源产品
      sp = srcList.find((p) => !matchedSrc.has(p.id) && p.name === cp.name && p.model === cp.model);
    }
    if (!sp) {
      // 副本独有的行：同步以源库为准，删掉
      await supabase.from("products").delete().eq("id", cp.id).eq("user_id", targetUserId);
      affected++;
      continue;
    }
    if (matchedSrc.has(sp.id)) {
      // 同一源产品在副本里出现多次（旧全量同步重复插入导致）→ 删掉多余的重复行
      await supabase.from("products").delete().eq("id", cp.id).eq("user_id", targetUserId);
      affected++;
      continue;
    }
    matchedSrc.add(sp.id);
    const patch: {
      name?: string;
      model?: string;
      category?: string;
      price?: number | null;
      notes?: string;
      specs?: { key: string; value: string }[];
      images?: string[];
      source_product_id?: string;
    } = {};
    if (sp.name !== cp.name) patch.name = sp.name;
    if (sp.model !== cp.model) patch.model = sp.model;
    if (sp.category !== cp.category) patch.category = sp.category;
    if (sp.price !== cp.price) patch.price = sp.price;
    if (sp.notes !== cp.notes) patch.notes = sp.notes;
    if (!syncSpecsEqual(sp.specs, cp.specs)) patch.specs = normSyncSpecs(sp.specs);
    if (syncImagesChanged(sp.images || [], cp.images || [], srcMap, copyMap)) {
      const newImages = await reuploadSyncImages(supabase, targetUserId, sp.images || []);
      // 源图全部重传失败时保留副本旧图，不覆盖成空
      if ((sp.images || []).length === 0 || newImages.length > 0) {
        patch.images = newImages;
      }
    }
    // 老副本回填 linkage
    if (!cp.source_product_id) patch.source_product_id = sp.id;
    if (Object.keys(patch).length > 0) {
      await supabase.from("products").update(patch).eq("id", cp.id).eq("user_id", targetUserId);
      affected++;
    }
  }

  for (const sp of srcList) {
    if (matchedSrc.has(sp.id)) continue;
    const newImages = await reuploadSyncImages(supabase, targetUserId, sp.images || []);
    const { error } = await supabase.from("products").insert({
      user_id: targetUserId,
      library_id: targetLibraryId,
      source_product_id: sp.id,
      name: String(sp.name || "未命名产品"),
      model: String(sp.model || ""),
      category: String(sp.category || "") || "未分类",
      price: sp.price ?? null,
      specs: normSyncSpecs(sp.specs),
      notes: String(sp.notes || ""),
      images: newImages,
      docs: [],
    });
    if (!error) affected++;
  }

  return affected;
}
