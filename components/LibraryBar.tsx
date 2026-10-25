"use client";

import Link from "next/link";
import type { Library } from "@/lib/types";

/** 产品库切换条：横向滚动 pills（显示顺序在仓库管理里调整；是否显示也在仓库管理里选） */
export default function LibraryBar({
  libraries,
  currentId,
  baseParams,
  subCopyIds,
  updatedCopyIds,
}: {
  libraries: Library[];
  currentId: string;
  baseParams: string;
  subCopyIds?: Set<string>;
  updatedCopyIds?: Set<string>;
}) {
  const hrefFor = (id: string) =>
    `/products?lib=${id}${baseParams ? `&${baseParams}` : ""}`;

  if (libraries.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {libraries.map((lib) => (
          <Link
            key={lib.id}
            href={hrefFor(lib.id)}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              lib.id === currentId
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {lib.name}
            {subCopyIds?.has(lib.id) && <span className="ml-1 opacity-70">📡</span>}
            {updatedCopyIds?.has(lib.id) && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
