import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { getSharedLibrary } from "@/actions/shares";
import { createClient } from "@/lib/supabase/server";
import ShareImportClient from "@/components/ShareImportClient";

export const dynamic = "force-dynamic";

/** 分享的产品库（公开页，无需登录可预览；支持多库） */
export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const shared = await getSharedLibrary(params.token);

  if (!shared.ok || !shared.libraries || shared.libraries.length === 0) {
    return (
      <main className="page-container">
        <div className="mt-20 rounded-2xl bg-white dark:bg-gray-900 p-10 text-center">
          <div className="text-4xl">🔗</div>
          <p className="mt-3 font-medium">分享链接无效</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">
            {shared.message || "该分享可能已被撤销"}
          </p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
          >
            去我的产品库
          </Link>
        </div>
      </main>
    );
  }

  const { user } = await getCurrentProfile();
  const libs = shared.libraries;
  const totalProducts = libs.reduce((s, l) => s + (l.product_count || 0), 0);

  // 封面图（每个库取前 3 个产品的图）
  const supabase = await createClient();
  const coverFor = (libIdx: number) => {
    const lib = libs[libIdx];
    const first = lib.products?.[0]?.images?.[0];
    return first
      ? supabase.storage.from("product-images").getPublicUrl(first).data.publicUrl
      : null;
  };

  return (
    <main className="page-container">
      <div className="mt-6 text-center">
        <div className="text-5xl">📦</div>
        <h1 className="mt-3 text-2xl font-bold">
          {libs.length === 1 ? libs[0].library_name : `${libs.length} 个仓库分享`}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">
          {shared.owner_name ? `${shared.owner_name} 分享` : "产品库分享"} · 共{" "}
          {totalProducts} 个产品
        </p>
      </div>

      {/* 仓库预览 */}
      <div className="mt-6 space-y-2">
        {libs.map((lib, i) => {
          const cover = coverFor(i);
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-3"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-xl">
                  🗂️
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{lib.library_name}</p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                  {lib.product_count} 个产品
                  {lib.products?.[0]
                    ? ` · ${lib.products.slice(0, 3).map((p) => p.name).join("、")}${
                        lib.product_count > 3 ? "…" : ""
                      }`
                    : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 订阅 */}
      {user ? (
        <ShareImportClient token={params.token} shared={shared} />
      ) : (
        <div className="mt-6">
          <Link
            href={`/login?next=${encodeURIComponent(`/share/${params.token}`)}`}
            className="block w-full rounded-2xl bg-blue-600 py-3.5 text-center text-base font-semibold text-white"
          >
            登录后订阅
          </Link>
        </div>
      )}
    </main>
  );
}
