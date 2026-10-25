"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * 一键保存到桌面（PWA 安装）：
 * 安卓 Chrome 有安装事件时直接弹安装框；苹果手机没有程序化安装入口，点按钮显示三步操作提示；
 * 已经装到桌面时显示已在桌面。苹果/安卓/桌面浏览器都能点，不会点完没反应。
 * 位置：未安装时放在设置页顶部（显眼）；检测到从桌面图标打开时提示彻底隐藏；
 * 手动确认已添加（浏览器里无法检测是否存过图标）时，底部留一张可清除的记录。
 * “已安装”判定：PWA 独立打开（display-mode standalone / iOS navigator.standalone）
 * 或安卓 App 壳子（WebView，UA 带 wv 标记，如 APK 图标）——壳子里本来就是应用，不需要再提示安装。
 */
function detectAppShell(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  // 安卓 WebView（APK 壳子）的 UA 带 "; wv)"，普通 Chrome 浏览器没有
  if (/; wv\)/.test(window.navigator.userAgent)) return true;
  return false;
}
export default function InstallButton({ showWhenInstalled = false }: { showWhenInstalled?: boolean }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [manualAdded, setManualAdded] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [msg, setMsg] = useState("");

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
    setManualAdded(manual);
    setInstalled(standalone || manual);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      // 系统确认安装后同样持久化，避免刷新后上方卡片重现
      try {
        window.localStorage.setItem("pwa-added-manually", "1");
      } catch {
        /* 忽略 */
      }
      setManualAdded(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onClick() {
    if (installed) return;
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        // 确认即视为已添加，持久化：刷新/重进后上方卡片不再冒出来（下方留已在桌面记录，可清除）
        try {
          window.localStorage.setItem("pwa-added-manually", "1");
        } catch {
          /* 忽略 */
        }
        setManualAdded(true);
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

  function onManualAdded() {
    try {
      window.localStorage.setItem("pwa-added-manually", "1");
    } catch {
      /* 忽略 */
    }
    setManualAdded(true);
    setShowIOSHelp(false);
    setInstalled(true);
  }

  function onClearManual() {
    try {
      window.localStorage.removeItem("pwa-added-manually");
    } catch {
      /* 忽略 */
    }
    const standalone = detectAppShell();
    setManualAdded(false);
    setIsStandalone(standalone);
    setInstalled(standalone);
  }

  if (showWhenInstalled ? !installed || isStandalone : installed) return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">保存到桌面</div>
          <p className="mt-0.5 text-xs text-gray-400">
            装到手机桌面，下次点图标直接打开，不用再输网址
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={installed}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {installed ? "已在桌面" : "保存到桌面"}
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
      {manualAdded && (
        <button
          type="button"
          onClick={onClearManual}
          className="mt-2 w-full text-center text-xs text-gray-400"
        >
          还没添加？点此重新显示
        </button>
      )}
    </div>
  );
}
