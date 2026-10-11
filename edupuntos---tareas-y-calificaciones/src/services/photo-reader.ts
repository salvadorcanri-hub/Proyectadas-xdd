import type { Worker } from 'tesseract.js';
import type { PhotoReading } from '../types';
import { gradeFromOcr } from '../utils/photoVerification';

export type PhotoRegion = { x: number; y: number; width: number; height: number };

export async function readPhotoGrade(photo: string, signal: AbortSignal, progress: (value: number) => void, region?: PhotoRegion): Promise<PhotoReading> {
  let worker: Worker | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const stop = new Promise<never>((_, reject) => {
    abort = () => reject(new Error('Lectura cancelada.'));
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new Error('La lectura tardó demasiado.')), 30000);
  });
  try {
    if (signal.aborted) return { status: 'unavailable', grade: null, confidence: 0 };
    return await Promise.race([stop, (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js');
      const image = new Image(); image.src = photo; await image.decode();
      const source = region || { x: 0, y: 0, width: 1, height: 1 };
      const width = source.width * image.naturalWidth, height = source.height * image.naturalHeight;
      if (width < 10 || height < 10) return { status: 'uncertain', grade: null, confidence: 0 } as PhotoReading;
      const scale = Math.min(2, 1800 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, source.x * image.naturalWidth, source.y * image.naturalHeight, width, height, 0, 0, canvas.width, canvas.height);
      if (stopped || signal.aborted) throw new Error('Lectura cancelada.');
      const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin).href;
      worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`, workerBlobURL: false,
        corePath: `${base}tesseract-core-lstm.wasm.js`, langPath: base,
        errorHandler: () => abort(),
        logger: message => { if (!stopped && message.status === 'recognizing text') progress(Math.round(message.progress * 100)); },
      });
      if (stopped || signal.aborted) { await worker.terminate(); throw new Error('Lectura cancelada.'); }
      await worker.setParameters({ tessedit_pageseg_mode: region ? PSM.SINGLE_BLOCK : PSM.SPARSE_TEXT });
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const lines = data.blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({ text: line.text, confidence: line.confidence })))) || [];
      return gradeFromOcr(lines, !!region);
    })()]);
  } catch {
    return { status: 'unavailable', grade: null, confidence: 0 };
  } finally {
    stopped = true;
    clearTimeout(timer); signal.removeEventListener('abort', abort);
    if (worker) void worker.terminate();
  }
}
