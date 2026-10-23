import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct } from "@/actions/products";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";
import CreateLibraryForm from "@/components/CreateLibraryForm";
import LibrarySharePanel from "@/components/LibrarySharePanel";

/** 新增页：新增产品 + 批量改价 + 产品库管理（新建/分享） */
export default async function NewProductPage({
  searchParams,
}: {
  searchParams: { lib?: string };
}) {
  const { profile } = await getCurrentProfile();
  const libraries = await ensureDefaultLibrary();
  const lib = searchParams.lib || "";
  const currentLib = libraries.find((l) => l.id === lib) || libraries[0];
  const libId = currentLib?.id || "";
  const libName = currentLib?.name || "";

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

        {/* 产品库管理：新建 + 分享 */}
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            产品库管理
            {libName && <span className="ml-1 font-normal">（当前：{libName}）</span>}
          </h2>
          <CreateLibraryForm />
          {libId && (
            <div className="mt-3">
              <LibrarySharePanel libraryId={libId} libraryName={libName} />
            </div>
          )}
        </section>

        <h2 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
          新增产品
        </h2>
        <ProductForm action={createProduct} libraryId={libId || undefined} />
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={libId || undefined} />
    </>
  );
}
