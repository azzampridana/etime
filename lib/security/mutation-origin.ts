import "server-only";

// Shared origin policy for JSON mutations. Do not trust forwarded host/protocol headers.
export function checkMutationOrigin(request: Request): "configuration" | "cross-site" | null {
  const configuredOrigin = process.env.NEXTAUTH_URL;
  let expectedOrigin: string;
  try {
    const canonical = new URL(configuredOrigin ?? request.url);
    if (!["http:", "https:"].includes(canonical.protocol) || canonical.username || canonical.password ||
      (configuredOrigin !== undefined && (canonical.pathname !== "/" || canonical.search || canonical.hash)) ||
      (configuredOrigin !== undefined && process.env.NODE_ENV === "production" && canonical.protocol !== "https:")) {
      return "configuration";
    }
    expectedOrigin = canonical.origin;
  } catch { return "configuration"; }

  const origin = request.headers.get("origin");
  // Preserve the existing absent-Origin policy; JSON and authorization checks remain mandatory.
  let validOrigin = origin === null;
  if (origin !== null) {
    try {
      const parsed = new URL(origin);
      validOrigin = origin === parsed.origin && parsed.origin === expectedOrigin;
    } catch { validOrigin = false; }
  }
  return !validOrigin || request.headers.get("sec-fetch-site") === "cross-site" ? "cross-site" : null;
}
