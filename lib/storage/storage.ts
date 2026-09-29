import "server-only";

export interface StorageService {
  upload(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
// Delivery URLs identify persisted evidence, never raw filesystem/storage paths.
export function overtimePhotoUrl(id: string, event: "check-in" | "check-out") {
  return `/api/overtime/${id}/photo/${event}`;
}
