"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * 保存到桌面（PWA 安装），只放在设置页的显示设置折叠区里：
 * 不自动弹任何框，只有用户点「保存到桌面」时才弹快捷安装框；点过并保存后显示「已保存」，
 * 仍留在折叠区里，桌面图标不小心删了可以点「重新保存」再存一次。
 * 从桌面图标打开（独立显示 / iOS standalone / 安卓 App 壳子）时彻底隐藏，首屏也不闪一下。
 * 安卓 Chrome 有安装事件时点按钮直接弹安装框；苹果手机没有程序化安装入口，点按钮显示三步操作提示；
 * 浏览器无法检测“已存图标但用浏览器打开”，苹果流程靠用户点「我已添加」手动确认。
 */
function detectAppShell(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  // 安卓 WebView（APK 壳子）的 UA 带 "; wv)"，普通 Chrome 浏览器没有
  if (/; wv\)/.test(window.navigator.userAgent)) return true;
  return false;
}
export default function InstallButton() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [msg, setMsg] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const standalone = detectAppShell();
    // 浏览器无法检测“已存图标但用浏览器打开”的情况，只能靠用户手动确认
    let manual = false;
    try {
      manual = window.localStorage.getItem("pwa-added-manually") === "1";
    } catch {
      manual = false;
    }
    setIsStandalone(standalone);
    setInstalled(standalone || manual);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      // 系统确认安装后同样持久化，避免刷新后卡片重现
      try {
        window.localStorage.setItem("pwa-added-manually", "1");
      } catch {
        /* 忽略 */
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setReady(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function persistAdded() {
    try {
      window.localStorage.setItem("pwa-added-manually", "1");
    } catch {
      /* 忽略 */
    }
  }

  async function onClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        // 确认即视为已添加，持久化：刷新/重进后不再冒出来，折叠区里留已保存记录
        persistAdded();
      } else {
        setMsg("已取消，随时可以再点");
      }
      setDeferred(null);
      return;
    }
    if (isIOS) {
      setShowIOSHelp((v) => !v);
      return;
    }
    setMsg("请在手机浏览器中打开本页，再用浏览器的安装 / 添加到主屏幕功能");
  }

  async function onResave() {
    // 已保存后想再存一次：有安装事件就弹快捷框，没有就给一句实话
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome !== "accepted") setMsg("已取消，随时可以再点");
      setDeferred(null);
      return;
    }
    if (isIOS) {
      setShowIOSHelp((v) => !v);
      return;
    }
    setMsg("暂无安装入口，应用可能已安装");
  }

  function onManualAdded() {
    persistAdded();
    setShowIOSHelp(false);
    setInstalled(true);
  }

  if (!ready || isStandalone) return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            保存到桌面
            {installed && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                已保存
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {installed
              ? "桌面图标不小心删了？点重新保存可以再存一次"
              : "装到手机桌面，下次点图标直接打开，不用再输网址"}
          </p>
        </div>
        <button
          type="button"
          onClick={installed ? onResave : onClick}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {installed ? "重新保存" : "保存到桌面"}
        </button>
      </div>
      {showIOSHelp && isIOS && (
        <>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <li>点浏览器底部的分享按钮</li>
            <li>选「添加到主屏幕」</li>
            <li>点右上角「添加」，图标就出现在桌面了</li>
          </ol>
          <button
            type="button"
            onClick={onManualAdded}
            className="mt-3 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            我已添加，不再显示
          </button>
        </>
      )}
      {msg && <p className="mt-2 text-xs text-gray-400">{msg}</p>}
    </div>
  );
}
