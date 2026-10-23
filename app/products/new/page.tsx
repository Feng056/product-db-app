import Link from "next/link";
import { getCurrentProfile } from "@/actions/auth";
import { createProduct } from "@/actions/products";
import BottomNav from "@/components/BottomNav";
import ProductForm from "@/components/ProductForm";

/** 新增产品 */
export default async function NewProductPage() {
  const { profile } = await getCurrentProfile();

  return (
    <>
      <main className="page-container">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/products" className="text-xl text-gray-500">
            ‹
          </Link>
          <h1 className="text-xl font-bold">新增产品</h1>
        </div>
        <ProductForm action={createProduct} />
      </main>
      <BottomNav isAdmin={profile?.is_admin} />
    </>
  );
}
