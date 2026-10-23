"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 搜索框：模式切换做在框内；输入名称/型号，回车或点按钮搜索 */
export default function SearchBox({
  initial,
  mode,
  baseHref,
}: {
  initial: string;
  mode: "name" | "all";
  baseHref: string;
}) {
  const [value, setValue] = useState(initial);
  const [searchMode, setSearchMode] = useState<"name" | "all">(mode);
  const router = useRouter();

  const go = (q: string, m: "name" | "all") => {
    const query = q.trim();
    const parts: string[] = [];
    if (query) parts.push(`q=${encodeURIComponent(query)}`);
    if (m === "all") parts.push("mode=all");
    router.push(parts.length > 0 ? `${baseHref}&${parts.join("&")}` : baseHref);
  };

  const switchMode = (m: "name" | "all") => {
    setSearchMode(m);
    go(value, m);
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center rounded-full border border-gray-200 bg-white pl-4 focus-within:border-blue-500 dark:border-gray-700 dark:bg-gray-900">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go(value, searchMode);
            }
          }}
          placeholder={searchMode === "all" ? "搜名称 / 型号 / 参数…" : "搜索产品名称"}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              go("", searchMode);
            }}
            aria-label="清空搜索"
            className="shrink-0 px-1 text-gray-400"
          >
            ✕
          </button>
        )}
        <div className="flex shrink-0 items-center py-1 pl-1 pr-1">
          <div className="flex rounded-full bg-gray-100 p-0.5 text-[11px] font-medium dark:bg-gray-800">
            <button
              type="button"
              onClick={() => switchMode("name")}
              className={`rounded-full px-2 py-1 ${
                searchMode === "name"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              名称
            </button>
            <button
              type="button"
              onClick={() => switchMode("all")}
              className={`rounded-full px-2 py-1 ${
                searchMode === "all"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              全部
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => go(value, searchMode)}
        className="shrink-0 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
      >
        搜索
      </button>
    </div>
  );
}
