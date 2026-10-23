// 最小 Service Worker：满足 PWA 可安装条件，不做缓存（避免动态数据过期）
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 空 fetch handler：仅用于通过 PWA 安装检测
self.addEventListener("fetch", () => {});
