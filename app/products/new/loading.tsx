/** 新增页加载骨架屏 */
export default function Loading() {
  return (
    <main className="page-container">
      <div className="h-7 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      <div className="mt-4 flex animate-pulse gap-2">
        <div className="h-10 flex-1 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-10 flex-1 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="mt-4 animate-pulse rounded-2xl bg-white dark:bg-gray-900 p-4">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="mt-1.5 h-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
