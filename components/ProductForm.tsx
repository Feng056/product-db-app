"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import SpecsEditor, { inputCls } from "./SpecsEditor";
import { checkModelConflict } from "@/actions/products";
import type { DocItem, Product } from "@/lib/types";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-60"
    >
      {pending ? "保存中…" : label}
    </button>
  );
}

/** 产品新增 / 编辑表单 */
export default function ProductForm({
  product,
  imageUrls,
  action,
  libraryId,
}: {
  product?: Product;
  imageUrls?: Record<string, string>;
  action: (formData: FormData) => Promise<{ error?: string }>;
  libraryId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [keepImages, setKeepImages] = useState<string[]>(product?.images || []);
  const [keepDocs, setKeepDocs] = useState<DocItem[]>(product?.docs || []);

  const removeImage = (p: string) => setKeepImages(keepImages.filter((x) => x !== p));
  const removeDoc = (p: string) => setKeepDocs(keepDocs.filter((d) => d.path !== p));

  async function onSubmit(formData: FormData) {
    setError(null);
    // 手动填了编码且与原来不同时，先查当前用户自己的商品里是否已有该编码；
    // 有 → 弹确认框写明对方商品名，问是否替换；取消则本次保存中止，什么都不改。
    const model = String(formData.get("model") || "").trim();
    if (model && (!product || model !== product.model)) {
      const { conflictName } = await checkModelConflict(model, product?.id);
      if (conflictName) {
        const ok = window.confirm(
          `该编码已被商品「${conflictName}」使用，是否替换？\n（确认后该商品将自动生成一个新编码）`
        );
        if (!ok) {
          setError("已取消，未替换");
          return;
        }
        formData.set("confirmReplace", "1");
      }
    }
    formData.set("keepImages", JSON.stringify(keepImages));
    formData.set("keepDocs", JSON.stringify(keepDocs));
    const res = await action(formData);
    if (res?.error) setError(res.error);
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      {libraryId && !product && (
        <input type="hidden" name="library_id" value={libraryId} />
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          产品名称 <span className="text-red-500">*</span>
        </label>
        <input name="name" required defaultValue={product?.name} placeholder="如 便携蓝牙音箱" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">型号</label>
          <input name="model" defaultValue={product?.model} placeholder="如 X100" className={inputCls} />
          <p className="mt-1 text-xs text-gray-400">留空保存时自动生成 6 位编码</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">分类</label>
          <input name="category" defaultValue={product?.category} placeholder="如 音频设备" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">价格（元）</label>
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={product?.price ?? ""}
          placeholder="如 299"
          className={inputCls}
        />
      </div>

      <SpecsEditor initial={product?.specs} />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">备注</label>
        <textarea name="notes" rows={3} defaultValue={product?.notes} placeholder="补充说明…" className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">产品图片</label>
        {keepImages.length > 0 && (
          <div className="mb-2 grid grid-cols-4 gap-2">
            {keepImages.map((p) => (
              <div key={p} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrls?.[p] || ""}
                  alt=""
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(p)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-50 dark:bg-red-9500 px-1.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          name="newImages"
          accept="image/*"
          multiple
          className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 dark:bg-blue-950 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-600"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">文档附件（说明书、报价单等）</label>
        {keepDocs.length > 0 && (
          <ul className="mb-2 space-y-1">
            {keepDocs.map((d) => (
              <li
                key={d.path}
                className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <span className="truncate">📄 {d.name}</span>
                <button type="button" onClick={() => removeDoc(d.path)} className="ml-2 text-red-500">
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="file"
          name="newDocs"
          multiple
          className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-50 dark:bg-blue-950 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-600"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <SubmitButton label={product ? "保存修改" : "创建产品"} />
    </form>
  );
}
