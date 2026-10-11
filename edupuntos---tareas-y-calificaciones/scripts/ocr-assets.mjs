import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Serve the OCR engine and model from this app. No photo or OCR request goes to a CDN.
export function ocrAssets() {
  const require = createRequire(import.meta.url);
  const root = name => path.dirname(require.resolve(`${name}/package.json`));
  const assets = {
    'worker.min.js': path.join(root('tesseract.js'), 'dist/worker.min.js'),
    'worker.min.js.LICENSE.txt': path.join(root('tesseract.js'), 'dist/worker.min.js.LICENSE.txt'),
    'tesseract-core-lstm.wasm.js': path.join(root('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'),
    'tesseract-core-lstm.wasm': path.join(root('tesseract.js-core'), 'tesseract-core-lstm.wasm'),
    'eng.traineddata.gz': path.join(root('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'),
    'LICENSE.txt': path.join(root('tesseract.js-core'), 'LICENSE'),
  };
  return {
    name: 'edupuntos-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.match(/\/ocr\/([^/]+)$/)?.[1];
        if (!name || !Object.hasOwn(assets, name)) return next();
        res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        res.end(readFileSync(assets[name]));
      });
    },
    generateBundle() {
      for (const [name, file] of Object.entries(assets)) this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(file) });
    },
  };
}
