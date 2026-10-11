import express from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
const app = express();
const headers = readFileSync('dist/netlify/_headers', 'utf8').split('\n').filter(line => /^  [A-Za-z-]+:/.test(line)).map(line => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()]);
app.use((_req, res, next) => { for (const [key, value] of headers) res.setHeader(key, value); next(); });
app.use(express.static(path.resolve('dist/netlify')));
const server = app.listen(3200, '127.0.0.1');
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { server.close(); server.closeAllConnections(); });
