export function ReportMetrics({ items }: { items: [string, string | number][] }) {
  return <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border bg-card px-4 py-3">
    <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</dd>
  </div>)}</dl>;
}
