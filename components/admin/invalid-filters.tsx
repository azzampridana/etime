import Link from "next/link";

export function InvalidFilters({ path }: { path: string }) {
  return <div role="alert" className="rounded-xl border bg-card p-5">
    <p>Please check your filters. Use valid dates, choices, and positive page numbers. Date From must not exceed Date To.</p>
    <Link href={path} className="mt-3 inline-flex min-h-11 items-center underline">Reset filters</Link>
  </div>;
}
