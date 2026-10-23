"use client";

import { useState, type ReactNode } from "react";

/** 可折叠的筛选区：默认只显示一排，点击展开/收起 */
export default function FilterCollapse({
  children,
  activeCount,
}: {
  children: ReactNode;
  activeCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ">
          筛选{activeCount > 0 && `（${activeCount}）`}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600"
        >
          {expanded ? "收起 ▲" : "展开 ▼"}
        </button>
      </div>
      <div
        className={
          expanded
            ? "flex flex-wrap gap-2"
            : "flex max-h-8 flex-wrap gap-2 overflow-hidden"
        }
      >
        {children}
      </div>
    </div>
  );
}
