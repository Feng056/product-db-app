import { getCurrentProfile } from "@/actions/auth";
import BottomNav from "@/components/BottomNav";
import ImportClient from "@/components/ImportClient";

/** 一键导入页（服务端外壳 + 客户端解析/预览；lib 参数指定导入目标产品库） */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: { lib?: string };
}) {
  const { profile } = await getCurrentProfile();
  const lib = searchParams.lib || "";

  return (
    <>
      <ImportClient libraryId={lib || undefined} />
      <BottomNav isAdmin={profile?.is_admin} lib={lib || undefined} />
    </>
  );
}
