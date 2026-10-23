"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  recognizeImage,
  saveRecognizedProducts,
  type RecognizedProduct,
} from "@/actions/recognize";
import { inputCls } from "@/components/SpecsEditor";

type PhotoItem = {
  id: string;
  previewUrl: string;
  base64: string; // 不含 data: 前缀
  mimeType: string;
  status: "pending" | "recognizing" | "done" | "error";
  error?: string;
  selected: boolean;
  product: RecognizedProduct;
};

const emptyProduct = (): RecognizedProduct => ({
  name: "",
  model: "",
  category: "未分类",
  specs: [],
  notes: "",
});

/** 客户端压缩图片：最长边 1024，JPEG 0.8 */
function compressImage(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxSide = 1024;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(url);
      const [head, data] = dataUrl.split(",");
      const mime = head.match(/data:(.*?);/)?.[1] || "image/jpeg";
      resolve({ base64: data, mimeType: mime, previewUrl: dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    img.src = url;
  });
}

export default function RecognizeClient({ libraryId }: { libraryId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMessage(null);
    const items: PhotoItem[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const { base64, mimeType, previewUrl } = await compressImage(f);
        items.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          previewUrl,
          base64,
          mimeType,
          status: "pending",
          selected: true,
          product: emptyProduct(),
        });
      } catch {
        // 跳过坏图
      }
    }
    if (items.length === 0) {
      setMessage("没有可用的图片");
      return;
    }
    setPhotos((prev) => [...prev, ...items]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function startRecognize() {
    const targets = photos.filter((p) => p.status === "pending" || p.status === "error");
    if (targets.length === 0) return;
    setBusy(true);
    setMessage(null);
    for (const t of targets) {
      setPhotos((prev) => prev.map((p) => (p.id === t.id ? { ...p, status: "recognizing" } : p)));
      const res = await recognizeImage(t.base64, t.mimeType);
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === t.id
            ? res.product
              ? { ...p, status: "done", product: res.product }
              : { ...p, status: "error", error: res.error || "识别失败" }
            : p
        )
      );
    }
    setBusy(false);
  }

  function updateProduct(id: string, patch: Partial<RecognizedProduct>) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, product: { ...p.product, ...patch } } : p))
    );
  }

  function toggleSelect(id: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function onSave() {
    const chosen = photos.filter((p) => p.selected && p.status === "done" && p.product.name.trim());
    if (chosen.length === 0) {
      setMessage("请先识别并勾选要保存的产品");
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await saveRecognizedProducts(
      chosen.map((p) => p.product),
      libraryId
    );
    setSaving(false);
    if (res.error) {
      setMessage(res.error);
      return;
    }
    router.push(`/products?lib=${libraryId}`);
  }

  const doneCount = photos.filter((p) => p.status === "done").length;
  const pendingCount = photos.filter((p) => p.status === "pending" || p.status === "error").length;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {/* 操作区 */}
      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white"
        >
          📷 拍照 / 选照片（{photos.length}）
        </button>
        {pendingCount > 0 && (
          <button
            onClick={startRecognize}
            disabled={busy}
            className="flex-1 rounded-2xl bg-green-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {busy ? "识别中…" : `开始识别（${pendingCount}）`}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        一次可拍多张，每张识别为一个产品；识别后可修改再批量保存
      </p>

      {message && (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{message}</div>
      )}

      {/* 结果卡片 */}
      <div className="mt-4 space-y-3">
        {photos.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-4">
            <div className="flex gap-3">
              <img src={p.previewUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                {p.status === "pending" && <p className="text-sm text-gray-400">等待识别</p>}
                {p.status === "recognizing" && <p className="text-sm text-blue-600">识别中…</p>}
                {p.status === "error" && (
                  <div>
                    <p className="text-sm text-red-500">{p.error || "识别失败"}</p>
                    <button onClick={startRecognize} className="mt-1 text-xs text-blue-600 underline">
                      重试
                    </button>
                  </div>
                )}
                {p.status === "done" && (
                  <div className="space-y-2">
                    <input
                      value={p.product.name}
                      onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                      placeholder="产品名称"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <input
                        value={p.product.model}
                        onChange={(e) => updateProduct(p.id, { model: e.target.value })}
                        placeholder="型号"
                        className={inputCls}
                      />
                      <input
                        value={p.product.category}
                        onChange={(e) => updateProduct(p.id, { category: e.target.value })}
                        placeholder="分类"
                        className={inputCls}
                      />
                    </div>
                    {p.product.specs.length > 0 && (
                      <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        {p.product.specs.map((s, i) => (
                          <div key={i} className="flex justify-between gap-2 py-0.5">
                            <span className="text-gray-400">{s.key}</span>
                            <span className="truncate">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.product.notes && (
                      <p className="text-xs text-gray-400">{p.product.notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            {p.status === "done" && (
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={() => toggleSelect(p.id)}
                    className="h-4 w-4"
                  />
                  保存这个
                </label>
                <button onClick={() => removePhoto(p.id)} className="text-xs text-red-500">
                  移除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 批量保存 */}
      {doneCount > 0 && (
        <button
          onClick={onSave}
          disabled={saving}
          className="mt-4 w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : `保存选中的产品到产品库`}
        </button>
      )}
    </div>
  );
}
