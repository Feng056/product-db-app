"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { getMultiLibraryExportData, type MultiLibraryExportItem } from "@/actions/products";
import type { Library } from "@/lib/types";

type Format = "json" | "csv" | "xlsx";

/** 导出面板：多选产品库 + 选择格式（JSON / CSV / Excel） */
export default function ExportPanel({
  libraries,
  defaultSelectedId,
}: {
  libraries: Library[];
  defaultSelectedId?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelectedId ? [defaultSelectedId] : libraries.map((l) => l.id))
  );
  const [format, setFormat] = useState<Format>("xlsx");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === libraries.length ? new Set() : new Set(libraries.map((l) => l.id))
    );
  }

  function downloadFile(filename: string, content: Blob) {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fileName(ext: string) {
    const date = new Date().toISOString().slice(0, 10);
    return selected.size === 1
      ? `${libraries.find((l) => selected.has(l.id))?.name || "产品库"}_${date}.${ext}`
      : `产品库导出_${selected.size}个库_${date}.${ext}`;
  }

  function toRow(p: MultiLibraryExportItem) {
    return {
      产品库: p.library_name,
      名称: p.name,
      型号: p.model,
      分类: p.category,
      价格: p.price ?? "",
      规格参数: p.specs.map((s) => `${s.key}: ${s.value}`).join("; "),
      备注: p.notes,
    };
  }

  async function onExport() {
    if (selected.size === 0) {
      setError("请至少选择一个产品库");
      return;
    }
    setExporting(true);
    setError(null);
    const res = await getMultiLibraryExportData(Array.from(selected));
    setExporting(false);
    if (res.error || !res.data) {
      setError(res.error || "导出失败");
      return;
    }
    if (res.data.length === 0) {
      setError("所选产品库中没有产品");
      return;
    }

    if (format === "json") {
      const data = res.data.map((p) => ({
        产品库: p.library_name,
        名称: p.name,
        型号: p.model,
        分类: p.category,
        价格: p.price,
        规格参数: p.specs,
        备注: p.notes,
        图片: p.images,
        文档: p.docs,
      }));
      downloadFile(fileName("json"), new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    } else if (format === "csv") {
      const ws = XLSX.utils.json_to_sheet(res.data.map(toRow));
      const csv = XLSX.utils.sheet_to_csv(ws);
      downloadFile(fileName("csv"), new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    } else {
      // Excel：每个产品库一个工作表
      const wb = XLSX.utils.book_new();
      const byLib = new Map<string, MultiLibraryExportItem[]>();
      for (const p of res.data) {
        if (!byLib.has(p.library_name)) byLib.set(p.library_name, []);
        byLib.get(p.library_name)!.push(p);
      }
      for (const [libName, items] of Array.from(byLib.entries())) {
        const ws = XLSX.utils.json_to_sheet(items.map(toRow));
        ws["!cols"] = [
          { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
          { wch: 10 }, { wch: 50 }, { wch: 20 },
        ];
        const sheetName = libName.slice(0, 28) || "产品库";
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      downloadFile(
        fileName("xlsx"),
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      );
    }
  }

  const formats: { value: Format; label: string; desc: string }[] = [
    { value: "xlsx", label: "Excel", desc: "每个库一个工作表" },
    { value: "csv", label: "CSV", desc: "单个表格" },
    { value: "json", label: "JSON", desc: "含图片文档路径" },
  ];

  return (
    <div>
      {/* 选择产品库 */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          选择产品库（{selected.size}/{libraries.length}）
        </span>
        <button onClick={toggleAll} className="text-xs text-blue-600">
          {selected.size === libraries.length ? "取消全选" : "全选"}
        </button>
      </div>
      <div className="space-y-2">
        {libraries.map((l) => (
          <label
            key={l.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-3 ${
              selected.has(l.id) ? "" : "opacity-50"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(l.id)}
              onChange={() => toggle(l.id)}
              className="h-5 w-5 accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{l.name}</span>
          </label>
        ))}
      </div>

      {/* 选择格式 */}
      <div className="mb-1 mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">导出格式</div>
      <div className="grid grid-cols-3 gap-2">
        {formats.map((f) => (
          <button
            key={f.value}
            onClick={() => setFormat(f.value)}
            className={`rounded-2xl border-2 p-3 text-center ${
              format === f.value
                ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                : "border-transparent bg-white dark:bg-gray-900"
            }`}
          >
            <div className={`text-sm font-semibold ${format === f.value ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
              {f.label}
            </div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{f.desc}</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <button
        onClick={onExport}
        disabled={exporting || selected.size === 0}
        className="mt-4 w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {exporting ? "正在导出…" : `导出 ${selected.size} 个库`}
      </button>
    </div>
  );
}
