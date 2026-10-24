/** 订阅流式接口的事件（/api/subscribe，NDJSON 逐行回传） */
export type SubscribeStreamEvent =
  | { type: "progress"; copied: number; total: number }
  | { type: "done"; libraryId: string }
  | { type: "skipped"; libraryId: string }
  | { type: "error"; message: string };

/**
 * 调用流式订阅，逐行解析进度事件并回调。
 * 非流式错误（如未登录）会解析 JSON 错误体后回调 error 事件。
 */
export async function runSubscribeStream(
  body: { sourceLibraryId: string; name?: string },
  onEvent: (e: SubscribeStreamEvent) => void
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    onEvent({ type: "error", message: "网络错误，请重试" });
    return;
  }
  if (!res.ok || !res.body) {
    let message = "订阅失败";
    try {
      const j = await res.json();
      message = j.error || message;
    } catch {
      /* 忽略解析错误 */
    }
    onEvent({ type: "error", message });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const emitLine = (line: string) => {
    const t = line.trim();
    if (!t) return;
    try {
      onEvent(JSON.parse(t) as SubscribeStreamEvent);
    } catch {
      /* 忽略坏行 */
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        emitLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    }
    emitLine(buf);
  } catch {
    onEvent({ type: "error", message: "同步中断，请重试" });
  }
}
