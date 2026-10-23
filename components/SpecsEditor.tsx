"use client";

import { useState } from "react";
import type { SpecItem } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-[15px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/** 规格参数动态 key-value 编辑器 */
export default function SpecsEditor({
  initial,
}: {
  initial?: SpecItem[];
}) {
  const [specs, setSpecs] = useState<SpecItem[]>(
    initial && initial.length > 0 ? initial : [{ key: "", value: "" }]
  );

  const set = (i: number, field: "key" | "value", v: string) => {
    const next = [...specs];
    next[i] = { ...next[i], [field]: v };
    setSpecs(next);
  };
  const add = () => setSpecs([...specs, { key: "", value: "" }]);
  const remove = (i: number) => {
    if (specs.length === 1) {
      setSpecs([{ key: "", value: "" }]);
    } else {
      setSpecs(specs.filter((_, idx) => idx !== i));
    }
  };

  return (
    <div>
      <input
        type="hidden"
        name="specs"
        value={JSON.stringify(specs.filter((s) => s.key || s.value))}
      />
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">规格参数</label>
        <button
          type="button"
          onClick={add}
          className="rounded-full bg-blue-50 dark:bg-blue-950 px-3 py-1 text-sm font-medium text-blue-600"
        >
          ＋ 添加
        </button>
      </div>
      <div className="space-y-2">
        {specs.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={s.key}
              onChange={(e) => set(i, "key", e.target.value)}
              placeholder="参数名（如 功率）"
              className={inputCls}
            />
            <input
              value={s.value}
              onChange={(e) => set(i, "value", e.target.value)}
              placeholder="参数值（如 100W）"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="删除该行"
              className="shrink-0 rounded-xl bg-red-50 dark:bg-red-950 px-3 text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export { inputCls };
