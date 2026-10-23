/** 产品列表加载骨架屏 */
export default function Loading() {
  return (
    <main className="page-container">
      <div className="h-7 w-24 animate-pulse rounded-lg bg-gray-100" />
      <div className="mt-3 h-11 animate-pulse rounded-full bg-gray-100" />
      <div className="mt-3 h-8 animate-pulse rounded-full bg-gray-100" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3 rounded-2xl bg-white p-3">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-1/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
