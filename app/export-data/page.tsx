"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { exportDeactivatedData, claimPendingExport } from "@/actions/auth";
import { inputCls } from "@/components/SpecsEditor";

type ExportItem = {
  library_name: string;
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: Record<string, string>;
  notes: string;
};

function toRow(p: ExportItem) {
  const specs = p.specs || {};
  return {
    产品库: p.library_name,
    名称: p.name,
    型号: p.model || "",
    分类: p.category || "",
    价格: p.price ?? "",
    品牌: specs["品牌"] || "",
    规格: specs["规格"] || "",
    标签: specs["标签"] || "",
    单位: specs["单位"] || "",
    备注: p.notes || "",
  };
}

function downloadExcel(data: ExportItem[]) {
  const wb = XLSX.utils.book_new();
  const byLib = new Map<string, ExportItem[]>();
  for (const p of data) {
    if (!byLib.has(p.library_name)) byLib.set(p.library_name, []);
    byLib.get(p.library_name)!.push(p);
  }
  for (const [libName, items] of Array.from(byLib.entries())) {
    const ws = XLSX.utils.json_to_sheet(items.map(toRow));
    ws["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, libName.slice(0, 28) || "产品库");
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `我的自建库_${date}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { count: data.length, fileName };
}

function ExportDataInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoDone, setAutoDone] = useState(false);

  // token 自动领取并下载（停用时触发）
  useEffect(() => {
    if (!token || autoDone) return;
    setAutoDone(true);
    (async () => {
      setBusy(true);
      const res = await claimPendingExport(token);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      const data = (res.data || []) as ExportItem[];
      if (data.length === 0) {
        setError("你的账号下没有自建库数据");
        return;
      }
      const { count, fileName } = downloadExcel(data);
      alert(`账号已停用，已自动导出 ${count} 条自建库产品数据。\n文件保存在浏览器的下载文件夹：${fileName}`);
    })();
  }, [token, autoDone]);

  async function onSubmit(formData: FormData) {
    setError(null);
    setBusy(true);
    const res = await exportDeactivatedData(formData);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const data = (res.data || []) as ExportItem[];
    if (data.length === 0) {
      setError("你的账号下没有自建库数据");
      return;
    }
    const { count, fileName } = downloadExcel(data);
    alert(`已导出 ${count} 条产品，文件保存在浏览器的下载文件夹：${fileName}`);
  }

  if (token) {
    return (
      <main className="page-container">
        <div className="mt-10 text-center">
          <div className="text-5xl">📥</div>
          <h1 className="mt-3 text-2xl font-bold">账号已停用</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {busy ? "正在自动导出你的自建库数据…" : error ? "" : "数据已导出到下载文件夹"}
          </p>
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link href="/login" className="font-medium text-blue-600">
              返回登录
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <div className="mt-10 text-center">
        <div className="text-5xl">📥</div>
        <h1 className="mt-3 text-2xl font-bold">导出自建库数据</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          账号已停用，验证身份后可导出你的自建库
        </p>
      </div>

      <form action={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            账号
          </label>
          <input
            name="account"
            required
            placeholder="abc/123/abc123"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            密码
          </label>
          <input
            name="password"
            type="password"
            required
            placeholder="输入登录密码验证身份"
            className={inputCls}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? "导出中…" : "验证并导出"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <Link href="/login" className="font-medium text-blue-600">
          返回登录
        </Link>
      </p>
    </main>
  );
}

export default function ExportDataPage() {
  return (
    <Suspense>
      <ExportDataInner />
    </Suspense>
  );
}
