"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { getLibraryExportData } from "@/actions/products";
import type { Product } from "@/lib/types";

/** 导出按钮：JSON / CSV / 导出整个库（整个库按需从服务端获取） */
export default function ExportButtons({
  products,
  libraryId,
}: {
  products: Product[];
  libraryId: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function downloadFile(filename: string, content: Blob) {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toJsonRows(src: { name: string; model: string; category: string; price: number | null; specs: { key: string; value: string }[]; notes: string; images: string[]; docs: { name: string; path: string }[] }[]) {
    return src.map((p) => ({
      名称: p.name,
      型号: p.model,
      分类: p.category,
      价格: p.price,
      规格参数: p.specs,
      备注: p.notes,
      图片: p.images,
      文档: p.docs,
    }));
  }

  function exportJson() {
    downloadFile(
      `产品库_${new Date().toISOString().slice(0, 10)}.json`,
      new Blob([JSON.stringify(toJsonRows(products), null, 2)], { type: "application/json" })
    );
  }

  function exportCsv() {
    const rows = products.map((p) => ({
      名称: p.name,
      型号: p.model,
      分类: p.category,
      价格: p.price ?? "",
      规格参数: p.specs.map((s) => `${s.key}: ${s.value}`).join("; "),
      备注: p.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadFile(
      `产品库_${new Date().toISOString().slice(0, 10)}.csv`,
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
    );
  }

  async function exportWholeLibrary() {
    setExporting(true);
    setExportError(null);
    const res = await getLibraryExportData(libraryId);
    setExporting(false);
    if (res.error || !res.data) {
      setExportError(res.error || "导出失败");
      return;
    }
    downloadFile(
      `产品库_全部_${new Date().toISOString().slice(0, 10)}.json`,
      new Blob([JSON.stringify(toJsonRows(res.data), null, 2)], { type: "application/json" })
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={exportJson}
          disabled={products.length === 0}
          className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
        >
          导出当前列表 JSON
        </button>
        <button
          onClick={exportCsv}
          disabled={products.length === 0}
          className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
        >
          导出当前列表 CSV
        </button>
      </div>
      <button
        onClick={exportWholeLibrary}
        disabled={exporting}
        className="w-full rounded-xl bg-blue-50 dark:bg-blue-950 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-300 disabled:opacity-40"
      >
        {exporting ? "正在获取数据…" : "📦 导出整个产品库（JSON）"}
      </button>
      {exportError && <p className="text-xs text-red-500">{exportError}</p>}
    </div>
  );
}
