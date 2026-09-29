"use client";

import { useEffect, useRef } from "react";
import { Chart, DoughnutController, ArcElement, Tooltip } from "chart.js";

Chart.register(DoughnutController, ArcElement, Tooltip);

export function OvertimeDistributionChart({ authorized, inProgress, completed }: { authorized: number; inProgress: number; completed: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const total = authorized + inProgress + completed;
  useEffect(() => {
    if (!canvas.current || total === 0) return;
    const theme = getComputedStyle(canvas.current);
    const chart = new Chart(canvas.current, {
      type: "doughnut",
      data: {
        labels: ["Authorized", "In Progress", "Completed"],
        datasets: [{ data: [authorized, inProgress, completed], backgroundColor: ["--chart-1", "--chart-3", "--primary"].map(token => theme.getPropertyValue(token).trim()), borderWidth: 0, spacing: 3, hoverOffset: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: "78%", plugins: { legend: { display: false } } },
    });
    return () => chart.destroy();
  }, [authorized, inProgress, completed, total]);

  return <div>
    <div className="relative mx-auto h-52 w-full max-w-52">
      {total > 0 ? <>
        <canvas ref={canvas} role="img" aria-label="Overtime distribution. Exact category counts are listed below." />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><p className="text-3xl font-semibold tabular-nums">{total}</p><p className="text-xs text-muted-foreground">OT Records</p></div>
      </> : <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">No overtime activity today.</p>}
    </div>
    <dl className="mt-5 space-y-3 text-sm">
      {([ ["Authorized", authorized, "bg-chart-1"], ["In Progress", inProgress, "bg-chart-3"], ["Completed", completed, "bg-primary"] ] as const).map(([label, count, color]) => <div key={label} className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-2"><span aria-hidden="true" className={`size-2.5 rounded-full ${color}`} />{label}</dt><dd className="font-semibold tabular-nums">{count}</dd>
      </div>)}
    </dl>
  </div>;
}
