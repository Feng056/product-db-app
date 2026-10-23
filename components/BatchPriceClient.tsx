"use client";

import { useMemo, useState } from "react";
import { batchUpdatePrice } from "@/actions/products";
import { formatPrice } from "@/lib/utils";
import type { BatchProduct } from "@/app/products/batch-price/page";

type Tab = "tag" | "price" | "weight";

const TABS: { key: Tab; label: string }[] = [
  { key: "tag", label: "按标签" },
  { key: "price", label: "按同价格" },
  { key: "weight", label: "按同重量" },
];

function groupKey(p: BatchProduct, tab: Tab): string {
  if (tab === "tag") return p.tag || "无标签";
  if (tab === "weight") return p.weight || "无重量";
  return p.price == null ? "未定价" : String(p.price);
}

/** 批量改价交互：选分组 → 勾选产品 → 输入新价格 → 一键应用 */
export default function BatchPriceClient({
  products,
  libraryId,
}: {
  products: BatchProduct[];
  libraryId: string;
}) {
  const [tab, setTab] = useState<Tab>("tag");
  const [group, setGroup] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newPrice, setNewPrice] = useState("");
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, BatchProduct[]>();
    for (const p of products) {
      const k = groupKey(p, tab);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [products, tab]);

  const groupProducts = useMemo(
    () => (group == null ? [] : groups.find(([k]) => k === group)?.[1] || []),
    [groups, group]
  );

  const pickTab = (t: Tab) => {
    setTab(t);
    setGroup(null);
    setChecked(new Set());
    setMsg(null);
  };

  const pickGroup = (k: string) => {
    setGroup(k);
    const list = groups.find(([gk]) => gk === k)?.[1] || [];
    setChecked(new Set(list.map((p) => p.id)));
    setMsg(null);
  };

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const toggleAll = () => {
    if (checked.size === groupProducts.length) setChecked(new Set());
    else setChecked(new Set(groupProducts.map((p) => p.id)));
  };

  const apply = async () => {
    const price = Number(newPrice);
    if (!newPrice.trim() || !Number.isFinite(price) || price < 0) {
      setMsg({ ok: false, text: "请输入有效的价格" });
      return;
    }
    if (checked.size === 0) {
      setMsg({ ok: false, text: "请至少勾选一个产品" });
      return;
    }
    if (!window.confirm(`确定把选中的 ${checked.size} 个产品价格改为 ${price} 吗？`)) return;
    setWorking(true);
    setMsg(null);
    const res = await batchUpdatePrice(libraryId, Array.from(checked), price);
    setWorking(false);
    if (res.error) {
      setMsg({ ok: false, text: res.error });
    } else {
      setMsg({ ok: true, text: `已更新 ${res.updated} 个产品的价格` });
      setChecked(new Set());
    }
  };

  return (
    <div>
      {/* 分组方式 */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => pickTab(t.key)}
            className={`flex-1 rounded-full py-2 text-sm font-medium ${
              tab === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 分组列表 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {groups.map(([k, list]) => (
          <button
            key={k}
            onClick={() => pickGroup(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              group === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {tab === "price" && k !== "未定价" ? `¥${k}` : k}（{list.length}）
          </button>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-gray-400">当前产品库没有产品</p>
        )}
      </div>

      {/* 组内产品 */}
      {group != null && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {group} · 已选 {checked.size}/{groupProducts.length}
            </span>
            <button onClick={toggleAll} className="text-xs text-blue-600">
              {checked.size === groupProducts.length ? "全不选" : "全选"}
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {groupProducts.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3"
              >
                <input
                  type="checkbox"
                  checked={checked.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.name}</span>
                <span className="text-sm font-medium text-gray-500">{formatPrice(p.price)}</span>
              </label>
            ))}
          </div>

          {/* 改价 */}
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-gray-700">新价格</label>
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              inputMode="decimal"
              placeholder="输入统一的新价格"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-blue-500"
            />
            <button
              onClick={apply}
              disabled={working}
              className="mt-3 w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {working ? "修改中…" : `一键改价（${checked.size} 个）`}
            </button>
            {msg && (
              <p className={`mt-2 text-center text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>
                {msg.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
