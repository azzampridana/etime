import "server-only";
import { z } from "zod";

type Coordinates = { latitude: number; longitude: number };
export type ReverseGeocoder = (coordinates: Coordinates, signal: AbortSignal) => Promise<string | null>;
export const GEOCODING_TIMEOUT_MS = 2_500;

// Never log request URLs, raw errors or provider bodies: they can contain secrets.
function diagnostic(category: string, details: Record<string, string | number | boolean> = {}) {
  if (process.env.NODE_ENV === "development") {
    console.info("[reverse-geocoding]", { provider: "Geoapify", category, ...details });
  }
}

export function normalizeAddress(value: string): string | null {
  const seen = new Set<string>();
  const parts = value.split(",").map(part => part.replace(/[\s\u0000-\u001f]+/g, " ").trim()).filter(part => {
    const key = part.toLocaleLowerCase("en");
    if (!part || seen.has(key)) return false;
    seen.add(key); return true;
  });
  return Array.from(parts.join(", ")).slice(0, 500).join("") || null;
}
const responseSchema = z.object({ results: z.array(z.object({ formatted: z.string().max(10_000).optional() })).max(1) });

export function createGeoapifyGeocoder(apiKey: string | undefined, transport: typeof fetch = fetch): ReverseGeocoder {
  return async ({ latitude, longitude }, signal) => {
    const keyPresent = Boolean(apiKey?.trim());
    diagnostic("configuration", { keyPresent });
    if (!keyPresent) { diagnostic("missing_api_key"); return null; }
    const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: "json", limit: "1", apiKey: apiKey!.trim() });
    let response: Response;
    try {
      response = await transport(`https://api.geoapify.com/v1/geocode/reverse?${params}`, { signal, cache: "no-store", redirect: "error" });
    } catch {
      if (!signal.aborted) diagnostic("network_failure");
      return null;
    }
    diagnostic("http_response", { status: response.status });
    if (!response.ok) {
      diagnostic(response.status === 429 ? "rate_limit" : "http_failure", { status: response.status });
      return null;
    }
    let body: unknown;
    try { body = await response.json(); }
    catch (error) {
      if (!signal.aborted) diagnostic(error instanceof SyntaxError ? "malformed_json" : "response_read_failure");
      return null;
    }
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) { diagnostic("invalid_response_shape"); return null; }
    const result = parsed.data.results[0];
    if (!result) { diagnostic("missing_result"); return null; }
    if (!result.formatted) { diagnostic("missing_formatted_address"); return null; }
    const address = normalizeAddress(result.formatted);
    diagnostic(address ? "address_resolved" : "empty_normalized_address", { resultReturned: true, addressLength: address?.length ?? 0 });
    return address;
  };
}

/** Shared best-effort event snapshot; never called while rendering historical data. */
export async function resolveEventAddress(coordinates: Coordinates, provider: ReverseGeocoder = createGeoapifyGeocoder(process.env.GEOAPIFY_API_KEY), timeoutMs = GEOCODING_TIMEOUT_MS): Promise<string | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>(resolve => { timer = setTimeout(() => { diagnostic("timeout", { timeoutMs }); controller.abort(); resolve(null); }, timeoutMs); });
    const result = await Promise.race([Promise.resolve().then(() => provider(coordinates, controller.signal)), timeout]);
    return typeof result === "string" ? normalizeAddress(result) : null;
  } catch { diagnostic("provider_failure"); return null; }
  finally { if (timer) clearTimeout(timer); }
}
