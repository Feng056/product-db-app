/** 轻触反馈：Android 用 vibrate，iOS 无 web 震动 API，靠 CSS 按压缩放提供视觉反馈 */
export function lightTap() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    /* 忽略 */
  }
}
