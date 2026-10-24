import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct } from "@/actions/products";
import { ensureDefaultLibrary, getPublishedLibraries } from "@/actions/libraries";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";
import CreateLibraryForm from "@/components/CreateLibraryForm";
import LibraryManageList from "@/components/LibraryManageList";
import SubscribePlaza from "@/components/SubscribePlaza";
import ImportClient from "@/components/ImportClient";
import ExportPanel from "@/components/ExportPanel";

/** 管理页：订阅广场 / 新增 / 导入导出 三个模块 */
export default async function ManagePage({
  searchParams,
}: {
  searchParams: { lib?: string; section?: string; sub?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const section = searchParams.section === "plaza" ? "plaza" : searchParams.section === "io" ? "io" : "add";
  const sub = searchParams.sub || "";
  // 新增下的子 tab
  const addTab = sub === "library" ? "library" : "product";
  // 导入导出下的子 tab
  const ioTab = sub === "export" ? "export" : "import";

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

  // 各库产品数
  const { data: countsData } = await supabase
    .from("products")
    .select("library_id")
    .eq("user_id", user!.id)
    .in("library_id", libraries.map((l) => l.id));
  const counts: Record<string, number> = {};
  for (const p of countsData || []) {
    const id = (p as { library_id: string }).library_id;
    counts[id] = (counts[id] || 0) + 1;
  }

  // 各库订阅者数
  const { data: subsData } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .in("library_id", libraries.map((l) => l.id));
  const subCounts: Record<string, number> = {};
  for (const s of subsData || []) {
    const id = (s as { library_id: string }).library_id;
    subCounts[id] = (subCounts[id] || 0) + 1;
  }

  // 我订阅的副本库 id
  const { data: mySubs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", user!.id);
  const subCopyIds = new Set((mySubs || []).map((s) => s.copy_library_id));
  const exportableLibraries = libraries.filter((l) => !subCopyIds.has(l.id));

  // 订阅广场数据
  const publishedLibs = section === "plaza" ? await getPublishedLibraries() : [];

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
            href={secHref("plaza")}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              section === "plaza"
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            🏪 广场
          </Link>
          <Link
            href={secHref("add", addTab)}
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
        </div>

        {/* 订阅广场 */}
        {section === "plaza" && (
          <div className="mt-4">
            <SubscribePlaza libs={publishedLibs} />
          </div>
        )}

        {/* 新增 */}
        {section === "add" && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
              <Link
                href={secHref("add", "product")}
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  addTab === "product"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                📦 商品
              </Link>
              <Link
                href={secHref("add", "library")}
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  addTab === "library"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                🗂️ 仓库
              </Link>
            </div>

            {addTab === "product" ? (
              <div className="mt-4">
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
            ) : (
              <div className="mt-4 space-y-4">
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    新建仓库
                  </h2>
                  <CreateLibraryForm />
                </section>
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    管理仓库
                  </h2>
                  <LibraryManageList libraries={libraries} counts={counts} subCounts={subCounts} subCopyIds={subCopyIds} />
                </section>
              </div>
            )}
          </>
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
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={libId || undefined} />
    </>
  );
}
