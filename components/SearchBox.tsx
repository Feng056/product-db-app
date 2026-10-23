"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 搜索框：输入名称/型号，回车或点按钮搜索；清空恢复 */
export default function SearchBox({
  initial,
  baseHref,
}: {
  initial: string;
  baseHref: string;
}) {
  const [value, setValue] = useState(initial);
  const router = useRouter();

  const go = (q: string) => {
    const query = q.trim();
    router.push(query ? `${baseHref}&q=${encodeURIComponent(query)}` : baseHref);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="mt-3 flex items-center gap-2"
    >
      <div className="relative flex-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="搜索产品名称 / 型号"
          className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-sm outline-none focus:border-blue-500"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              go("");
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
  );
}
