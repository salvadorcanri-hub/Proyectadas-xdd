import express from 'express';
import path from 'node:path';
const app = express();
app.use(express.static(path.resolve('dist/netlify')));
const server = app.listen(3200, '127.0.0.1');
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { server.close(); server.closeAllConnections(); });
