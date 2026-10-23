import { getCurrentProfile } from "@/actions/auth";
import BottomNav from "@/components/BottomNav";
import ImportClient from "@/components/ImportClient";

/** 一键导入页（服务端外壳 + 客户端解析/预览） */
export default async function ImportPage() {
  const { profile } = await getCurrentProfile();

  return (
    <>
      <ImportClient />
      <BottomNav isAdmin={profile?.is_admin} />
    </>
  );
}
