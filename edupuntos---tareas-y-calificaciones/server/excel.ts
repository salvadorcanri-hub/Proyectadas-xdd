import * as XLSX from 'xlsx';
import type { AppState } from '../src/types';
import { createWorkbook } from '../src/services/excel';
export { importRows, workbookRows } from '../src/services/excel';
export function exportWorkbook(state: AppState): Buffer {
  return XLSX.write(createWorkbook(state), { type: 'buffer', bookType: 'xlsx' });
}
