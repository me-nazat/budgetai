export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
    </div>
  );
}
