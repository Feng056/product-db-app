/** 人民币金额格式化 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || Number.isNaN(price)) return "—";
  return `¥${Number(price).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** 日期时间格式化 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { hour12: false });
}

/** 生成随机邀请码，如 WELCOME-A3F9K2 */
export function generateInviteCode(prefix = "CODE"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

/** 规范化库名：小写 + 去掉空白、标点、符号，用于重名比对（防加空格标点绕过） */
export function normalizeLibraryName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /[\s~`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?！￥……（）——【】；：‘’“”，。、？·×÷§©®™★☆♠♥♦♣●○◆◇■□▲△▼▽◀▶◁▷⟨⟩《》〈〉「」『』【】〖〗〔〕［］｛｝（）～！@#￥%…&*—+=|、]/g,
      ""
    );
}
