import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/actions/auth";
import { getSharedLibrary, importSharedLibrary } from "@/actions/shares";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** 分享的产品库（公开页，无需登录可预览） */
export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const shared = await getSharedLibrary(params.token);

  if (!shared.ok) {
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
  const products = shared.products || [];

  // 封面图
  const supabase = await createClient();
  const covers = products.map((p) => {
    const first = p.images?.[0];
    return first
      ? supabase.storage.from("product-images").getPublicUrl(first).data.publicUrl
      : null;
  });

  async function onImport() {
    "use server";
    const res = await importSharedLibrary(params.token);
    if (res.error) {
      redirect(`/share/${params.token}?error=${encodeURIComponent(res.error)}`);
    }
    redirect(`/products?lib=${res.libraryId}`);
  }

  return (
    <main className="page-container">
      <div className="mt-6 text-center">
        <div className="text-5xl">📦</div>
        <h1 className="mt-3 text-2xl font-bold">{shared.library_name}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">
          {shared.owner_name ? `${shared.owner_name} 分享` : "产品库分享"} · 共{" "}
          {shared.product_count} 个产品
        </p>
      </div>

      {/* 产品预览 */}
      <div className="mt-6 space-y-2">
        {products.slice(0, 20).map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-3">
            {covers[i] ? (
              <img src={covers[i]!} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-xl">
                📦
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                {[p.model, p.category].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        ))}
        {(shared.product_count || 0) > 20 && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            还有 {(shared.product_count || 0) - 20} 个产品…
          </p>
        )}
      </div>

      {/* 导入按钮 */}
      <div className="mt-6">
        {user ? (
          <form action={onImport}>
            <button
              type="submit"
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white"
            >
              导入到我的产品库
            </button>
          </form>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/share/${params.token}`)}`}
            className="block w-full rounded-2xl bg-blue-600 py-3.5 text-center text-base font-semibold text-white"
          >
            登录后导入
          </Link>
        )}
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          导入会在你的账号下新建「{shared.library_name}（分享）」产品库
        </p>
      </div>
    </main>
  );
}
