import { mkdir, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';

export const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const maxImageBytes = 8 * 1024 * 1024;

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface ImageUploadInput {
  key: string;
  bytes: Uint8Array;
  mimeType: string;
  originalName?: string;
}

export interface SavedUpload {
  filePath: string;
  publicUrl: string;
  originalName: string | null;
  mimeType: string;
}

export function getUploadDir() {
  return resolve(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'));
}

export async function saveImageUpload(input: ImageUploadInput): Promise<SavedUpload> {
  if (!allowedImageTypes.has(input.mimeType)) {
    throw new Error('Unsupported image type');
  }

  if (input.bytes.byteLength > maxImageBytes) {
    throw new Error('Image is too large');
  }

  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const extension = extensionByMimeType[input.mimeType];
  const safeKey = sanitizeFilePart(input.key) || 'image';
  const fileName = `${safeKey}-${Date.now()}-${randomSuffix()}.${extension}`;
  const filePath = join(uploadDir, fileName);

  await writeFile(filePath, input.bytes, { mode: 0o644 });

  return {
    filePath,
    publicUrl: `/uploads/${fileName}`,
    originalName: input.originalName ? basename(input.originalName).slice(0, 180) : null,
    mimeType: input.mimeType,
  };
}

function sanitizeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}
