import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

/** 产品卡片（列表用） */
export default function ProductCard({
  product,
  coverUrl,
}: {
  product: Product;
  coverUrl: string | null;
}) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm active:bg-gray-50"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
            📦
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-gray-900">
          {product.name}
        </div>
        <div className="mt-0.5 truncate text-xs text-gray-500">
          {product.model || "—"} · {product.category}
        </div>
        <div className="mt-1 text-sm font-semibold text-blue-600">
          {formatPrice(product.price)}
        </div>
      </div>
      <div className="self-center text-gray-300">›</div>
    </Link>
  );
}
