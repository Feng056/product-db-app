import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 用户订阅后，其自建的空库默认不在首页显示（用户可在库管理里再打开）。
 * 尽力而为：字段未就绪或查询失败时不阻塞订阅流程。
 */
export async function hideEmptyOwnLibraries(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { data: libs } = await supabase
      .from("libraries")
      .select("id")
      .eq("user_id", userId);
    if (!libs || libs.length === 0) return;
    const { data: subs } = await supabase
      .from("library_subscriptions")
      .select("copy_library_id")
      .eq("subscriber_id", userId);
    const copyIds = new Set((subs || []).map((s) => s.copy_library_id));
    for (const lib of libs) {
      if (copyIds.has(lib.id)) continue;
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("library_id", lib.id);
      if (count === 0) {
        await supabase
          .from("libraries")
          .update({ show_on_home: false })
          .eq("id", lib.id);
      }
    }
  } catch {
    /* 忽略：不阻塞订阅 */
  }
}
