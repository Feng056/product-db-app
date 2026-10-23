import { redirect } from "next/navigation";

/** /admin 已合并到 /settings，保留此路由做跳转 */
export default function AdminRedirect() {
  redirect("/settings");
}
