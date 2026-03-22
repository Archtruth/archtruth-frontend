export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-48 rounded-md bg-muted" />
      <div className="h-4 w-full max-w-md rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
        <div className="h-28 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
