import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ImportClient from "@/components/ImportClient";
import ExportPanel from "@/components/ExportPanel";
import SubscribePlaza from "@/components/SubscribePlaza";

/** 导入导出页：导入（上传文件预览导入）+ 导出（多选库、选格式） */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: { lib?: string; tab?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const tab = searchParams.tab === "export" ? "export" : "import";
  const libParam = lib ? `&lib=${lib}` : "";

  // 订阅副本不可导出：从导出列表中剔除
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", user!.id);
  const subCopyIds = new Set((subs || []).map((s) => s.copy_library_id));
  const exportableLibraries = libraries.filter((l) => !subCopyIds.has(l.id));

  // 订阅广场：已发布的公共库
  const { getPublishedLibraries } = await import("@/actions/libraries");
  const publishedLibs = await getPublishedLibraries();

  return (
    <>
      <main className="page-container">
        <h1 className="text-xl font-bold">导入 / 导出</h1>

        {/* 选项卡 */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
          <a
            href={`/import?tab=import${libParam}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              tab === "import" ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            📥 导入
          </a>
          <a
            href={`/import?tab=export${libParam}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              tab === "export" ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            📤 导出
          </a>
        </div>

        <div className="mt-4">
          {tab === "import" ? (
            <>
              <SubscribePlaza libs={publishedLibs} />
              <ImportClient libraryId={lib || undefined} />
            </>
          ) : (
            <ExportPanel libraries={exportableLibraries} defaultSelectedId={lib || undefined} />
          )}
        </div>
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={lib || undefined} />
    </>
  );
}
