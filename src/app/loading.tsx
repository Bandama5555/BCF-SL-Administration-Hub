export default function Loading() {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-[1280px] mx-auto">
      {/* Logo skeleton header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="px-2 py-1.5 rounded-xl bg-white shadow-sm">
          <img
            src="/bcf-logo.jpg"
            alt="Bandama Charity Foundation"
            className="h-8 w-auto object-contain opacity-60 animate-pulse"
          />
        </div>
        <div className="skeleton h-5 w-40 rounded-lg" />
      </div>

      {/* Hero skeleton */}
      <div className="skeleton h-48 w-full rounded-2xl mb-8" />

      {/* Grid skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton h-6 w-48 rounded-lg" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="h-1.5 skeleton" />
            <div className="p-5 flex flex-col gap-3">
              <div className="skeleton h-11 w-11 rounded-xl" />
              <div className="skeleton h-5 w-3/4 rounded-lg" />
              <div className="skeleton h-4 w-full rounded-lg" />
              <div className="skeleton h-4 w-5/6 rounded-lg" />
              <div className="skeleton h-px w-full my-1" style={{ background: "var(--border)" }} />
              <div className="skeleton h-4 w-1/3 rounded-lg" />
              <div className="skeleton h-7 w-1/2 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
