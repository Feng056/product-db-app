"use client";

import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "newest", label: "最新发布" },
  { value: "price_asc", label: "价格从低到高" },
  { value: "price_desc", label: "价格从高到低" },
  { value: "name", label: "按名称排序" },
];

/** 排序选择器：切换时保留筛选条件，重置分页 */
export default function SortSelect({
  current,
  baseHref,
}: {
  current: string;
  baseHref: string;
}) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v === "newest" ? baseHref : `${baseHref}&sort=${v}`);
      }}
      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 outline-none"
      aria-label="排序方式"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
