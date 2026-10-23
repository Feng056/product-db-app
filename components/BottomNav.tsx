"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/products", label: "产品库", icon: "📦" },
  { href: "/products/new", label: "新增", icon: "➕" },
  { href: "/import", label: "导入导出", icon: "📥" },
];

/** 移动端底部导航；lib 透传当前产品库 id 给新增/导入页 */
export default function BottomNav({
  isAdmin,
  lib,
}: {
  isAdmin?: boolean;
  lib?: string;
}) {
  const pathname = usePathname();
  const withLib = (href: string) =>
    lib && (href === "/products/new" || href === "/import")
      ? `${href}?lib=${lib}`
      : href;
  const tabs = isAdmin
    ? [...TABS, { href: "/admin", label: "管理", icon: "⚙️" }]
    : TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => {
          const active =
            t.href === "/products"
              ? pathname === "/products"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={withLib(t.href)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                active ? "font-semibold text-blue-600" : "text-gray-500"
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
