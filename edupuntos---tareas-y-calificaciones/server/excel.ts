import type { AppState } from '../src/types';
import { createWorkbook } from '../src/services/excel';
export { importRows, workbookRows } from '../src/services/excel';
export async function exportWorkbook(state: AppState): Promise<Buffer> {
  return Buffer.from(await (await createWorkbook(state)).arrayBuffer());
}
