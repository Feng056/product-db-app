import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/actions/auth";
import { updateProduct, deleteProduct } from "@/actions/products";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";
import DocDownloadButton from "@/components/DocDownloadButton";
import { formatPrice, formatDateTime } from "@/lib/utils";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await deleteProduct(id);
      }}
    >
      <button
        type="submit"
        className="w-full rounded-2xl bg-red-50 dark:bg-red-950 py-3 text-sm font-semibold text-red-600 dark:text-red-400"
      >
        删除该产品
      </button>
    </form>
  );
}

/** 产品详情 + 编辑（?edit=1 进入编辑模式） */
export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const { user, profile } = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single();

  if (!data) notFound();
  const product = data as Product;
  const isEdit = searchParams.edit === "1";

  // 并行：订阅关系 + 库时间显示设置
  const [subRes, libRes] = await Promise.all([
    supabase
      .from("library_subscriptions")
      .select("id, library_id")
      .eq("copy_library_id", product.library_id)
      .eq("subscriber_id", user!.id)
      .limit(1),
    product.library_id
      ? supabase.from("libraries").select("time_display").eq("id", product.library_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const sub = subRes.data;
  const isSubCopy = !!sub && sub.length > 0;
  // 共同创作者且无待审核提交 → 可编辑；否则订阅副本只读
  let canEdit = !isSubCopy;
  let coBadge = "";
  if (isSubCopy) {
    const sourceId = (sub[0] as { library_id: string }).library_id;
    const [ccRes, pendRes] = await Promise.all([
      supabase
        .from("library_co_creators")
        .select("status")
        .eq("source_library_id", sourceId)
        .eq("user_id", user!.id)
        .single(),
      supabase
        .from("co_creation_submissions")
        .select("id")
        .eq("copy_library_id", product.library_id)
        .eq("status", "pending")
        .limit(1),
    ]);
    const approved = (ccRes.data as { status?: string } | null)?.status === "approved";
    const hasPending = !!pendRes.data && pendRes.data.length > 0;
    canEdit = approved && !hasPending;
    coBadge = approved ? (hasPending ? "修改已提交 · 待审核" : "共同创作 · 可编辑") : "";
  }
  const isReadOnly = !canEdit;

  // 该产品所在库的时间显示设置（发布者控制）
  const timeDisplay = (libRes.data as { time_display?: string } | null)?.time_display || "both";
  const showCreated = timeDisplay !== "updated";
  const showUpdated = timeDisplay !== "created";

  const imageUrls: Record<string, string> = {};
  for (const p of product.images || []) {
    imageUrls[p] = supabase.storage.from("product-images").getPublicUrl(p).data.publicUrl;
  }

  return (
    <>
      <main className="page-container">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/products" className="flex items-center gap-2 text-gray-500 dark:text-gray-400 ">
            <span className="text-xl">‹</span> 返回
          </Link>
          {isSubCopy && coBadge === "共同创作 · 可编辑" && !isEdit ? (
            <div className="flex flex-col items-end gap-1">
              <Link
                href={`/products/${product.id}?edit=1`}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white"
              >
                编辑
              </Link>
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                共同创作 · 可编辑
              </span>
            </div>
          ) : (
            <>
              {!isEdit && !isReadOnly && (
                <Link
                  href={`/products/${product.id}?edit=1`}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white"
                >
                  编辑
                </Link>
              )}
              {isSubCopy && coBadge && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    coBadge === "共同创作 · 可编辑"
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : coBadge === "修改已提交 · 待审核"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  }`}
                >
                  {coBadge}
                </span>
              )}
            </>
          )}
        </div>

        {isEdit ? (
          isReadOnly ? (
            <p className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-400">
              {coBadge === "修改已提交 · 待审核"
                ? "修改已提交，等待发布者审核，期间不可编辑"
                : "订阅的内容为只读，不可编辑"}
            </p>
          ) : (
          <>
            <h1 className="mb-4 text-xl font-bold">编辑产品</h1>
            <ProductForm product={product} imageUrls={imageUrls} action={updateProduct} />
            <div className="mt-6">
              <DeleteButton id={product.id} />
            </div>
          </>
          )
        ) : (
          <div className="space-y-4">
            {/* 图片 */}
            {(product.images || []).length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {(product.images || []).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p}
                    src={imageUrls[p]}
                    alt={product.name}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            )}

            <div>
              <h1 className="text-xl font-bold">{product.name}</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">
                {product.model || "—"} · {product.category}
              </p>
              <p className="mt-2 text-2xl font-bold text-blue-600">
                {formatPrice(product.price)}
              </p>
            </div>

            {/* 规格参数 */}
            {(product.specs || []).length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">规格参数</h2>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                  {product.specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-4 py-2">
                      <dt className="text-gray-500 dark:text-gray-400 ">{s.key}</dt>
                      <dd className="text-right font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* 备注 */}
            {product.notes && (
              <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">备注</h2>
                <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 ">{product.notes}</p>
              </div>
            )}

            {/* 文档附件 */}
            {(product.docs || []).length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">文档附件</h2>
                <div className="space-y-2">
                  {product.docs.map((d) => (
                    <DocDownloadButton key={d.path} name={d.name} path={d.path} />
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              （此参数仅供参考，不做销售依据，具体以实际产品为准）
            </p>
            {(showCreated || showUpdated) && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {showCreated && <>创建于 {formatDateTime(product.created_at)}</>}
                {showCreated && showUpdated && " · "}
                {showUpdated && <>更新于 {formatDateTime(product.updated_at)}</>}
              </p>
            )}
          </div>
        )}
      </main>
      <BottomNav isAdmin={profile?.is_admin} />
    </>
  );
}
