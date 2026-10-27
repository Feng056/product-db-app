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

/**
 * 算组号（按顺序命中一条即定；旧型号不参与分组，只被替换）：
 * ① 50 组（任一成立）：名称含 黑（单字就够，如大黑手提袋、黑色手提都算）；
 *    分类含 垃圾袋/平口袋/黑色（按包含算，如八折垃圾袋也算）；
 *    任一标签含 垃圾袋/平口袋/黑色 → 50。
 * ② 60 组（任一成立）：名称含 海鲜；分类含 海鲜；任一标签含 海鲜 → 60。
 * ③ 特例：名称里先出现的数字串以 105 开头 → 40（如 105*97白平口）。
 * ④ 其余按名称里先出现的两位数字字符（按出现顺序取前两个数字字符，如新2060 取 20，
 *    1710白 取 17）按十年取整：10-19→10，20-29→20，30-39→30，40-99→40；
 *    名称里数字不足两位、或前两位小于 10 时不命中。
 * ⑤ 以上都不命中 → 兜底 10。
 */
export function groupOf(
  category: string,
  tags: string[],
  name?: string
): string {
  const hay = `${category || ""} ${tags.join(" ")}`;
  if (
    CODE_GROUP_KEYWORDS.some((k) => hay.includes(k)) ||
    (name || "").includes("黑")
  )
    return "50";
  if ((name || "").includes("海鲜") || hay.includes("海鲜")) return "60";
  const digits = (name || "").replace(/\D/g, "");
  if (digits.startsWith("105")) return "40";
  if (digits.length >= 2) {
    const firstTwo = Number(digits.slice(0, 2));
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
