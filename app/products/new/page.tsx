import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct } from "@/actions/products";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";

/** 新增产品（lib 参数指定归属产品库） */
export default async function NewProductPage({
  searchParams,
}: {
  searchParams: { lib?: string };
}) {
  const { profile } = await getCurrentProfile();
  const lib = searchParams.lib || "";

  return (
    <>
      <main className="page-container">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href={lib ? `/products?lib=${lib}` : "/products"}
            className="text-xl text-gray-500"
          >
            ‹
          </Link>
          <h1 className="text-xl font-bold">新增产品</h1>
        </div>
        {profile?.is_admin && (
          <Link
            href={lib ? `/products/new/recognize?lib=${lib}` : "/products/new/recognize"}
            className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-green-50 py-3 text-sm font-semibold text-green-700"
          >
            📷 拍照识别（批量）
          </Link>
        )}
        <Link
          href={lib ? `/products/batch-price?lib=${lib}` : "/products/batch-price"}
          className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-blue-50 py-3 text-sm font-semibold text-blue-700"
        >
          💰 批量改价
        </Link>
        <ProductForm action={createProduct} libraryId={lib || undefined} />
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={lib || undefined} />
    </>
  );
}
