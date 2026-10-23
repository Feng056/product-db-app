import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import ProductCard from "@/components/ProductCard";
import SignOutButton from "@/components/SignOutButton";
import LibraryBar from "@/components/LibraryBar";
import LibrarySharePanel from "@/components/LibrarySharePanel";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { category?: string; lib?: string; limit?: string; tags?: string };
};

const PAGE_SIZE = 30;

/** 产品列表：产品库切换 + 标签多选筛选 + 分类筛选（分页加载） */
export default async function ProductsPage({ searchParams }: Props) {
  const { user, profile } = await getCurrentProfile();
  const supabase = await createClient();

  // 产品库：无则自动建默认库；lib 参数非法则回退到第一个
  const libraries = await ensureDefaultLibrary();
  const currentId =
    libraries.find((l) => l.id === searchParams.lib)?.id ?? libraries[0].id;

  const category = searchParams.category || "";
  const limit = Math.min(
    Math.max(parseInt(searchParams.limit || "", 10) || PAGE_SIZE, PAGE_SIZE),
    1000
  );

  // 该库下的分类 + 规格（用于分类筛选和标签提取）
  const { data: allCats } = await supabase
    .from("products")
    .select("category, specs")
    .eq("user_id", user!.id)
    .eq("library_id", currentId);
  const categories = Array.from(
    new Set((allCats || []).map((c) => c.category).filter(Boolean))
  ).sort();

  // 提取商品标签（specs 中 key 为"标签"的值）
  const tagSet = new Set<string>();
  for (const r of allCats || []) {
    const specs = (r.specs as { key: string; value: string }[]) || [];
    for (const s of specs) {
      if (s && s.key === "标签" && s.value) tagSet.add(String(s.value));
    }
  }
  const tags = Array.from(tagSet).sort();

  // URL 中选中的标签（只保留有效的）
  const selectedTags = (searchParams.tags || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && tagSet.has(s));

  const baseParams = [
    category ? `category=${encodeURIComponent(category)}` : "",
    selectedTags.length > 0
      ? `tags=${encodeURIComponent(selectedTags.join(","))}`
      : "",
  ]
    .filter(Boolean)
    .join("&");

  // 列表只取展示需要的列 + 分页，附带总数
  let query = supabase
    .from("products")
    .select("id, name, model, category, price, images", { count: "exact" })
    .eq("user_id", user!.id)
    .eq("library_id", currentId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }
  if (selectedTags.length > 0) {
    // 标签多选：命中任一标签即符合（OR）
    const orClause = selectedTags
      .map((t) => `specs.cs.${JSON.stringify([{ key: "标签", value: t }])}`)
      .join(",");
    query = query.or(orClause);
  }

  const { data: products, count } = await query;
  const list = (products || []) as Product[];
  const total = count || 0;
  const hasMore = list.length < total;

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

        {/* 分享当前产品库 */}
        <LibrarySharePanel
          libraryId={currentId}
          libraryName={libraries.find((l) => l.id === currentId)?.name || ""}
        />

        {/* 标签筛选（多选） */}
        {tags.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                标签筛选{selectedTags.length > 0 && `（已选 ${selectedTags.length}）`}
              </span>
              {selectedTags.length > 0 && (
                <a
                  href={`/products?lib=${currentId}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                  className="text-xs text-blue-600"
                >
                  清除
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const active = selectedTags.includes(t);
                const next = active
                  ? selectedTags.filter((x) => x !== t)
                  : [...selectedTags, t];
                const params = [
                  `lib=${currentId}`,
                  category ? `category=${encodeURIComponent(category)}` : "",
                  next.length > 0 ? `tags=${encodeURIComponent(next.join(","))}` : "",
                ]
                  .filter(Boolean)
                  .join("&");
                return (
                  <a
                    key={t}
                    href={`/products?${params}`}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {active ? "✓ " : ""}{t}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* 分类筛选 */}
        {categories.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-medium text-gray-500">分类</div>
            <div className="flex flex-wrap gap-2">
            <a
              href={`/products?lib=${currentId}${selectedTags.length > 0 ? `&tags=${encodeURIComponent(selectedTags.join(","))}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                !category ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              全部
            </a>
            {categories.map((c) => (
              <a
                key={c}
                href={`/products?lib=${currentId}&category=${encodeURIComponent(c)}${selectedTags.length > 0 ? `&tags=${encodeURIComponent(selectedTags.join(","))}` : ""}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  category === c ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {c}
              </a>
            ))}
            </div>
          </div>
        )}

        {/* 列表 */}
        <div className="mt-4 space-y-3">
          {list.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-400">
              <div className="text-4xl">📦</div>
              <p className="mt-3">
                {category || selectedTags.length > 0 ? "没有符合条件的产品" : "还没有产品，去新增第一个吧"}
              </p>
            </div>
          ) : (
            list.map((p) => (
              <ProductCard key={p.id} product={p} coverUrl={coverUrls[p.id]} />
            ))
          )}
        </div>

        {/* 分页：加载更多 */}
        {hasMore && (
          <a
            href={`/products?lib=${currentId}${baseParams ? `&${baseParams}` : ""}&limit=${limit + PAGE_SIZE}`}
            className="mt-4 block rounded-2xl bg-gray-100 py-3 text-center text-sm font-medium text-gray-600"
          >
            加载更多（还剩 {total - list.length} 个，共 {total} 个）
          </a>
        )}
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={currentId} />
    </>
  );
}
