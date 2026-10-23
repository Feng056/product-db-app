import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import ProductCard from "@/components/ProductCard";
import LibraryBar from "@/components/LibraryBar";
import LibrarySharePanel from "@/components/LibrarySharePanel";
import FilterCollapse from "@/components/FilterCollapse";
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

  // 统一筛选 chips：分类（单选）+ 标签（多选），选中的排前面
  const tagsParam = selectedTags.length > 0
    ? `tags=${encodeURIComponent(selectedTags.join(","))}`
    : "";
  type Chip = { key: string; label: string; active: boolean; href: string; check: boolean };
  const chips: Chip[] = [
    {
      key: "cat-all",
      label: "全部",
      active: !category,
      href: `/products?lib=${currentId}${tagsParam ? `&${tagsParam}` : ""}`,
      check: false,
    },
    ...categories.map((c) => ({
      key: `cat-${c}`,
      label: c,
      active: category === c,
      href: `/products?lib=${currentId}&category=${encodeURIComponent(c)}${tagsParam ? `&${tagsParam}` : ""}`,
      check: false,
    })),
    ...tags.map((t) => {
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
      return {
        key: `tag-${t}`,
        label: t,
        active,
        href: `/products?${params}`,
        check: true,
      };
    }),
  ];
  const sortedChips = [
    ...chips.filter((c) => c.active),
    ...chips.filter((c) => !c.active),
  ];
  const activeFilterCount =
    (category ? 1 : 0) + selectedTags.length;
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
              <a
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
              </a>
            ))}
          </FilterCollapse>
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
