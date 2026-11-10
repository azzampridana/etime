export class EmployeeHttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/employees${path}`, { method, cache: "no-store", credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  // Preserve the HTTP status even when an error response is HTML or empty.
  // A malformed successful response still has an uncertain mutation outcome.
  const result: unknown = await response.json().catch(() => null);
  if (response.status === 401) throw new EmployeeHttpError(401, "Please sign in again before modifying Employees.");
  if (response.status === 403) {
    const code = result && typeof result === "object" && "code" in result ? result.code : undefined;
    const legacyCrossSite = result && typeof result === "object" && "message" in result && result.message === "Cross-site changes are not permitted.";
    if (code === "EMPLOYEE_CROSS_SITE" || legacyCrossSite) throw new EmployeeHttpError(403,
      "Request origin rejected by security protection. Open the official ETime domain; if this persists, ask the administrator to check origin configuration.");
    throw new EmployeeHttpError(403, code === "FORBIDDEN" ? "Active ADMIN permission is required." : "Request denied. Check account permissions or contact the administrator.");
  }
  if (response.status >= 500) throw new EmployeeHttpError(response.status, "Outcome unknown. Reload and inspect Employees before retrying.");
  if (!response.ok) throw new EmployeeHttpError(response.status,
    result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : "Employee operation failed.");
  if (!result || typeof result !== "object" || !("success" in result) || result.success !== true || !("data" in result)) throw new Error("Invalid Employee response.");
  return result.data as T;
}
