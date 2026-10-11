import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function storePhoto(dataDir: string, value: unknown): string {
  if (typeof value !== 'string') throw new Error('Selecciona una imagen.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) {
    throw new Error('La foto debe ser PNG, JPEG o WebP y pesar como máximo 5 MB.');
  }
  const buffer = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'jpeg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || buffer.length > MAX_PHOTO_BYTES) throw new Error('El contenido de la imagen no es válido.');
  const name = `${createHash('sha256').update(buffer).digest('hex')}.${match[1]}`;
  const dir = path.join(dataDir, 'uploads');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!existsSync(path.join(dir, name))) writeFileSync(path.join(dir, name), buffer, { flag: 'wx', mode: 0o600 });
  return `/files/${name}`;
}

// Never delete a photo still referenced by another task or student.
export function removeUnusedPhotos(dataDir: string, candidates: string[], submissions: { photoUrl: string }[]) {
  const referenced = new Set(submissions.map(s => s.photoUrl));
  for (const candidate of new Set(candidates)) {
    if (!/^\/files\/[a-f0-9]{64}\.(png|jpeg|webp)$/.test(candidate) || referenced.has(candidate)) continue;
    try { rmSync(path.join(dataDir, 'uploads', path.basename(candidate)), { force: true }); }
    catch { console.error('No se pudo retirar una foto antigua del almacenamiento.'); }
  }
}
