"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  checkImport,
  importProducts,
  rollbackImport,
  type ExistingProduct,
  type ImportCheckItem,
  type ImportResult,
} from "@/actions/import";
import type { ImportRow, SpecItem } from "@/lib/types";

/** 表头别名 -> 标准字段 */
function buildHeaderMap() {
  const pairs: [string[], keyof ImportRow][] = [
    [["名称", "产品名称", "name", "产品名"], "name"],
    [["型号", "model", "货号"], "model"],
    [["分类", "类别", "category"], "category"],
    [["价格", "单价", "price", "售价"], "price"],
    [["规格参数", "规格", "参数", "specs"], "specs"],
    [["备注", "说明", "notes", "备注信息"], "notes"],
  ];
  const map: Record<string, keyof ImportRow> = {};
  for (const [aliases, field] of pairs) {
    for (const a of aliases) map[a.trim().toLowerCase()] = field;
  }
  return map;
}
const HEADER_ALIASES = buildHeaderMap();

/** 解析规格参数单元格：支持 JSON 或 "参数名: 参数值; ..." 格式 */
function parseSpecsCell(raw: unknown): SpecItem[] {
  if (raw === null || raw === undefined || raw === "") return [];
  const s = String(raw).trim();
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const obj = JSON.parse(s);
      if (Array.isArray(obj))
        return obj.map((x) => ({ key: String(x.key ?? ""), value: String(x.value ?? "") }));
      return Object.entries(obj).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
    } catch {
      /* fall through */
    }
  }
  return s
    .split(/[;；\n]/)
    .map((part) => {
      const idx = part.indexOf(":");
      const idxCn = part.indexOf("：");
      const sep = idx >= 0 ? idx : idxCn;
      if (sep < 0) return null;
      return {
        key: part.slice(0, sep).trim(),
        value: part.slice(sep + 1).trim(),
      };
    })
    .filter((x): x is SpecItem => Boolean(x && x.key));
}

type PreviewRow = ImportRow & {
  selected: boolean;
  index: number;
  check?: ImportCheckItem;
  overwrite: boolean; // 重复且有差异时：是否覆盖
};

function specsText(specs: SpecItem[]): string {
  return specs.map((s) => `${s.key}:${s.value}`).join("；") || "—";
}

/** 差异对比行 */
function DiffRow({ label, oldV, newV }: { label: string; oldV: string; newV: string }) {
  if (oldV === newV) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-12 shrink-0 text-gray-400">{label}</span>
      <span className="min-w-0 flex-1 truncate text-red-500 line-through">{oldV || "—"}</span>
      <span className="text-gray-300">→</span>
      <span className="min-w-0 flex-1 truncate font-medium text-green-700">{newV || "—"}</span>
    </div>
  );
}

export default function ImportClient({ libraryId }: { libraryId?: string }) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setResult(null);
    setRollbackMsg(null);
    setFileName(file.name);
    try {
      let parsed: PreviewRow[] = [];
      if (/\.json$/i.test(file.name)) {
        const text = await file.text();
        const arr = JSON.parse(text);
        const list = Array.isArray(arr) ? arr : [arr];
        parsed = list.map((item: Record<string, unknown>, index) => ({
          index,
          selected: true,
          overwrite: true,
          name: String(item["名称"] ?? item["name"] ?? ""),
          model: String(item["型号"] ?? item["model"] ?? ""),
          category: String(item["分类"] ?? item["category"] ?? "未分类"),
          price: item["价格"] ?? item["price"] === "" ? null : Number(item["价格"] ?? item["price"]),
          specs: parseSpecsCell(item["规格参数"] ?? item["specs"]),
          notes: String(item["备注"] ?? item["notes"] ?? ""),
        }));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const table = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        if (table.length < 2) throw new Error("文件中没有数据行");
        const headers = (table[0] as unknown[]).map((h) => String(h).trim().toLowerCase());
        const colIndex: Partial<Record<keyof ImportRow, number>> = {};
        headers.forEach((h, i) => {
          const field = HEADER_ALIASES[h];
          if (field && colIndex[field] === undefined) colIndex[field] = i;
        });
        if (colIndex.name === undefined) {
          throw new Error("未找到「名称」列，请检查表头（支持：名称/产品名称/name）");
        }
        parsed = (table.slice(1) as unknown[][])
          .filter((r) => r.some((c) => String(c).trim() !== ""))
          .map((r, index) => {
            const get = (f: keyof ImportRow) =>
              colIndex[f] !== undefined ? r[colIndex[f]!] : "";
            const priceRaw = String(get("price")).trim();
            return {
              index,
              selected: true,
              overwrite: true,
              name: String(get("name")).trim(),
              model: String(get("model")).trim(),
              category: String(get("category")).trim() || "未分类",
              price: priceRaw === "" ? null : Number(priceRaw),
              specs: parseSpecsCell(get("specs")),
              notes: String(get("notes")).trim(),
            };
          });
      }
      const valid = parsed.filter((r) => r.name);
      if (valid.length === 0) {
        setParseError("没有解析到有效数据，请检查文件格式");
        setRows([]);
        return;
      }
      // 检查重复
      setChecking(true);
      const check = await checkImport(valid, libraryId);
      setChecking(false);
      if (check.error) {
        setParseError(check.error);
        setRows([]);
        return;
      }
      const checkMap = new Map(check.items.map((c) => [c.index, c]));
      setRows(
        valid.map((r) => ({
          ...r,
          check: checkMap.get(r.index),
          // 有差异的默认覆盖，无变化的默认跳过（取消选中）
          selected: checkMap.get(r.index)?.status !== "same",
          overwrite: true,
        }))
      );
    } catch (e) {
      setChecking(false);
      setParseError(e instanceof Error ? `解析失败：${e.message}` : "解析失败");
      setRows([]);
    }
  }

  function toggle(i: number) {
    setRows(rows.map((r) => (r.index === i ? { ...r, selected: !r.selected } : r)));
  }
  function toggleAll() {
    const all = rows.every((r) => r.selected);
    setRows(rows.map((r) => ({ ...r, selected: !all })));
  }
  function setOverwrite(i: number, v: boolean) {
    setRows(rows.map((r) => (r.index === i ? { ...r, overwrite: v } : r)));
  }
  function setAllOverwrite(v: boolean) {
    setRows(
      rows.map((r) =>
        r.check?.status === "different" ? { ...r, overwrite: v } : r
      )
    );
  }

  async function doImport() {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;
    setImporting(true);
    const overwriteIndices = selected
      .filter((r) => r.check?.status === "different" && r.overwrite)
      .map((r) => r.index);
    const res = await importProducts(selected, libraryId, overwriteIndices);
    setImporting(false);
    setResult(res);
    setRollbackMsg(null);
    if (!res.error) setRows([]);
  }

  async function doRollback() {
    if (!result || rollingBack) return;
    if (
      !window.confirm(
        `确定撤销本次导入吗？将删除新增的 ${result.imported} 条，恢复被覆盖的 ${result.updated} 条到之前的数据。`
      )
    )
      return;
    setRollingBack(true);
    const res = await rollbackImport(result.importedIds, result.updatedIds, libraryId);
    setRollingBack(false);
    if (res.error) {
      setRollbackMsg(`回退失败：${res.error}`);
    } else {
      setRollbackMsg(`已回退：恢复 ${res.restored} 条，删除新增 ${res.deleted} 条`);
      setResult(null);
    }
  }

  const diffCount = rows.filter((r) => r.check?.status === "different").length;
  const sameCount = rows.filter((r) => r.check?.status === "same").length;
  const newCount = rows.filter((r) => r.check?.status === "new").length;

  return (
    <div>
      <p className="text-xs text-gray-500">
        支持 Excel（.xlsx/.xls）、CSV、JSON。重复产品可对比差异后选择覆盖或跳过，覆盖前自动备份，可一键回退。
        {libraryId ? "" : "将导入到默认产品库。"}
      </p>

      <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
        <div className="text-3xl">📥</div>
        <div className="mt-2 text-sm font-medium text-gray-700">
          {fileName || "点击选择文件"}
        </div>
        <div className="mt-1 text-xs text-gray-400">.xlsx / .xls / .csv / .json</div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      <details className="mt-3 rounded-2xl bg-white p-4 text-xs text-gray-500">
        <summary className="cursor-pointer font-medium text-gray-700">
          表头格式说明（点击展开）
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>必填列：名称（别名：产品名称 / name）</li>
          <li>可选列：型号、分类、价格、备注、规格参数</li>
          <li>规格参数单元格格式示例：功率: 100W; 电压: 220V（或 JSON）</li>
          <li>JSON 文件示例：[{`{ "名称": "音箱", "型号": "X100", "价格": 299 }`}]</li>
        </ul>
      </details>

      {parseError && (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {parseError}
        </div>
      )}

      {checking && (
        <div className="mt-4 text-center text-sm text-gray-500">正在检查重复…</div>
      )}

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              新增 {newCount} · 有差异 {diffCount} · 无变化 {sameCount}
            </span>
            <button onClick={toggleAll} className="text-sm text-blue-600">
              {rows.every((r) => r.selected) ? "取消全选" : "全选"}
            </button>
          </div>
          {diffCount > 0 && (
            <div className="mt-2 flex gap-2 text-xs">
              <button
                onClick={() => setAllOverwrite(true)}
                className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-600"
              >
                有差异的全部覆盖
              </button>
              <button
                onClick={() => setAllOverwrite(false)}
                className="rounded-full bg-gray-100 px-3 py-1.5 font-medium text-gray-600"
              >
                有差异的全部跳过
              </button>
            </div>
          )}

          <div className="mt-2 space-y-2">
            {rows.slice(0, 50).map((r) => {
              const st = r.check?.status || "new";
              const ex: ExistingProduct | null = r.check?.existing || null;
              return (
                <div
                  key={r.index}
                  className={`rounded-2xl bg-white p-3 ${r.selected ? "" : "opacity-50"}`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggle(r.index)}
                      className="mt-1 h-5 w-5 accent-blue-600"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{r.name}</span>
                        {st === "new" && (
                          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-600">
                            新增
                          </span>
                        )}
                        {st === "same" && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                            无变化
                          </span>
                        )}
                        {st === "different" && (
                          <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">
                            有差异
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {r.model || "—"} · {r.category}
                        {r.price !== null && ` · ¥${r.price}`}
                      </div>
                    </div>
                  </label>

                  {st === "different" && ex && (
                    <div className="mt-2 rounded-xl bg-gray-50 p-3">
                      <div className="mb-1.5 text-xs font-medium text-gray-500">
                        差异对比（旧 → 新）
                      </div>
                      <div className="space-y-1">
                        <DiffRow label="型号" oldV={ex.model} newV={r.model} />
                        <DiffRow label="分类" oldV={ex.category} newV={r.category} />
                        <DiffRow
                          label="价格"
                          oldV={ex.price == null ? "" : String(ex.price)}
                          newV={r.price == null ? "" : String(r.price)}
                        />
                        <DiffRow label="规格" oldV={specsText(ex.specs)} newV={specsText(r.specs)} />
                        <DiffRow label="备注" oldV={ex.notes} newV={r.notes} />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setOverwrite(r.index, true)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            r.overwrite
                              ? "bg-orange-500 text-white"
                              : "bg-white text-gray-600"
                          }`}
                        >
                          覆盖
                        </button>
                        <button
                          onClick={() => setOverwrite(r.index, false)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            !r.overwrite
                              ? "bg-gray-500 text-white"
                              : "bg-white text-gray-600"
                          }`}
                        >
                          跳过
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {rows.length > 50 && (
              <p className="text-center text-xs text-gray-400">
                仅显示前 50 行，共 {rows.length} 行
              </p>
            )}
          </div>

          <button
            onClick={doImport}
            disabled={importing || rows.every((r) => !r.selected)}
            className="mt-4 w-full rounded-2xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:opacity-50"
          >
            {importing ? "导入中…" : "开始导入选中项"}
          </button>
        </>
      )}

      {result && (
        <div
          className={`mt-4 rounded-2xl p-4 text-sm ${
            result.error ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
          }`}
        >
          {result.error ? (
            result.error
          ) : (
            <>
              <div className="font-semibold">
                导入完成：新增 {result.imported} 条，覆盖更新 {result.updated} 条，跳过{" "}
                {result.skipped} 条
              </div>
              {result.skippedNames.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs">
                  {result.skippedNames.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                  {result.skipped > result.skippedNames.length && (
                    <li>…等共 {result.skipped} 条</li>
                  )}
                </ul>
              )}
              {(result.imported > 0 || result.updated > 0) && (
                <button
                  onClick={doRollback}
                  disabled={rollingBack}
                  className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  {rollingBack ? "回退中…" : "↩ 撤销本次导入（恢复到之前）"}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {rollbackMsg && (
        <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-center text-sm text-blue-700">
          {rollbackMsg}
        </div>
      )}
    </div>
  );
}
