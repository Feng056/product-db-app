import type { SpecItem } from "./types";

/** 规格展示全局配置：顺序 + 隐藏键，存在 system_settings 的 spec_display_config 行里 */
export type SpecDisplayConfig = { order: string[]; hidden: string[] };

export const SPEC_DISPLAY_KEY = "spec_display_config";

/** 常见规格键：配置列表里兜底出现，即使当前没有任何商品用它 */
export const COMMON_SPEC_KEYS = ["品牌", "规格", "标签", "单位"];

function cleanKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (typeof k !== "string") continue;
    const t = k.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 解析存储的配置；缺失/非法时 fail-soft 回默认（全部显示、原顺序） */
export function parseSpecDisplayConfig(value: unknown): SpecDisplayConfig {
  if (typeof value !== "string") return { order: [], hidden: [] };
  try {
    const v = JSON.parse(value) as { order?: unknown; hidden?: unknown };
    return { order: cleanKeys(v?.order), hidden: cleanKeys(v?.hidden) };
  } catch {
    return { order: [], hidden: [] };
  }
}

/**
 * 对资料库展示用的规格排序 + 过滤：
 * - hidden 里的键不显示（只影响展示，不动数据与筛选）
 * - 已配置的键按配置顺序排在前面；配置里没有的新键默认显示、按原相对顺序排在后面
 */
export function applySpecDisplay(specs: SpecItem[], config: SpecDisplayConfig): SpecItem[] {
  const hidden = new Set(config.hidden);
  const orderIdx = new Map<string, number>();
  config.order.forEach((k, i) => {
    if (!orderIdx.has(k)) orderIdx.set(k, i);
  });
  return specs
    .filter((s) => !hidden.has(s.key))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ai = orderIdx.get(a.s.key);
      const bi = orderIdx.get(b.s.key);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.i - b.i;
    })
    .map((x) => x.s);
}
