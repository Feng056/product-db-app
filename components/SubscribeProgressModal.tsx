"use client";

/** 订阅进度弹窗：进度条 + 百分比 + 已同步产品数，同步中不可关闭 */
export default function SubscribeProgressModal({
  open,
  libraryName,
  copied,
  total,
  error,
  onClose,
}: {
  open: boolean;
  libraryName: string;
  copied: number;
  total: number;
  error: string;
  onClose: () => void;
}) {
  if (!open) return null;
  const percent = total > 0 ? Math.min(100, Math.round((copied / total) * 100)) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-gray-900">
        <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {error ? "订阅失败" : `正在同步「${libraryName}」`}
        </div>
        {error ? (
          <>
            <p className="mt-3 text-sm text-red-500">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white"
            >
              关闭
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              {total > 0 ? (
                <div
                  className="h-full rounded-full bg-purple-600 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-purple-600" />
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {total > 0 ? `正在同步第 ${copied}/${total} 个产品` : "正在准备…"}
              </span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {total > 0 ? `${percent}%` : "…"}
              </span>
            </div>
            <p className="mt-3 text-center text-xs text-gray-400">
              同步中请勿关闭页面
            </p>
          </>
        )}
      </div>
    </div>
  );
}
