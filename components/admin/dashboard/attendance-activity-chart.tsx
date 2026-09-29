"use client";

import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
import type { AttendanceActivityBucket } from "@/types/dashboard";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

export function AttendanceActivityChart({ buckets }: { buckets: AttendanceActivityBucket[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hasEvents = buckets.some(bucket => bucket.checkIn > 0 || bucket.checkOut > 0);

  useEffect(() => {
    if (!canvas.current || !hasEvents) return;
    const theme = getComputedStyle(canvas.current);
    const color = (token: string) => theme.getPropertyValue(token).trim();
    const chart = new Chart(canvas.current, {
      type: "line",
      data: {
        labels: buckets.map(bucket => bucket.hour),
        datasets: [
          { label: "Check In", data: buckets.map(bucket => bucket.checkIn), borderColor: color("--primary"), backgroundColor: color("--primary"), pointStyle: "circle" },
          { label: "Check Out", data: buckets.map(bucket => bucket.checkOut), borderColor: color("--chart-2"), backgroundColor: color("--chart-2"), borderDash: [5, 4], pointStyle: "rectRot" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        elements: { line: { cubicInterpolationMode: "monotone", borderWidth: 2 }, point: { radius: 2, hoverRadius: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: items => `${items[0]?.label ?? ""}–${items[0]?.label?.slice(0, 2) ?? ""}:59 WIB` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: color("--muted-foreground"), maxTicksLimit: 8, maxRotation: 0 }, title: { display: true, text: "Hour · Asia/Jakarta (WIB)", color: color("--muted-foreground") } },
          y: { beginAtZero: true, suggestedMax: 1, ticks: { precision: 0, color: color("--muted-foreground") }, grid: { color: color("--border") }, title: { display: true, text: "Events", color: color("--muted-foreground") } },
        },
      },
    });
    return () => chart.destroy();
  }, [buckets, hasEvents]);

  return <div className="min-w-0">
    <div className="relative h-64 min-w-0 sm:h-72">
      {hasEvents ? <canvas ref={canvas} role="img" aria-label="Hourly Check In and Check Out counts. Exact values are available in the hourly data table below." />
        : <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No attendance activity recorded today.</p>}
    </div>
    <div className="mt-3 flex flex-wrap justify-center gap-5 text-xs" aria-label="Activity legend">
      <span className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-primary" />Check In</span>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed border-chart-2" />Check Out</span>
    </div>
    {hasEvents && <details className="mt-4 text-xs">
      <summary className="cursor-pointer py-2 text-muted-foreground">View hourly event counts</summary>
      <div className="max-h-48 overflow-auto" tabIndex={0} role="region" aria-label="Hourly attendance counts">
        <table className="w-full text-left tabular-nums [&_th]:py-2 [&_td]:py-1">
          <caption className="sr-only">Hourly event counts in Asia/Jakarta. Each bucket spans the labeled hour through minute 59.</caption>
          <thead><tr><th scope="col">Hour (WIB)</th><th scope="col">Check In</th><th scope="col">Check Out</th></tr></thead>
          <tbody>{buckets.map(bucket => <tr key={bucket.hour}><th scope="row" className="font-normal">{bucket.hour}</th><td>{bucket.checkIn}</td><td>{bucket.checkOut}</td></tr>)}</tbody>
        </table>
      </div>
    </details>}
  </div>;
}
