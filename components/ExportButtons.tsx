"use client";

import * as XLSX from "xlsx";
import type { Product } from "@/lib/types";

/** 导出按钮：JSON / CSV / 导出整个库，纯前端生成下载 */
export default function ExportButtons({
  products,
  fullList,
}: {
  products: Product[];
  fullList?: Product[];
}) {
  // 整个库的产品（不受搜索/分类筛选影响），用于"导出整个库"
  const wholeLibrary = fullList && fullList.length > 0 ? fullList : products;
  function downloadFile(filename: string, content: Blob) {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson(useWhole = false) {
    const src = useWhole ? wholeLibrary : products;
    const data = src.map((p) => ({
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

  function exportCsv(useWhole = false) {
    const src = useWhole ? wholeLibrary : products;
    const rows = src.map((p) => ({
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
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => exportJson(false)}
          disabled={products.length === 0}
          className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40"
        >
          导出当前列表 JSON
        </button>
        <button
          onClick={() => exportCsv(false)}
          disabled={products.length === 0}
          className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40"
        >
          导出当前列表 CSV
        </button>
      </div>
      <button
        onClick={() => exportJson(true)}
        disabled={wholeLibrary.length === 0}
        className="w-full rounded-xl bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-40"
      >
        📦 导出整个产品库（JSON，共 {wholeLibrary.length} 个产品）
      </button>
    </div>
  );
}
