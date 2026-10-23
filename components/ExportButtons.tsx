"use client";

import * as XLSX from "xlsx";
import type { Product } from "@/lib/types";

/** 导出按钮：JSON / CSV，纯前端生成下载 */
export default function ExportButtons({ products }: { products: Product[] }) {
  function downloadFile(filename: string, content: Blob) {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const data = products.map((p) => ({
      名称: p.name,
      型号: p.model,
      分类: p.category,
      价格: p.price,
      规格参数: p.specs,
      备注: p.notes,
      图片: p.images,
      文档: p.docs,
    }));
    downloadFile(
      `产品库_${new Date().toISOString().slice(0, 10)}.json`,
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
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

  return (
    <div className="flex gap-2">
      <button
        onClick={exportJson}
        disabled={products.length === 0}
        className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40"
      >
        导出 JSON
      </button>
      <button
        onClick={exportCsv}
        disabled={products.length === 0}
        className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40"
      >
        导出 CSV
      </button>
    </div>
  );
}
