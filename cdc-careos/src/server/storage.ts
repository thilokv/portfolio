/**
 * Private document storage. Files live OUTSIDE the public web root and are
 * only served through the authorized route /api/documents/[id].
 * The local-disk driver suits a single-server deployment; for serverless
 * hosting swap in an S3/Supabase Storage driver with the same interface
 * (private bucket, server-side access only) — see docs/DEPLOYMENT.md.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");

/** Detects the real file type from its first bytes (never trust the browser). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export function validateUpload(buf: Buffer): { ok: true; mime: string } | { ok: false; error: string } {
  if (buf.length === 0) return { ok: false, error: "validation.file" };
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, error: "validation.fileSize" };
  const mime = sniffMime(buf);
  if (!mime || !ALLOWED_UPLOAD_TYPES[mime]) return { ok: false, error: "validation.fileType" };
  return { ok: true, mime };
}

export async function putObject(orgId: string, buf: Buffer, mime: string) {
  const key = `${orgId}/${randomUUID()}.${ALLOWED_UPLOAD_TYPES[mime]}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
  await writeFile(full, buf, { mode: 0o600 });
  return { key, sha256: createHash("sha256").update(buf).digest("hex") };
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

function resolveKey(key: string) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(key)) throw new Error("Invalid storage key");
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Path traversal blocked");
  return full;
}
