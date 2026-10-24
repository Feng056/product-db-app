import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 按用户自定义顺序排列产品库：library_order 数组里的 id 按顺序排前面，
 * 未列出的库保持原顺序排后面。order 为空时返回原顺序。
 */
export function sortLibrariesByOrder<T extends { id: string }>(
  list: T[],
  order: string[] | null | undefined
): T[] {
  if (!order || order.length === 0) return list;
  const rank = new Map(order.map((id, i) => [id, i]));
  const max = Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : max;
    const rb = rank.has(b.id) ? rank.get(b.id)! : max;
    return ra - rb;
  });
}

/**
 * 把新库 id 插到用户显示顺序最前面（订阅后返回首页默认就是该库）。
 * 列不存在或更新失败时静默忽略，不阻塞订阅主流程。
 */
export async function prependLibraryOrder(
  supabase: SupabaseClient,
  userId: string,
  newIds: string[]
): Promise<void> {
  if (newIds.length === 0) return;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("library_order")
      .eq("id", userId)
      .maybeSingle();
    const old = (data?.library_order as string[] | null) || [];
    const next = [
      ...newIds.filter((id) => !old.includes(id)),
      ...old.filter((id) => !newIds.includes(id)),
    ];
    await supabase.from("profiles").update({ library_order: next }).eq("id", userId);
  } catch {
    /* 忽略，顺序缺失时按创建时间排序兜底 */
  }
}
