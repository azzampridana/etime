import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { overtimeLocationSchema } from "@/schemas/overtime.schema";
import { ApplicationError } from "@/lib/errors/application-error";

const receiptSchema = overtimeLocationSchema.extend({
  userId: z.uuid(), targetId: z.uuid(), expiresAt: z.number().int().positive(),
  address: z.string().max(1000).nullable(),
});
export type OvertimeLocationReceipt = z.infer<typeof receiptSchema>;

function signature(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new ApplicationError("LOCATION_CONFIGURATION", "Location verification is unavailable. Please contact an administrator.");
  // Domain separation keeps this distinct from authentication token signing.
  return createHmac("sha256", secret).update(`etime:ot-location:v1:${payload}`).digest();
}

export function signOvertimeLocation(receipt: OvertimeLocationReceipt): string {
  const payload = Buffer.from(JSON.stringify(receiptSchema.parse(receipt))).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function readOvertimeLocation(token: string): OvertimeLocationReceipt {
  const invalid = () => new ApplicationError("LOCATION_INVALID", "Location verification failed. Get your location and capture a new photo.");
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) throw invalid();
  const expected = signature(payload);
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  try { return receiptSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); }
  catch { throw invalid(); }
}
