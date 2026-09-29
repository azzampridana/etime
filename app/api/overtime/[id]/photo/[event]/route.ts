import { z } from "zod";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { readOvertimePhoto } from "@/services/overtime.service";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; event: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const user = await requireUser();
    const { id, event } = await params;
    const bytes = await readOvertimePhoto(user.id, id, event);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/jpeg", "Content-Length": String(bytes.length), "Content-Disposition": 'inline; filename="overtime-evidence.jpg"' } });
  } catch (error) {
    const status = error instanceof ApplicationError ? error.code === "UNAUTHENTICATED" ? 401 : error.code === "PHOTO_NOT_FOUND" ? 404 : 503 : error instanceof z.ZodError ? 404 : 500;
    return new Response("Photo evidence is unavailable.", { status, headers });
  }
}
