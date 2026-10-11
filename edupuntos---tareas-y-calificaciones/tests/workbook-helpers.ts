import writeXlsxFile from 'write-excel-file/universal';
import { readWorkbookBytes } from '../src/services/excel-file';
export async function workbookBuffer(rows: (string | number | null)[][]) {
  return Buffer.from(await (await writeXlsxFile(rows).toBlob()).arrayBuffer());
}
export const readWorkbook = (bytes: Uint8Array) => readWorkbookBytes(bytes) as Promise<(string | number | null)[][]>;
