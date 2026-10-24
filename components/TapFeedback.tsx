"use client";

import { useEffect } from "react";
import { lightTap } from "@/lib/haptics";

/**
 * 全局轻触反馈：捕获阶段监听所有 button / a 的点击，
 * 触发轻微震动（Android）+ CSS :active 缩放（全平台可见）。
 */
export default function TapFeedback() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, a[href]")) {
        lightTap();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
