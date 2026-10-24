import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary, getPublishedLibraries } from "@/actions/libraries";
import { getCoCreatePendingCounts } from "@/actions/co-create";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import CreateLibraryForm from "@/components/CreateLibraryForm";
import LibraryManageList from "@/components/LibraryManageList";
import SubscribePlaza from "@/components/SubscribePlaza";

/** 仓库页：订阅广场 + 仓库管理 */
export default async function WarehousePage() {
  const { user, profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();

  const supabase = await createClient();

  // 并行：各库产品数 / 各库订阅者数 / 我订阅的副本 / 订阅广场 / 共同创作待审核数
  const [countsRes, subsRes, mySubsRes, publishedLibs, coCreateCounts] = await Promise.all([
    supabase
      .from("products")
      .select("library_id")
      .eq("user_id", user!.id)
      .in("library_id", libraries.map((l) => l.id)),
    supabase
      .from("library_subscriptions")
      .select("library_id")
      .in("library_id", libraries.map((l) => l.id)),
    supabase
      .from("library_subscriptions")
      .select("copy_library_id")
      .eq("subscriber_id", user!.id),
    getPublishedLibraries(),
    getCoCreatePendingCounts(),
  ]);
  const counts: Record<string, number> = {};
  for (const p of countsRes.data || []) {
    const id = (p as { library_id: string }).library_id;
    counts[id] = (counts[id] || 0) + 1;
  }

  const subCounts: Record<string, number> = {};
  for (const s of subsRes.data || []) {
    const id = (s as { library_id: string }).library_id;
    subCounts[id] = (subCounts[id] || 0) + 1;
  }

  const subCopyIds = new Set((mySubsRes.data || []).map((s) => s.copy_library_id));

  return (
    <>
      <main className="page-container">
        <h1 className="text-xl font-bold">仓库</h1>

        {/* 订阅广场 */}
        <div className="mt-4">
          <SubscribePlaza libs={publishedLibs} />
        </div>

        {/* 新建仓库 */}
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            新建仓库
          </h2>
          <CreateLibraryForm />
        </section>

        {/* 管理仓库 */}
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            管理仓库
          </h2>
          <LibraryManageList
            libraries={libraries}
            counts={counts}
            subCounts={subCounts}
            subCopyIds={subCopyIds}
            coCreateCounts={coCreateCounts}
          />
        </section>
      </main>
      <BottomNav isAdmin={profile?.is_admin} />
    </>
  );
}
