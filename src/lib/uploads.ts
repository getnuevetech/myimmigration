import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Files are stored outside the public folder and served via an access-checked route.
const UPLOAD_ROOT = path.join(process.cwd(), "var", "uploads");

// Allowlist of accepted MIME types for user-uploaded documents.
// Anything not in this list is rejected before writing to disk.
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export const INLINE_SAFE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** Safe image MIME types for embedding in printable HTML reports. */
export const REPORT_EMBED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Maximum upload size enforced across all upload paths.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_TICKET_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export function normalizeMimeType(mimeType: string | null | undefined): string {
  return (mimeType || "application/octet-stream").split(";")[0].trim().toLowerCase();
}

export function safeContentType(mimeType: string | null | undefined): string {
  const normalized = normalizeMimeType(mimeType);
  return ALLOWED_MIME_TYPES.has(normalized) ? normalized : "application/octet-stream";
}

export function validateUploadFile(
  file: File,
  options?: { maxBytes?: number; allowedMimes?: Set<string> },
): string | null {
  const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
  const allowed = options?.allowedMimes ?? ALLOWED_MIME_TYPES;
  if (file.size <= 0) return `${file.name || "File"} is empty.`;
  if (file.size > maxBytes) return `${file.name} is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  const mime = normalizeMimeType(file.type);
  if (!allowed.has(mime)) {
    return `${file.name}: file type "${mime}" is not allowed. Please upload a PDF, image, or Office document.`;
  }
  return null;
}

export function validateAvatarFile(file: File): string | null {
  return validateUploadFile(file, { maxBytes: MAX_AVATAR_BYTES, allowedMimes: AVATAR_MIME_TYPES });
}

export async function saveUpload(file: File): Promise<{ filePath: string; sizeBytes: number }> {
  // Defense in depth: never write oversized payloads even if a caller skipped validateUploadFile.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  await fs.writeFile(path.join(UPLOAD_ROOT, name), buf);
  return { filePath: name, sizeBytes: buf.length };
}

export async function saveUploadBuffer(buf: Buffer, ext: string): Promise<string> {
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  const safeExt = ext.slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const name = `${crypto.randomBytes(16).toString("hex")}${safeExt}`;
  await fs.writeFile(path.join(UPLOAD_ROOT, name), buf);
  return name;
}

export async function readUpload(filePath: string): Promise<Buffer> {
  // filePath is a generated filename; prevent traversal.
  const safe = path.basename(filePath);
  return fs.readFile(path.join(UPLOAD_ROOT, safe));
}

export async function deleteUpload(filePath: string) {
  const safe = path.basename(filePath);
  await fs.rm(path.join(UPLOAD_ROOT, safe), { force: true });
}
