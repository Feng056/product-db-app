"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Library } from "@/lib/types";
import { saveLibraryOrder } from "@/actions/libraries";

/**
 * 产品库切换条：横向滚动 pills，可左右拖动调整显示顺序。
 * 首页默认显示排在第一位的库（服务端按用户保存的顺序返回）。
 * 拖动用 pointer 事件实现，手机触屏和鼠标都可用；竖滑仍可滚动页面。
 */
export default function LibraryBar({
  libraries,
  currentId,
  baseParams,
  subCopyIds,
  updatedCopyIds,
}: {
  libraries: Library[];
  currentId: string;
  baseParams: string;
  subCopyIds?: Set<string>;
  updatedCopyIds?: Set<string>;
}) {
  const hrefFor = (id: string) =>
    `/products?lib=${id}${baseParams ? `&${baseParams}` : ""}`;

  const [order, setOrder] = useState<string[]>(libraries.map((l) => l.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const pillRefs = useRef(new Map<string, HTMLAnchorElement>());
  const orderRef = useRef<string[]>(libraries.map((l) => l.id));
  const dragState = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const justDragged = useRef(false);

  // 库集合变化（新增/删除库）时才重置顺序；顺序本身变化不重置，避免覆盖本地拖拽结果
  const idsKey = libraries.map((l) => l.id).join(",");
  useEffect(() => {
    const next = libraries.map((l) => l.id);
    orderRef.current = next;
    setOrder(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const byId = new Map(libraries.map((l) => [l.id, l]));
  const ordered: Library[] = [];
  for (const id of order) {
    const lib = byId.get(id);
    if (lib) ordered.push(lib);
  }
  for (const l of libraries) {
    if (!order.includes(l.id)) ordered.push(l);
  }

  if (libraries.length <= 1) return null;

  function applyOrder(next: string[]) {
    orderRef.current = next;
    setOrder(next);
  }

  function onPointerDown(e: React.PointerEvent<HTMLAnchorElement>, id: string) {
    // 新手势开始，清除上一轮拖拽的点击抑制标记
    justDragged.current = false;
    if (e.button !== undefined && e.button !== 0) return;
    dragState.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      st.moved = true;
      setDragId(st.id);
    }
    // 按横坐标找插入位置：其余 pill 按当前视觉顺序，取第一个中心点在指针右边的
    const dragged = ordered.find((l) => l.id === st.id);
    if (!dragged) return;
    const rest = ordered.filter((l) => l.id !== st.id);
    let insertAt = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const el = pillRefs.current.get(rest[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        insertAt = i;
        break;
      }
    }
    const next = [...rest.slice(0, insertAt), dragged, ...rest.slice(insertAt)];
    applyOrder(next.map((l) => l.id));
  }

  function endDrag(cancelled: boolean) {
    const st = dragState.current;
    dragState.current = null;
    setDragId(null);
    if (!st) return;
    if (cancelled) {
      // 被浏览器接管（如竖滑滚动）则放弃本次拖拽，恢复原顺序
      applyOrder(libraries.map((l) => l.id));
      return;
    }
    if (st.moved) {
      justDragged.current = true;
      void saveLibraryOrder(orderRef.current);
    }
  }

  function onClickCapture(e: React.MouseEvent) {
    if (justDragged.current) {
      justDragged.current = false;
      e.preventDefault();
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {ordered.map((lib) => (
          <Link
            key={lib.id}
            ref={(el) => {
              if (el) pillRefs.current.set(lib.id, el);
              else pillRefs.current.delete(lib.id);
            }}
            href={hrefFor(lib.id)}
            onPointerDown={(e) => onPointerDown(e, lib.id)}
            onPointerMove={onPointerMove}
            onPointerUp={() => endDrag(false)}
            onPointerCancel={() => endDrag(true)}
            onClickCapture={onClickCapture}
            style={{ touchAction: "pan-y" }}
            className={`relative shrink-0 select-none rounded-full px-3 py-1.5 text-xs font-medium ${
              lib.id === currentId
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            } ${dragId === lib.id ? "z-10 scale-105 shadow-lg ring-2 ring-blue-400" : ""}`}
          >
            {lib.name}
            {subCopyIds?.has(lib.id) && <span className="ml-1 opacity-70">📡</span>}
            {updatedCopyIds?.has(lib.id) && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
              </span>
            )}
          </Link>
        ))}
        <span className="shrink-0 pr-1 text-[11px] text-gray-400">拖动可排序</span>
      </div>
    </div>
  );
}
