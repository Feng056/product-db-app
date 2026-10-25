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
 */
export default function InstallButton() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
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
        <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-gray-500 dark:text-gray-400">
          <li>点浏览器底部的分享按钮</li>
          <li>选「添加到主屏幕」</li>
          <li>点右上角「添加」，图标就出现在桌面了</li>
        </ol>
      )}
      {msg && <p className="mt-2 text-xs text-gray-400">{msg}</p>}
    </div>
  );
}
