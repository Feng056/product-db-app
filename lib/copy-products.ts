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
