import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import ImportClient from "@/components/ImportClient";
import ExportPanel from "@/components/ExportPanel";

/** 导入导出页：导入（上传文件预览导入）+ 导出（多选库、选格式） */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: { lib?: string; tab?: string };
}) {
  const { profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const tab = searchParams.tab === "export" ? "export" : "import";
  const libParam = lib ? `&lib=${lib}` : "";

  return (
    <>
      <main className="page-container">
        <h1 className="text-xl font-bold">导入 / 导出</h1>

        {/* 选项卡 */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <a
            href={`/import?tab=import${libParam}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              tab === "import" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
            }`}
          >
            📥 导入
          </a>
          <a
            href={`/import?tab=export${libParam}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              tab === "export" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
            }`}
          >
            📤 导出
          </a>
        </div>

        <div className="mt-4">
          {tab === "import" ? (
            <ImportClient libraryId={lib || undefined} />
          ) : (
            <ExportPanel libraries={libraries} defaultSelectedId={lib || undefined} />
          )}
        </div>
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={lib || undefined} />
    </>
  );
}
