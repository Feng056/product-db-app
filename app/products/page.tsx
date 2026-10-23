import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import ProductCard from "@/components/ProductCard";
import ExportButtons from "@/components/ExportButtons";
import SignOutButton from "@/components/SignOutButton";
import LibraryBar from "@/components/LibraryBar";
import { inputCls } from "@/components/SpecsEditor";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { q?: string; category?: string; lib?: string };
};

/** 产品列表：产品库切换 + 搜索 + 分类筛选 + 导出 */
export default async function ProductsPage({ searchParams }: Props) {
  const { user, profile } = await getCurrentProfile();
  const supabase = await createClient();

  // 产品库：无则自动建默认库；lib 参数非法则回退到第一个
  const libraries = await ensureDefaultLibrary();
  const currentId =
    libraries.find((l) => l.id === searchParams.lib)?.id ?? libraries[0].id;

  const q = (searchParams.q || "").trim();
  const category = searchParams.category || "";
  const baseParams = [
    q ? `q=${encodeURIComponent(q)}` : "",
    category ? `category=${encodeURIComponent(category)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  let query = supabase
    .from("products")
    .select("*")
    .eq("user_id", user!.id)
    .eq("library_id", currentId)
    .order("updated_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,model.ilike.%${q}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: products } = await query;
  const list = (products || []) as Product[];

  // 该库下的全部分类（用于筛选）
  const { data: allCats } = await supabase
    .from("products")
    .select("category")
    .eq("user_id", user!.id)
    .eq("library_id", currentId);
  const categories = Array.from(
    new Set((allCats || []).map((c) => c.category).filter(Boolean))
  ).sort();

  // 封面图 public URL
  const coverUrls: Record<string, string | null> = {};
  for (const p of list) {
    const first = p.images?.[0];
    coverUrls[p.id] = first
      ? supabase.storage.from("product-images").getPublicUrl(first).data.publicUrl
      : null;
  }

  return (
    <>
      <main className="page-container">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">产品库</h1>
          <SignOutButton displayName={profile?.display_name} email={profile?.email} />
        </div>

        {/* 产品库切换 */}
        <LibraryBar
          libraries={libraries}
          currentId={currentId}
          baseParams={baseParams}
        />

        {/* 搜索 */}
        <form method="get" className="mt-3 flex gap-2">
          <input type="hidden" name="lib" value={currentId} />
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索名称 / 型号…"
            className={inputCls}
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white"
          >
            搜索
          </button>
        </form>

        {/* 分类筛选 */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/products?lib=${currentId}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                !category ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              全部
            </a>
            {categories.map((c) => (
              <a
                key={c}
                href={`/products?lib=${currentId}&category=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  category === c ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {c}
              </a>
            ))}
          </div>
        )}

        {/* 导出 */}
        <div className="mt-3">
          <ExportButtons products={list} />
        </div>

        {/* 列表 */}
        <div className="mt-4 space-y-3">
          {list.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-400">
              <div className="text-4xl">📦</div>
              <p className="mt-3">
                {q || category ? "没有符合条件的产品" : "还没有产品，去新增第一个吧"}
              </p>
            </div>
          ) : (
            list.map((p) => (
              <ProductCard key={p.id} product={p} coverUrl={coverUrls[p.id]} />
            ))
          )}
        </div>
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={currentId} />
    </>
  );
}
