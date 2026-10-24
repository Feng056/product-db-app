"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Chip = {
  key: string;
  label: string;
  active: boolean;
  href: string;
  check: boolean;
  tag?: string;
};

const STORAGE_KEY = "tag-interaction-order";

function getOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function recordInteraction(tag: string) {
  try {
    const order = getOrder().filter((t) => t !== tag);
    order.unshift(tag);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order.slice(0, 50)));
  } catch {
    // ignore
  }
}

/** 标签筛选：按最后交互时间动态排序（选中/取消都算） */
export default function TagFilterChips({ chips }: { chips: Chip[] }) {
  const [orderedChips, setOrderedChips] = useState<Chip[]>(chips);

  useEffect(() => {
    const order = getOrder();
    if (order.length === 0) {
      // 无历史：选中在前，未选中保持原序
      setOrderedChips([
        ...chips.filter((c) => c.active),
        ...chips.filter((c) => !c.active),
      ]);
      return;
    }
    const indexOf = (tag?: string) => {
      if (!tag) return 9999;
      const i = order.indexOf(tag);
      return i === -1 ? 9999 : i;
    };
    setOrderedChips(
      [...chips].sort((a, b) => {
        // 选中组在前
        if (a.active !== b.active) return a.active ? -1 : 1;
        // 组内按最后交互时间
        return indexOf(a.tag) - indexOf(b.tag);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chips 变化时（如选中状态变了）重新排序
  useEffect(() => {
    const order = getOrder();
    const indexOf = (tag?: string) => {
      if (!tag) return 9999;
      const i = order.indexOf(tag);
      return i === -1 ? 9999 : i;
    };
    setOrderedChips(
      [...chips].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return indexOf(a.tag) - indexOf(b.tag);
      })
    );
  }, [chips]);

  return (
    <>
      {orderedChips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          onClick={() => chip.tag && recordInteraction(chip.tag)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            chip.active
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          {chip.active && chip.check ? "✓ " : ""}
          {chip.label}
        </Link>
      ))}
    </>
  );
}
