import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './server/store';
import { createApp } from './server/app';

const root = path.dirname(fileURLToPath(import.meta.url));
const store = new Store(path.resolve(process.env.DATA_DIR || path.join(root, 'data')));
const hosted = process.env.HOSTED_WEB === '1';
const { app, close } = createApp(store, { webRoot: hosted ? path.join(root, 'dist', 'hosted') : undefined });
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.API_HOST || (hosted ? '0.0.0.0' : '127.0.0.1'), () => console.log(`EduPuntos ${hosted ? 'web y API' : 'API'}: puerto ${port}`));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  close(); server.close(() => { store.close(); process.exit(0); });
});
