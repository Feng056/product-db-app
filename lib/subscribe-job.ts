import { runSubscribeStream } from "@/lib/subscribe-stream";

/**
 * 后台订阅任务 store（模块级单例，SPA 内切页不中断）。
 * 点订阅后任务在后台跑，不弹阻塞窗口；跑完后“刷新订阅”才可点，
 * 未跑完时进度条显示在刷新订阅控件里且不可点击。
 */
export type SubscribeJob = {
  sourceId: string;
  sourceName: string;
  status: "running" | "done" | "error";
  copied: number;
  total: number;
  copyId?: string;
  error?: string;
};

let job: SubscribeJob | null = null;
let hidden = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function getSubscribeJob(): SubscribeJob | null {
  return job;
}

export function isSubscribeJobHidden(): boolean {
  return hidden;
}

export function subscribeToJob(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 开始后台订阅（已有任务在跑时忽略，保证一次只跑一个同步） */
export function startSubscribeJob(sourceId: string, sourceName: string): void {
  if (job && job.status === "running") return;
  hidden = false;
  job = { sourceId, sourceName, status: "running", copied: 0, total: 0 };
  emit();
  void runSubscribeStream({ sourceLibraryId: sourceId }, (e) => {
    if (!job) return;
    if (e.type === "progress") {
      job = { ...job, copied: e.copied, total: e.total };
    } else if (e.type === "done" || e.type === "skipped") {
      job = { ...job, status: "done", copied: job.total, copyId: e.libraryId };
    } else if (e.type === "error") {
      job = { ...job, status: "error", error: e.message };
    }
    emit();
  });
}

/** 仅隐藏悬浮条，任务继续在后台跑 */
export function hideSubscribeJob(): void {
  hidden = true;
  emit();
}

export function clearSubscribeJob(): void {
  job = null;
  hidden = false;
  emit();
}
