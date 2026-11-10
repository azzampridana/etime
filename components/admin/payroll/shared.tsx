import type { toPayrollDetail, toPayrollSummary } from "@/mappers/payroll.mapper";

export type PayrollDetail = ReturnType<typeof toPayrollDetail>;
export type PayrollSummary = ReturnType<typeof toPayrollSummary>;
export type PayrollList = { items: PayrollSummary[]; total: number; page: number; pageSize: number };
export const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const money = (value: string | bigint) => `Rp ${BigInt(value).toLocaleString("id-ID")}`;
export const period = (row: { month: number; year: number }) => `${months[row.month - 1]} ${row.year}`;
export const selectClass = "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
export const categoryColors = {
  EARNING: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  DEDUCTION: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
export function CategoryBadge({ category }: { category: PayrollDetail["items"][number]["category"] }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${categoryColors[category]}`}>{category === "EARNING" ? "Earning" : "Deduction"}</span>;
}

export function Status({ status }: { status: PayrollSummary["status"] }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status === "DRAFT" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200"}`}>{status}</span>;
}
export function Totals({ earnings, deductions, takeHome }: { earnings: string; deductions: string; takeHome: string }) {
  return <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm sm:grid-cols-3">
    {[["Total Earnings", earnings], ["Total Deductions", deductions], ["Take Home Pay", takeHome]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-semibold tabular-nums">{money(value)}</dd></div>)}
  </dl>;
}

export class PayrollHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function PayrollItemTable({ items }: { items: PayrollDetail["items"] }) {
  return <div role="region" aria-label="Rincian komponen Payroll" tabIndex={0} className="overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring">
    <table className="w-full min-w-[580px] text-sm">
      <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2">Komponen</th><th scope="col" className="px-3 py-2 text-right">Nominal (IDR)</th><th scope="col" className="px-3 py-2">Kategori</th><th scope="col" className="px-3 py-2">Asal</th></tr></thead>
      <tbody className="divide-y">{items.map(item => <tr key={item.id}><td className="px-3 py-2">{item.name}</td><td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{money(item.amount)}</td><td className="px-3 py-2 text-xs"><CategoryBadge category={item.category} /></td><td className="px-3 py-2 text-xs text-muted-foreground">{item.origin}</td></tr>)}</tbody>
    </table>
    {!items.length && <p className="p-3 text-sm text-muted-foreground">Tidak ada komponen.</p>}
  </div>;
}
// Only the documented API response is consumed; never log payroll payloads.
export async function payrollRequest<T>(path: string, method = "GET", body?: unknown, resource: "payroll" | "payroll-components" = "payroll"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/${resource}${path}`, { method, cache: "no-store", credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new PayrollHttpError(0, "Koneksi terputus. Muat ulang untuk memastikan hasil sebelum mencoba lagi."); }
  const messages: Record<number, string> = { 400: "Periksa input Payroll.", 401: "Sesi berakhir. Silakan login kembali.",
    403: "Permintaan ditolak. Periksa izin akun atau hubungi administrator.", 404: "Slip tidak ditemukan.", 409: "Data berubah atau slip periode ini sudah ada. Muat ulang sebelum melanjutkan." };
  const data: unknown = await response.json().catch(() => null);
  if (response.status === 403 && data && typeof data === "object") {
    const code = "code" in data ? data.code : undefined;
    const legacyCrossSite = "message" in data && data.message === "Cross-site payroll changes are not permitted.";
    if (code === "PAYROLL_CROSS_SITE" || legacyCrossSite) throw new PayrollHttpError(403,
      "Asal permintaan ditolak oleh perlindungan keamanan. Buka domain resmi ETime; jika tetap gagal, hubungi administrator untuk memeriksa konfigurasi origin.");
    if (code === "FORBIDDEN") throw new PayrollHttpError(403, "Akses ADMIN aktif diperlukan.");
  }
  if (!response.ok) throw new PayrollHttpError(response.status, messages[response.status] ?? "Hasil operasi belum dapat dipastikan. Muat ulang sebelum mencoba lagi.");
  if (!data || typeof data !== "object" || !("success" in data) || data.success !== true || !("data" in data)) {
    throw new PayrollHttpError(0, "Respons tidak dikenali. Muat ulang untuk memastikan hasil operasi.");
  }
  return data.data as T;
}
