"use client";

import { useState } from "react";
import { getDocDownloadUrl } from "@/actions/products";

/** 文档下载按钮：通过 Server Action 获取私有 bucket 的临时签名链接 */
export default function DocDownloadButton({ name, path }: { name: string; path: string }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    const res = await getDocDownloadUrl(path);
    setLoading(false);
    if (res.url) {
      window.open(res.url, "_blank");
    } else {
      alert(res.error || "下载失败");
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="flex w-full items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-900 px-4 py-3 text-left text-sm active:bg-gray-100 disabled:opacity-60"
    >
      <span className="truncate">📄 {name}</span>
      <span className="ml-2 shrink-0 text-blue-600">{loading ? "获取中…" : "下载"}</span>
    </button>
  );
}
