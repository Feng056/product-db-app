"use client";

import { useEffect } from "react";

/** 注册 Service Worker（PWA 可安装需要） */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
