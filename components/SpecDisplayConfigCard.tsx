"use client";

import { useState } from "react";
import { saveSpecDisplayConfig } from "@/actions/spec-display";

/**
 * 规格参数全局配置（仅管理员）：一处统一配置，对资料库里所有商品的规格展示生效。
 * 每行：显示开关 + ↑/↓ 点按调顺序。配置里没有的新键默认显示、排在最后。
 */
export default function SpecDisplayConfigCard({
  initialKeys,
  initialOrder,
  initialHidden,
}: {
  initialKeys: string[];
  initialOrder: string[];
  initialHidden: string[];
}) {
  const [keys, setKeys] = useState<string[]>(() => {
    const ordered = initialOrder.filter((k) => initialKeys.includes(k));
    const rest = initialKeys.filter((k) => !ordered.includes(k));
    return [...ordered, ...rest];
  });
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  const [msg, setMsg] = useState<string>("");

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    const next = [...keys];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    setKeys(next);
  };

  const toggle = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
  };

  const save = async () => {
    setMsg("保存中…");
    const res = await saveSpecDisplayConfig(keys, Array.from(hidden));
    setMsg(res.error || res.message || "");
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 p-4">
      <div className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        规格参数顺序与显示
      </div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        一处配置，对资料库里所有商品统一生效；新出现的参数默认显示、排在最后。
        只影响资料库里的展示，不影响搜索、标签筛选与导出；进销存不受影响，仍显示完整参数。
      </p>
      {keys.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">暂无规格参数</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key, i) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2"
            >
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={!hidden.has(key)}
                  onChange={() => toggle(key)}
                  className="h-4 w-4 accent-blue-600"
                />
                显示
              </label>
              <span className="flex-1 truncate text-sm font-medium">{key}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`${key}上移`}
                className="shrink-0 rounded-lg bg-white dark:bg-gray-900 px-3 py-1.5 text-sm disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === keys.length - 1}
                aria-label={`${key}下移`}
                className="shrink-0 rounded-lg bg-white dark:bg-gray-900 px-3 py-1.5 text-sm disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={save}
        className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white"
      >
        保存配置
      </button>
      {msg && (
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{msg}</p>
      )}
    </div>
  );
}
