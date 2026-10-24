"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 顶部加载进度条：点击站内链接时立即出现（不定式滑动动画），
 * 路由切换完成（pathname 变化）后淡出。
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 导航完成 → 短暂延迟后隐藏
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 250);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]);

  // 捕获点击站内链接 → 显示
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        anchor.getAttribute("target") !== "_blank"
      ) {
        setVisible(true);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed left-0 right-0 top-0 z-[100] h-0.5 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="route-progress-bar h-full w-1/3 rounded-r-full bg-blue-600" />
    </div>
  );
}
