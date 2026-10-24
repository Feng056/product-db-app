import { redirect } from "next/navigation";

/** /import 已合并到 /products/new?section=io，重定向保持兼容 */
export default function ImportRedirect({
  searchParams,
}: {
  searchParams: { lib?: string; tab?: string };
}) {
  const lib = searchParams.lib || "";
  const tab = searchParams.tab === "export" ? "export" : "import";
  redirect(`/products/new?section=io&sub=${tab}${lib ? `&lib=${lib}` : ""}`);
}
