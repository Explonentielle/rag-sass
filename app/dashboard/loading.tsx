// Next.js App Router convention: shown automatically (via Suspense) while
// navigating to any page under app/dashboard/* that's still fetching its
// server data — the sidebar/layout stay mounted, only this content area
// swaps in, so a slow page load (Supabase queries, etc.) has visible
// feedback instead of looking frozen.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700"
        role="status"
        aria-label="Chargement"
      />
    </div>
  );
}
