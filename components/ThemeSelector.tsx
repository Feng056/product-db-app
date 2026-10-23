"use client";

import { useTheme, type ThemeMode } from "./ThemeProvider";

const OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
  { key: "light", label: "浅色", icon: "☀️" },
  { key: "dark", label: "深色", icon: "🌙" },
  { key: "system", label: "跟随系统", icon: "📱" },
];

/** 主题切换：浅色 / 深色 / 跟随系统 */
export default function ThemeSelector() {
  const { mode, setMode } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => setMode(o.key)}
          className={`rounded-2xl border-2 py-3 text-sm font-medium ${
            mode === o.key
              ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
              : "border-gray-100 bg-white text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
          }`}
        >
          <div className="text-xl">{o.icon}</div>
          <div className="mt-1">{o.label}</div>
        </button>
      ))}
    </div>
  );
}
