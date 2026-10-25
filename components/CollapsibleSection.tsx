"use client";

import { useState } from "react";

/**
 * 可折叠的设置分组：标题行点一下收起/展开。
 * children 仍由服务端渲染传入，里面的服务端表单不受影响。
 */
export default function CollapsibleSection({
  title,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-gray-500 dark:text-gray-400"
      >
        <span>{title}</span>
        <span className="text-xs">{collapsed ? "展开 ▸" : "收起 ▾"}</span>
      </button>
      {!collapsed && <div className="space-y-3">{children}</div>}
    </section>
  );
}
