/** 导入导出页加载骨架屏 */
export default function Loading() {
  return (
    <main className="page-container">
      <div className="h-7 w-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="mt-4 h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      <div className="mt-3 space-y-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-white dark:bg-gray-900 p-4"
          >
            <div className="h-5 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="mt-3 h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="mt-2 h-10 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
