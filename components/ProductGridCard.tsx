import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

/** 产品卡片（宫格用）：图片在上，名称价格在下 */
export default function ProductGridCard({
  product,
  coverUrl,
}: {
  product: Product;
  coverUrl: string | null;
}) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm active:bg-gray-50"
    >
      <div className="aspect-square bg-gray-100">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">
            📦
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="truncate text-[13px] font-medium text-gray-900">
          {product.name}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-gray-400">
          {product.model || "—"}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-blue-600">
          {formatPrice(product.price)}
        </div>
      </div>
    </Link>
  );
}
