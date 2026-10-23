"use client";

import { useState } from "react";
import Link from "next/link";
import {
  renameLibrary,
  deleteLibrary,
} from "@/actions/libraries";
import type { Library } from "@/lib/types";

/** 产品库切换条：横向滚动 pills + 管理（改名/删除） */
export default function LibraryBar({
  libraries,
  currentId,
  baseParams,
}: {
  libraries: Library[];
  currentId: string;
  baseParams: string;
}) {
  const [managing, setManaging] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hrefFor = (id: string) =>
    `/products?lib=${id}${baseParams ? `&${baseParams}` : ""}`;

  async function onRename(formData: FormData) {
    setError(null);
    const res = await renameLibrary(formData);
    if (res?.error) setError(res.error);
    else setRenamingId(null);
  }

  async function onDelete(id: string, name: string) {
    if (
      !window.confirm(
        `确定删除产品库「${name}」吗？库内所有产品和附件都会被删除，该操作不可恢复！`
      )
    )
      return;
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const res = await deleteLibrary(fd);
    if (res?.error) setError(res.error);
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {libraries.map((lib) => {
          const active = lib.id === currentId;
          // 管理模式下的改名输入框
          if (managing && renamingId === lib.id) {
            return (
              <form
                key={lib.id}
                action={onRename}
                className="flex shrink-0 items-center gap-1"
              >
                <input type="hidden" name="id" value={lib.id} />
                <input
                  name="name"
                  defaultValue={lib.name}
                  maxLength={30}
                  required
                  autoFocus
                  className="w-28 rounded-full border border-blue-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white"
                >
                  确定
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="shrink-0 text-xs text-gray-400 dark:text-gray-500"
                >
                  取消
                </button>
              </form>
            );
          }
          return (
            <div key={lib.id} className="flex shrink-0 items-center">
              <Link
                href={hrefFor(lib.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {lib.name}
              </Link>
              {managing && (
                <span className="ml-1 flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRenamingId(lib.id)}
                    className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs text-blue-600"
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(lib.id, lib.name)}
                    className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs text-red-500"
                  >
                    删除
                  </button>
                </span>
              )}
            </div>
          );
        })}

        {/* 管理模式切换 */}
        <button
          type="button"
          onClick={() => {
            setManaging(!managing);
            setRenamingId(null);
          }}
          className="shrink-0 text-xs text-gray-400 dark:text-gray-500 underline"
        >
          {managing ? "完成" : "管理"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
