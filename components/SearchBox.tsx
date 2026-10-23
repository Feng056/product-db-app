"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 搜索框：名称 / 全部 两种模式；输入名称/型号，回车或点按钮搜索 */
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
    <div className="mt-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value, searchMode);
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={searchMode === "all" ? "搜名称 / 型号 / 参数…" : "搜索产品名称"}
            className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm outline-none focus:border-blue-500"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                go("", searchMode);
              }}
              aria-label="清空搜索"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          搜索
        </button>
      </form>
      <div className="mt-2 flex gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => switchMode("name")}
          className={`rounded-full px-3 py-1 font-medium ${
            searchMode === "name"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          名称
        </button>
        <button
          type="button"
          onClick={() => switchMode("all")}
          className={`rounded-full px-3 py-1 font-medium ${
            searchMode === "all"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          全部
        </button>
        <span className="self-center text-[11px] text-gray-400">
          {searchMode === "all" ? "匹配名称、型号、分类、参数、备注" : "只匹配产品名称"}
        </span>
      </div>
    </div>
  );
}
