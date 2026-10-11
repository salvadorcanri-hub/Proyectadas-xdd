import { Unzip, UnzipInflate, zipSync } from 'fflate';
import { SaxesParser } from 'saxes';
import { readSheet } from 'read-excel-file/universal';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 10001;
const MAX_COLUMNS = 256;
const MAX_CELLS = 100000;
const invalid = () => new Error('Archivo inválido o demasiado grande. Usa XLSX o CSV: máximo 5 MB, 10000 filas, 256 columnas y 100000 celdas.');

function validateXml(xml: string) {
  const parser = new SaxesParser();
  let depth = 0, nodes = 0, rows = 0, cells = 0;
  const cellAddress = (address: string) => {
    const match = /^([A-Z]{1,3})([1-9][0-9]{0,4})$/.exec(address);
    if (!match) throw invalid();
    const column = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
    if (column > MAX_COLUMNS || Number(match[2]) > MAX_ROWS) throw invalid();
  };
  parser.on('doctype', () => { throw invalid(); });
  parser.on('error', () => { throw invalid(); });
  parser.on('opentag', tag => {
    if (++depth > 64 || ++nodes > 500000) throw invalid();
    const name = tag.name.split(':').pop();
    if (name === 'row') {
      if (++rows > MAX_ROWS) throw invalid();
      const r = tag.attributes.r;
      if (r !== undefined && (!/^[1-9][0-9]{0,4}$/.test(r as string) || Number(r) > MAX_ROWS)) throw invalid();
    }
    if (name === 'c') {
      if (++cells > MAX_CELLS || typeof tag.attributes.r !== 'string') throw invalid();
      cellAddress(tag.attributes.r);
    }
    if (name === 'dimension' && typeof tag.attributes.ref === 'string') {
      for (const address of tag.attributes.ref.split(':')) cellAddress(address);
    }
  });
  parser.on('closetag', () => { depth--; });
  parser.write(xml).close();
}

// Stream every entry under a cumulative budget. Rebuild the archive from the
// checked bytes so a forged central directory cannot change what the reader sees.
function boundedWorkbook(bytes: Uint8Array): ArrayBuffer {
  const files: Record<string, Uint8Array> = Object.create(null);
  let expanded = 0, entries = 0, completed = 0;
  const unzip = new Unzip(file => {
    if (++entries > 256 || file.name.length > 200 || file.name.split('/').some(p => p === '..' || p === '__proto__') || Object.hasOwn(files, file.name)) throw invalid();
    files[file.name] = new Uint8Array();
    const parts: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, data, final) => {
      if (error) throw invalid();
      size += data.length; expanded += data.length;
      if (expanded > MAX_EXPANDED_BYTES || size > 8 * 1024 * 1024) { file.terminate(); throw invalid(); }
      parts.push(data);
      if (final) {
        completed++;
        const content = new Uint8Array(size); let offset = 0;
        for (const part of parts) { content.set(part, offset); offset += part.length; }
        if (/\.(xml|rels)$/i.test(file.name)) validateXml(new TextDecoder('utf-8', { fatal: true }).decode(content));
        files[file.name] = content;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let i = 0; i < bytes.length; i += 1024) unzip.push(bytes.subarray(i, i + 1024), i + 1024 >= bytes.length);
  if (entries !== completed || !files['xl/workbook.xml'] || !files['[Content_Types].xml']) throw invalid();
  // Stored (uncompressed) output has a bounded, verified size.
  return zipSync(files, { level: 0 }).buffer as ArrayBuffer;
}

function csvRows(text: string): string[][] {
  // A small bounded state machine supports quoted fields and embedded newlines.
  let delimiter = ',', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') inQuote = !inQuote;
    else if (!inQuote && (text[i] === ',' || text[i] === ';')) { delimiter = text[i]; break; }
    else if (!inQuote && (text[i] === '\n' || text[i] === '\r')) break;
  }
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false, cells = 0;
  function pushField() { if (++cells > MAX_CELLS || row.length >= MAX_COLUMNS) throw invalid(); row.push(field); field = ''; closed = false; }
  function pushRow() { pushField(); if (rows.length >= MAX_ROWS) throw invalid(); rows.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } } else field += char; }
    else if (char === delimiter) pushField();
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (char === '"' && field === '' && !closed) quoted = true;
    else { if (closed || char === '"' || char === '\0') throw invalid(); field += char; }
    if (field.length > 10000) throw invalid();
  }
  if (quoted) throw invalid();
  if (field || row.length || closed) pushRow();
  return rows;
}

export async function readWorkbookBytes(bytes: Uint8Array): Promise<unknown[][]> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw invalid();
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const rows = await readSheet(boundedWorkbook(bytes));
    if (rows.length > MAX_ROWS || rows.some(row => row.length > MAX_COLUMNS) || rows.reduce((n,row) => n + row.length, 0) > MAX_CELLS) throw invalid();
    return rows;
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) throw new Error('Guarda el archivo antiguo .xls como .xlsx o .csv antes de importarlo.');
  return csvRows(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''));
}

export async function workbookRows(fileBase64: unknown): Promise<unknown[][]> {
  if (typeof fileBase64 !== 'string' || fileBase64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileBase64)) throw invalid();
  return readWorkbookBytes(Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0)));
}
