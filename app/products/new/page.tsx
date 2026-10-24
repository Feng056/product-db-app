import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct } from "@/actions/products";
import { ensureDefaultLibrary } from "@/actions/libraries";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";
import CreateLibraryForm from "@/components/CreateLibraryForm";
import LibraryShareManager from "@/components/LibraryShareManager";
import LibraryManageList from "@/components/LibraryManageList";

/** 新增页：顶部切换 商品 / 仓库 两个模块 */
export default async function NewProductPage({
  searchParams,
}: {
  searchParams: { lib?: string; tab?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const tab = searchParams.tab === "library" ? "library" : "product";
  const currentLib = libraries.find((l) => l.id === lib) || libraries[0];
  const libId = currentLib?.id || "";
  const libParam = libId ? `?lib=${libId}` : "";

  // 各库产品数（仓库 tab 用）
  const supabase = await createClient();
  const { data: countsData } = await supabase
    .from("products")
    .select("library_id")
    .eq("user_id", user!.id)
    .in(
      "library_id",
      libraries.map((l) => l.id)
    );
  const counts: Record<string, number> = {};
  for (const p of countsData || []) {
    const id = (p as { library_id: string }).library_id;
    counts[id] = (counts[id] || 0) + 1;
  }

  // 各库订阅者数（推送更新用）
  const { data: subsData } = await supabase
    .from("library_subscriptions")
    .select("library_id")
    .in(
      "library_id",
      libraries.map((l) => l.id)
    );
  const subCounts: Record<string, number> = {};
  for (const s of subsData || []) {
    const id = (s as { library_id: string }).library_id;
    subCounts[id] = (subCounts[id] || 0) + 1;
  }

  // 我订阅的副本库 id（不可改名/发布）
  const { data: mySubs } = await supabase
    .from("library_subscriptions")
    .select("copy_library_id")
    .eq("subscriber_id", user!.id);
  const subCopyIds = new Set((mySubs || []).map((s) => s.copy_library_id));

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
          <h1 className="text-xl font-bold">新增</h1>
        </div>

        {/* 顶部模块切换 */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
          <Link
            href={`/products/new${libParam}${tab === "product" ? "" : ""}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              tab === "product"
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            📦 商品
          </Link>
          <Link
            href={`/products/new${libParam ? `${libParam}&tab=library` : "?tab=library"}`}
            className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
              tab === "library"
                ? "bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            🗂️ 仓库
          </Link>
        </div>

        {tab === "product" ? (
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
                分享仓库
              </h2>
              <LibraryShareManager libraries={libraries} counts={counts} />
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                管理仓库
              </h2>
              <LibraryManageList libraries={libraries} counts={counts} subCounts={subCounts} subCopyIds={subCopyIds} />
            </section>
          </div>
        )}
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={libId || undefined} />
    </>
  );
}
