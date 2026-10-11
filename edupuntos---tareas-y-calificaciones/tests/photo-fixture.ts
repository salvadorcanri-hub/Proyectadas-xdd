import type { Page } from '@playwright/test';

// Synthetic printed mark: exercises the actual OCR engine, not recognition of handwriting.
export async function markedPhoto(page: Page, grade: string) {
  const data = await page.evaluate(mark => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white'; context.fillRect(0, 0, 1000, 600);
    context.fillStyle = '#111'; context.font = 'bold 80px Arial'; context.fillText(`NOTA: ${mark}`, 90, 160);
    context.font = '32px Arial'; context.fillText('Tarea corregida en clase', 90, 280);
    context.fillText('Ejercicio: fracciones equivalentes', 90, 350);
    context.fillText('1/2 = 2/4', 90, 430);
    return canvas.toDataURL('image/png').split(',')[1];
  }, grade);
  return { name: 'tarea-corregida.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}
