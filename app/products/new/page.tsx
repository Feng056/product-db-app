import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct } from "@/actions/products";
import { ensureDefaultLibrary } from "@/actions/libraries";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";
import ImportClient from "@/components/ImportClient";
import ExportPanel from "@/components/ExportPanel";

/** 管理页：新增 / 导入导出 两个模块 */
export default async function ManagePage({
  searchParams,
}: {
  searchParams: { lib?: string; section?: string; sub?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const section = searchParams.section === "io" ? "io" : "add";
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

  // 我订阅的副本库 id（导出时剔除）
  const { data: mySubs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", user!.id);
  const subCopyIds = new Set((mySubs || []).map((s) => s.copy_library_id));
  const exportableLibraries = libraries.filter((l) => !subCopyIds.has(l.id));

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

        {/* 顶级两选项 */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
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
        </div>

        {/* 新增 */}
        {section === "add" && (
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
