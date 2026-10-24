"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/products", label: "产品库", icon: "📦" },
  { href: "/products/new", label: "管理", icon: "🛠️" },
  { href: "/settings", label: "设置", icon: "⚙️" },
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
  const router = useRouter();
  const withLib = (href: string) =>
    lib && href === "/products/new"
      ? `${href}?lib=${lib}`
      : href;

  // 后台预加载其他三个底部菜单，切换时不再卡顿
  useEffect(() => {
    const t = setTimeout(() => {
      for (const tab of TABS) {
        const href = withLib(tab.href);
        const isCurrent =
          tab.href === "/products"
            ? pathname === "/products"
            : pathname.startsWith(tab.href);
        if (!isCurrent) {
          try {
            router.prefetch(href);
          } catch {
            /* 忽略 */
          }
        }
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active =
            t.href === "/products"
              ? pathname === "/products"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={withLib(t.href)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                active ? "font-semibold text-blue-600" : "text-gray-500 dark:text-gray-400"
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
