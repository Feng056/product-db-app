import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import ProductCard from "@/components/ProductCard";
import LibraryBar from "@/components/LibraryBar";
import LibrarySharePanel from "@/components/LibrarySharePanel";
import FilterCollapse from "@/components/FilterCollapse";
import ProductGridCard from "@/components/ProductGridCard";
import SortSelect from "@/components/SortSelect";
import SearchBox from "@/components/SearchBox";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { categories?: string; lib?: string; limit?: string; tags?: string; view?: string; sort?: string; q?: string; mode?: string };
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

  // URL 中选中的分类（多选，只保留有效的）
  const selectedCategories = (searchParams.categories || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s);
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

  // 视图：list 列表 / grid 宫格
  const view = searchParams.view === "grid" ? "grid" : "list";

  // 排序：newest 最新 / price_asc 价格↑ / price_desc 价格↓ / name 名称
  const validSorts = ["newest", "price_asc", "price_desc", "name"] as const;
  const sort: (typeof validSorts)[number] = (validSorts as readonly string[]).includes(searchParams.sort || "")
    ? (searchParams.sort as (typeof validSorts)[number])
    : "newest";

  // 搜索关键词（名称/型号模糊匹配）
  const query = (searchParams.q || "").trim();
  // 搜索模式：name 只匹配名称（默认），all 匹配全部参数
  const searchMode = searchParams.mode === "all" ? "all" : "name";

  const baseParams = [
    selectedCategories.length > 0
      ? `categories=${encodeURIComponent(selectedCategories.join(","))}`
      : "",
    selectedTags.length > 0
      ? `tags=${encodeURIComponent(selectedTags.join(","))}`
      : "",
    view === "grid" ? "view=grid" : "",
    sort !== "newest" ? `sort=${sort}` : "",
    query ? `q=${encodeURIComponent(query)}` : "",
    searchMode === "all" ? "mode=all" : "",
  ]
    .filter(Boolean)
    .join("&");

  // 列表查询走数据库函数 search_products（多分类 + 多标签 OR 筛选）
  const { data: searchResult } = await supabase.rpc("search_products", {
    p_library_id: currentId,
    p_categories: selectedCategories,
    p_tags: selectedTags,
    p_limit: limit,
    p_sort: sort,
    p_query: query,
    p_search_mode: searchMode,
  });
  const parsed = (searchResult || { total: 0, items: [] }) as {
    total: number;
    items: Product[];
  };
  const list = parsed.items || [];
  const total = parsed.total || 0;
  const hasMore = list.length < total;

  // 封面图 public URL
  const coverUrls: Record<string, string | null> = {};
  for (const p of list) {
    const first = p.images?.[0];
    coverUrls[p.id] = first
      ? supabase.storage.from("product-images").getPublicUrl(first).data.publicUrl
      : null;
  }

  // 统一筛选 chips：分类（多选）+ 标签（多选），选中的排前面；标签加 # 前缀以示区分
  const catsParam = selectedCategories.length > 0
    ? `categories=${encodeURIComponent(selectedCategories.join(","))}`
    : "";
  const tagsParam = selectedTags.length > 0
    ? `tags=${encodeURIComponent(selectedTags.join(","))}`
    : "";
  const buildParams = (cats: string[], tagList: string[]) =>
    [
      `lib=${currentId}`,
      cats.length > 0 ? `categories=${encodeURIComponent(cats.join(","))}` : "",
      tagList.length > 0 ? `tags=${encodeURIComponent(tagList.join(","))}` : "",
      view === "grid" ? "view=grid" : "",
      sort !== "newest" ? `sort=${sort}` : "",
      query ? `q=${encodeURIComponent(query)}` : "",
    searchMode === "all" ? "mode=all" : "",
    ]
      .filter(Boolean)
      .join("&");
  // 视图切换链接（保留筛选条件）
  const viewHref = (v: "list" | "grid") => {
    const params = [
      `lib=${currentId}`,
      selectedCategories.length > 0
        ? `categories=${encodeURIComponent(selectedCategories.join(","))}`
        : "",
      selectedTags.length > 0
        ? `tags=${encodeURIComponent(selectedTags.join(","))}`
        : "",
      sort !== "newest" ? `sort=${sort}` : "",
      query ? `q=${encodeURIComponent(query)}` : "",
    searchMode === "all" ? "mode=all" : "",
      v === "grid" ? "view=grid" : "",
    ]
      .filter(Boolean)
      .join("&");
    return `/products?${params}`;
  };
  // 搜索框的基础链接（不含 q，搜索时重置分页）
  const searchBaseHref = `/products?${[
    `lib=${currentId}`,
    selectedCategories.length > 0
      ? `categories=${encodeURIComponent(selectedCategories.join(","))}`
      : "",
    selectedTags.length > 0
      ? `tags=${encodeURIComponent(selectedTags.join(","))}`
      : "",
    view === "grid" ? "view=grid" : "",
    sort !== "newest" ? `sort=${sort}` : "",
  ]
    .filter(Boolean)
    .join("&")}`;
  // 排序切换的基础链接（不含 sort，切换时重置分页）
  const sortBaseHref = `/products?${[
    `lib=${currentId}`,
    selectedCategories.length > 0
      ? `categories=${encodeURIComponent(selectedCategories.join(","))}`
      : "",
    selectedTags.length > 0
      ? `tags=${encodeURIComponent(selectedTags.join(","))}`
      : "",
    view === "grid" ? "view=grid" : "",
    query ? `q=${encodeURIComponent(query)}` : "",
    searchMode === "all" ? "mode=all" : "",
  ]
    .filter(Boolean)
    .join("&")}`;
  type Chip = { key: string; label: string; active: boolean; href: string; check: boolean };
  const chips: Chip[] = [
    {
      key: "cat-all",
      label: "全部",
      active: selectedCategories.length === 0,
      href: `/products?lib=${currentId}${tagsParam ? `&${tagsParam}` : ""}`,
      check: false,
    },
    ...categories.map((c) => {
      const active = selectedCategories.includes(c);
      const next = active
        ? selectedCategories.filter((x) => x !== c)
        : [...selectedCategories, c];
      return {
        key: `cat-${c}`,
        label: c,
        active,
        href: `/products?${buildParams(next, selectedTags)}`,
        check: true,
      };
    }),
    ...tags.map((t) => {
      const active = selectedTags.includes(t);
      const next = active
        ? selectedTags.filter((x) => x !== t)
        : [...selectedTags, t];
      return {
        key: `tag-${t}`,
        label: `#${t}`,
        active,
        href: `/products?${buildParams(selectedCategories, next)}`,
        check: true,
      };
    }),
  ];
  const sortedChips = [
    ...chips.filter((c) => c.active),
    ...chips.filter((c) => !c.active),
  ];
  const activeFilterCount =
    selectedCategories.length + selectedTags.length;
  const headerDisplay =
    (profile as { header_display?: string } | null)?.header_display || "name";
  const avatarPath =
    (profile as { avatar_path?: string } | null)?.avatar_path || "";
  const headerAvatarUrl = avatarPath
    ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
    : null;

  return (
    <>
      <main className="page-container">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">产品库</h1>
          {headerDisplay === "avatar" &&
            (headerAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headerAvatarUrl}
                alt="头像"
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                {(profile?.display_name || profile?.email || "我").slice(0, 1)}
              </div>
            ))}
          {headerDisplay === "name" && (
            <span className="max-w-[40%] truncate text-sm text-gray-500">
              {profile?.display_name || profile?.email}
            </span>
          )}
        </div>

        {/* 搜索栏 */}
        <SearchBox initial={query} mode={searchMode} baseHref={searchBaseHref} />

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

        {/* 统一筛选：分类（单选）+ 标签（多选），默认显示一排 */}
        {(categories.length > 0 || tags.length > 0) && (
          <FilterCollapse activeCount={activeFilterCount}>
            {sortedChips.map((chip) => (
              <Link
                key={chip.key}
                href={chip.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  chip.active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {chip.active && chip.check ? "✓ " : ""}
                {chip.label}
              </Link>
            ))}
          </FilterCollapse>
        )}

        {/* 排序 + 视图切换 */}
        <div className="mt-4 flex items-center justify-between">
          <SortSelect current={sort} baseHref={sortBaseHref} />
          <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-medium">
            <Link
              href={viewHref("list")}
              className={`rounded-full px-3 py-1.5 ${
                view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              ☰ 列表
            </Link>
            <Link
              href={viewHref("grid")}
              className={`rounded-full px-3 py-1.5 ${
                view === "grid" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              ⊞ 宫格
            </Link>
          </div>
        </div>

        {/* 列表 */}
        {view === "grid" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {list.length === 0 ? (
              <div className="col-span-2 rounded-2xl bg-white p-10 text-center text-sm text-gray-400">
                <div className="text-4xl">📦</div>
                <p className="mt-3">
                  {selectedCategories.length > 0 || selectedTags.length > 0 || query ? "没有符合条件的产品" : "还没有产品，去新增第一个吧"}
                </p>
              </div>
            ) : (
              list.map((p) => (
                <ProductGridCard key={p.id} product={p} coverUrl={coverUrls[p.id]} />
              ))
            )}
          </div>
        ) : (
        <div className="mt-3 space-y-3">
          {list.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-400">
              <div className="text-4xl">📦</div>
              <p className="mt-3">
                {selectedCategories.length > 0 || selectedTags.length > 0 || query ? "没有符合条件的产品" : "还没有产品，去新增第一个吧"}
              </p>
            </div>
          ) : (
            list.map((p) => (
              <ProductCard key={p.id} product={p} coverUrl={coverUrls[p.id]} />
            ))
          )}
        </div>
        )}

        {/* 分页：加载更多 */}
        {hasMore && (
          <Link
            href={`/products?lib=${currentId}${baseParams ? `&${baseParams}` : ""}&limit=${limit + PAGE_SIZE}`}
            className="mt-4 block rounded-2xl bg-gray-100 py-3 text-center text-sm font-medium text-gray-600"
          >
            加载更多（还剩 {total - list.length} 个，共 {total} 个）
          </Link>
        )}
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={currentId} />
    </>
  );
}
