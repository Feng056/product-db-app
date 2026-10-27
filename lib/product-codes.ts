import type { SpecItem } from "./types";

/** 编码规则：6 位数字字符串 = 2 位组号 + 4 位组内序号（零填充）。 */
export const CODE_GROUP_KEYWORDS = ["垃圾袋", "平口袋", "黑色"] as const;

/** 取商品的全部标签值（specs 里 key=标签 的行）。 */
export function tagsOf(specs: SpecItem[] | null | undefined): string[] {
  if (!Array.isArray(specs)) return [];
  return specs
    .filter((s) => s && s.key === "标签")
    .map((s) => String(s.value || ""));
}

/** 名称含 杯袋 / 单杯 → 10 组（按包含算）。 */
export const NAME_GROUP_KEYWORDS = ["杯袋", "单杯"] as const;

/**
 * 算组号（按顺序命中一条即定）：
 * ① 50 组（任一成立）：名称含 黑（单字就够，如大黑手提袋、黑色手提都算）；
 *    分类含 垃圾袋/平口袋/黑色（按包含算，如八折垃圾袋也算）；
 *    任一标签含 垃圾袋/平口袋/黑色 → 50。
 * ② 名称含 杯袋 / 单杯 → 10。
 * ③ 原型号开头两位数字（是数字才算）按十年取整：10-19→10，20-29→20，30-39→30，40-99→40。
 * ④ 以上都不命中 → 兜底 10。
 * 新建时没有原型号，只走 ①②④。
 */
export function groupOf(
  category: string,
  tags: string[],
  name?: string,
  oldModel?: string
): string {
  const hay = `${category || ""} ${tags.join(" ")}`;
  if (
    CODE_GROUP_KEYWORDS.some((k) => hay.includes(k)) ||
    (name || "").includes("黑")
  )
    return "50";
  if (NAME_GROUP_KEYWORDS.some((k) => (name || "").includes(k)))
    return "10";
  const m = (oldModel || "").match(/^(\d)(\d)/);
  if (m) {
    const firstTwo = Number(m[1] + m[2]);
    if (firstTwo >= 10 && firstTwo <= 19) return "10";
    if (firstTwo >= 20 && firstTwo <= 29) return "20";
    if (firstTwo >= 30 && firstTwo <= 39) return "30";
    if (firstTwo >= 40 && firstTwo <= 99) return "40";
  }
  return "10";
}

/** 是否为本组格式良好的编码（组号 + 4 位数字）。 */
export function isGroupCode(model: string, group: string): boolean {
  return new RegExp(`^${group}\\d{4}$`).test(model || "");
}

/** 从组内编码取序号；非本组格式返回 null。 */
export function seqOf(model: string, group: string): number | null {
  if (!isGroupCode(model, group)) return null;
  return Number(model.slice(2));
}

/** 组号 + 序号拼成 6 位编码（序号零填充 4 位）。 */
export function formatCode(group: string, seq: number): string {
  return `${group}${String(seq).padStart(4, "0")}`;
}
