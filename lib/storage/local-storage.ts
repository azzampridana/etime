import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, lstat, readFile, writeFile, unlink, link, realpath } from "node:fs/promises";
import path from "node:path";
import { ApplicationError } from "@/lib/errors/application-error";
import type { StorageService } from "@/lib/storage/storage";

const keyPattern = /^attendance\/overtime\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9-]{36}\/(checkin|checkout)-[a-f0-9-]{36}\.jpg$/;
export function validateStorageKey(key: string) {
  if (!keyPattern.test(key) || key.trim() !== key) throw new ApplicationError("INVALID_STORAGE_KEY", "Invalid evidence reference.");
  return key;
}
function missing(error: unknown) { return error instanceof Error && "code" in error && error.code === "ENOENT"; }
const storageError = () => new ApplicationError("STORAGE_UNAVAILABLE", "Evidence storage is unavailable. Please try again later.");

export class LocalStorage implements StorageService {
  constructor(private readonly root: string | undefined) {}
  private async resolve(key: string, create: boolean) {
    validateStorageKey(key);
    if (!this.root?.trim()) throw storageError();
    const configured = path.resolve(this.root);
    // Never serve evidence as public static assets, including a misconfigured root.
    const publicRoot = path.resolve("public");
    if (configured === publicRoot || configured.startsWith(publicRoot + path.sep)) throw storageError();
    if (create) await mkdir(configured, { recursive: true });
    const root = await realpath(configured);
    const realPublic = await realpath(publicRoot).catch(() => publicRoot);
    if (root === realPublic || root.startsWith(realPublic + path.sep)) throw storageError();
    const segments = key.split("/");
    let parent = root;
    for (const segment of segments.slice(0, -1)) {
      parent = path.join(parent, segment);
      if (create) await mkdir(parent).catch(async (error: unknown) => {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      });
      const stat = await lstat(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw storageError();
    }
    const target = path.join(parent, segments.at(-1)!);
    const stat = await lstat(target).catch((error: unknown) => { if (missing(error)) return null; throw error; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw storageError();
    return target;
  }
  async upload(key: string, data: Buffer) {
    let temporary: string | undefined;
    try {
      const target = await this.resolve(key, true);
      temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, data, { flag: "wx", mode: 0o600 });
      // Publish a complete file without overwriting an existing evidence key.
      await link(temporary, target);
    } catch { throw storageError(); }
    finally { if (temporary) await unlink(temporary).catch(() => undefined); }
  }
  async read(key: string) {
    try { return await readFile(await this.resolve(key, false)); }
    catch (error) {
      if (missing(error)) throw new ApplicationError("PHOTO_NOT_FOUND", "Photo evidence is unavailable.");
      throw storageError();
    }
  }
  async delete(key: string) {
    try { await unlink(await this.resolve(key, false)); }
    catch (error) { if (!missing(error)) throw storageError(); }
  }
}
export function getStorage(): StorageService { return new LocalStorage(process.env.STORAGE_ROOT); }
