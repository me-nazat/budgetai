export function AppSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg bg-white/[0.04]" />
        <div className="h-8 w-32 rounded-lg bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.04] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04]" />
              <div className="h-4 w-24 rounded bg-white/[0.04]" />
            </div>
            <div className="h-8 w-32 rounded bg-white/[0.04]" />
            <div className="h-3 w-20 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white/[0.03] border border-white/[0.04] h-[320px]" />
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.04] h-[320px]" />
      </div>
      <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.04] space-y-3">
        <div className="h-6 w-40 rounded bg-white/[0.04]" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="w-8 h-8 rounded-full bg-white/[0.04]" />
            <div className="flex-1 h-4 rounded bg-white/[0.04]" />
            <div className="w-24 h-4 rounded bg-white/[0.04]" />
            <div className="w-20 h-4 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
