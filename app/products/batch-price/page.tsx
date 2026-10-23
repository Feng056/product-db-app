import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import BatchPriceClient from "@/components/BatchPriceClient";

export type BatchProduct = {
  id: string;
  name: string;
  price: number | null;
  tag: string;
  weight: string;
};

function specValue(specs: unknown, key: string): string {
  if (!Array.isArray(specs)) return "";
  for (const s of specs as { key?: string; value?: string }[]) {
    if (s && s.key === key && s.value) return String(s.value);
  }
  return "";
}

/** 批量改价：按标签 / 同价格 / 同重量分组，一键改价 */
export default async function BatchPricePage({
  searchParams,
}: {
  searchParams: { lib?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");

  const libraries = await ensureDefaultLibrary();
  const libId = libraries.some((l) => l.id === searchParams.lib)
    ? searchParams.lib!
    : libraries[0]?.id || "";
  const libName = libraries.find((l) => l.id === libId)?.name || "";

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price, specs")
    .eq("user_id", user.id)
    .eq("library_id", libId)
    .order("name");

  const products: BatchProduct[] = (data || []).map((p) => ({
    id: p.id as string,
    name: (p.name as string) || "",
    price: (p.price as number | null) ?? null,
    tag: specValue(p.specs, "标签"),
    weight: specValue(p.specs, "重量"),
  }));

  return (
    <>
      <main className="page-container">
        <div className="mb-4 flex items-center gap-3">
          <Link href={`/products/new${libId ? `?lib=${libId}` : ""}`} className="text-xl text-gray-500 dark:text-gray-400 ">
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold">批量改价</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{libName} · 共 {products.length} 个产品</p>
          </div>
        </div>
        <BatchPriceClient products={products} libraryId={libId} />
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={libId || undefined} />
    </>
  );
}
