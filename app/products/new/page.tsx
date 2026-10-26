import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct, getCategoryTagStats } from "@/actions/products";
import { ensureDefaultLibrary } from "@/actions/libraries";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";
import ImportClient from "@/components/ImportClient";
import ExportPanel from "@/components/ExportPanel";
import CategoryTagManager from "@/components/CategoryTagManager";

/** 分类标签管理区：服务端取统计，交互交给客户端组件 */
async function TagsSectionBody({ libraryId }: { libraryId: string }) {
  const stats = await getCategoryTagStats(libraryId);
  if (stats.error) {
    return (
      <p className="rounded-2xl bg-white p-4 text-sm text-red-500 dark:bg-gray-900">
        {stats.error}
      </p>
    );
  }
  if (stats.categories.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-4 text-sm text-gray-400 dark:bg-gray-900">
        这个库还没有产品，先去新增。
      </p>
    );
  }
  return (
    <CategoryTagManager
      libraryId={libraryId}
      categories={stats.categories}
      tags={stats.tags}
    />
  );
}

/** 管理页：新增 / 导入导出 两个模块 */
export default async function ManagePage({
  searchParams,
}: {
  searchParams: { lib?: string; section?: string; sub?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const section =
    searchParams.section === "io"
      ? "io"
      : searchParams.section === "tags"
        ? "tags"
        : "add";
  const ioTab = searchParams.sub === "export" ? "export" : "import";

  const currentLib = libraries.find((l) => l.id === lib) || libraries[0];
  const libId = currentLib?.id || "";
  const libParam = libId ? `lib=${libId}` : "";
  const secHref = (s: string, subTab?: string) => {
    const p = [`section=${s}`];
    if (libParam) p.push(libParam);
    if (subTab) p.push(`sub=${subTab}`);
    return `/products/new?${p.join("&")}`;
  };

  const supabase = await createClient();

  // 我订阅的副本库 id（导出时剔除）+ 可写判断（自建库可写；订阅副本仅已批准且无待审核提交的共同创作者可写）
  const { data: mySubs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id, library_id")
    .eq("subscriber_id", user!.id);
  const subCopyIds = new Set((mySubs || []).map((s) => s.copy_library_id));
  const sourceByCopy = new Map(
    (mySubs || []).map((s) => [s.copy_library_id as string, s.library_id as string])
  );
  const { data: ccRows } = await supabase
    .from("library_co_creators")
    .select("source_library_id")
    .eq("user_id", user!.id)
    .eq("status", "approved");
  const approvedSources = new Set((ccRows || []).map((r) => r.source_library_id));
  const { data: pendRows } = await supabase
    .from("co_creation_submissions")
    .select("copy_library_id")
    .eq("co_creator_id", user!.id)
    .eq("status", "pending");
  const pendingCopies = new Set((pendRows || []).map((r) => r.copy_library_id));
  const isWritable = (id: string) => {
    if (!subCopyIds.has(id)) return true;
    const src = sourceByCopy.get(id);
    return !!src && approvedSources.has(src) && !pendingCopies.has(id);
  };
  const exportableLibraries = libraries.filter((l) => !subCopyIds.has(l.id));
  // 分类标签管理只列自建库：订阅副本一律不列出、不可管理
  const ownLibraries = libraries.filter((l) => !subCopyIds.has(l.id));
  const tagsLib = ownLibraries.find((l) => l.id === lib) || ownLibraries[0];

  return (
    <>
      <main className="page-container">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href={libId ? `/products?lib=${libId}` : "/products"}
            className="text-xl text-gray-500 dark:text-gray-400 "
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold">管理</h1>
        </div>

        {/* 顶级三选项 */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
          <Link
            href={secHref("add")}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              section === "add"
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            ➕ 新增
          </Link>
          <Link
            href={secHref("io", ioTab)}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              section === "io"
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            📥 导入导出
          </Link>
          <Link
            href={
              tagsLib
                ? `/products/new?section=tags&lib=${tagsLib.id}`
                : "/products/new?section=tags"
            }
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              section === "tags"
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            🏷️ 分类标签
          </Link>
        </div>

        {/* 新增 */}
        {section === "add" && (
          <div className="mt-4">
            {/* 新增目标库：之前只藏在网址参数里，页面上看不出来新增到哪里 */}
            <div className="mb-4 rounded-2xl bg-white dark:bg-gray-900 p-3">
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                新增到：
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {currentLib?.name || "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {libraries.map((l) => {
                  if (!isWritable(l.id)) {
                    return (
                      <span
                        key={l.id}
                        className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-400 dark:bg-gray-800"
                      >
                        📡 {l.name} · 只读
                      </span>
                    );
                  }
                  const active = l.id === libId;
                  return (
                    <Link
                      key={l.id}
                      href={`/products/new?section=add&lib=${l.id}`}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {subCopyIds.has(l.id) ? `📡 ${l.name}` : l.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            {profile?.is_admin && (
              <Link
                href={libId ? `/products/new/recognize?lib=${libId}` : "/products/new/recognize"}
                className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-green-50 dark:bg-green-950 py-3 text-sm font-semibold text-green-700 dark:text-green-300"
              >
                📷 拍照识别（批量）
              </Link>
            )}
            <Link
              href={libId ? `/products/batch-price?lib=${libId}` : "/products/batch-price"}
              className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-blue-50 dark:bg-blue-950 py-3 text-sm font-semibold text-blue-700 dark:text-blue-300"
            >
              💰 批量改价
            </Link>
            <ProductForm action={createProduct} libraryId={libId || undefined} />
          </div>
        )}

        {/* 导入导出 */}
        {section === "io" && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
              <Link
                href={secHref("io", "import")}
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  ioTab === "import"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                📥 导入
              </Link>
              <Link
                href={secHref("io", "export")}
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  ioTab === "export"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                📤 导出
              </Link>
            </div>
            <div className="mt-4">
              {ioTab === "import" ? (
                <ImportClient libraryId={lib || undefined} />
              ) : (
                <ExportPanel libraries={exportableLibraries} defaultSelectedId={lib || undefined} />
              )}
            </div>
          </>
        )}

        {/* 分类标签管理 */}
        {section === "tags" && (
          <div className="mt-4">
            <div className="mb-4 rounded-2xl bg-white p-3 dark:bg-gray-900">
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                管理库：
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {tagsLib?.name || "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ownLibraries.map((l) => {
                  const active = l.id === tagsLib?.id;
                  return (
                    <Link
                      key={l.id}
                      href={`/products/new?section=tags&lib=${l.id}`}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {l.name}
                    </Link>
                  );
                })}
              </div>
              {ownLibraries.length === 0 && (
                <p className="mt-2 text-sm text-gray-400">
                  还没有自建库，去
                  <Link href="/warehouse" className="text-blue-600 dark:text-blue-400">
                    仓库
                  </Link>
                  新建一个。
                </p>
              )}
              {lib && !ownLibraries.some((l) => l.id === lib) && (
                <p className="mt-2 text-xs text-gray-400">
                  订阅来的库是只读的，不能在这里管理；已为你切换到自建库。
                </p>
              )}
            </div>
            {tagsLib ? <TagsSectionBody libraryId={tagsLib.id} /> : null}
          </div>
        )}
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={libId || undefined} />
    </>
  );
}
