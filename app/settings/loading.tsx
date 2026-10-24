/** 设置页加载骨架屏 */
export default function Loading() {
  return (
    <main className="page-container">
      <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="mt-4 space-y-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl bg-white dark:bg-gray-900 p-4"
          >
            <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
