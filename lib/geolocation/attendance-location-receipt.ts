import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { attendanceLocationSchema } from "@/schemas/attendance.schema";
import { ApplicationError } from "@/lib/errors/application-error";

const receiptFields = {
  userId: z.uuid(), businessDate: z.iso.date(), expiresAt: z.number().int().positive(),
  address: z.string().max(1000).nullable(),
};
const receiptSchema = z.discriminatedUnion("event", [
  attendanceLocationSchema.options[0].extend(receiptFields),
  attendanceLocationSchema.options[1].extend(receiptFields),
]);
export type AttendanceLocationReceipt = z.infer<typeof receiptSchema>;

function signature(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new ApplicationError("LOCATION_CONFIGURATION", "Location verification is unavailable. Please contact an administrator.");
  return createHmac("sha256", secret).update(`etime:attendance-location:v1:${payload}`).digest();
}

export function signAttendanceLocation(receipt: AttendanceLocationReceipt): string {
  const payload = Buffer.from(JSON.stringify(receiptSchema.parse(receipt))).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function readAttendanceLocation(token: string): AttendanceLocationReceipt {
  const invalid = () => new ApplicationError("LOCATION_INVALID", "Location verification failed. Get your location again.");
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) throw invalid();
  const expected = signature(payload);
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  try { return receiptSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); }
  catch { throw invalid(); }
}
