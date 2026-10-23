import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/actions/auth";
import { ensureDefaultLibrary } from "@/actions/libraries";
import BottomNav from "@/components/BottomNav";
import RecognizeClient from "@/components/RecognizeClient";

/** 拍照识别：批量拍照 → AI 识别 → 批量保存 */
export default async function RecognizePage({
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

  return (
    <>
      <main className="page-container">
        <div className="mb-4 flex items-center gap-3">
          <Link href={`/products?lib=${libId}`} className="text-xl text-gray-500">
            ‹
          </Link>
          <div>
            <h1 className="text-xl font-bold">拍照识别</h1>
            <p className="text-xs text-gray-400">将保存到「{libName}」</p>
          </div>
        </div>
        <RecognizeClient libraryId={libId} />
      </main>
      <BottomNav isAdmin={profile?.is_admin} lib={libId} />
    </>
  );
}
