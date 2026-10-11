import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitoredFetch, connectionSnapshot, SLOW_REQUEST_MS, REQUEST_TIMEOUT_MS, resetConnection } from '../src/services/connection';

test('slow response bodies time out and release pending status', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start() {} })));
  const pending = monitoredFetch('https://test.invalid/rest/v1/rpc/edu_state', { method: 'POST' });
  const result = assert.rejects(pending, /tardó demasiado.*reintentar/);
  await Promise.resolve();
  t.mock.timers.tick(SLOW_REQUEST_MS);
  assert.equal(connectionSnapshot().slow, 1);
  t.mock.timers.tick(REQUEST_TIMEOUT_MS - SLOW_REQUEST_MS);
  await result;
  assert.equal(connectionSnapshot().pending, 0);
  assert.equal(connectionSnapshot().slow, 0);
});

test('an interrupted write is ambiguous and is never retried automatically', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(monitoredFetch('https://test.invalid/rest/v1/rpc/edu_submit', { method: 'POST' }), /No pudimos confirmar si se guardó/);
  assert.equal(calls, 1);
  assert.equal(connectionSnapshot().pending, 0);
});

test('storage signing POST requests are reads; failures do not claim a possible save', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(monitoredFetch('https://test.invalid/storage/v1/object/sign/edupuntos-homework', { method: 'POST' }), /No pudimos cargar la información/);
});

test('successful and rejected HTTP responses preserve status, headers and body', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Invalid input' }, { status: 400, headers: { 'x-request-id': 'test' } }));
  const response = await monitoredFetch('https://test.invalid/write', { method: 'POST' });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('x-request-id'), 'test');
  assert.deepEqual(await response.json(), { error: 'Invalid input' });
  assert.equal(connectionSnapshot().pending, 0);
  resetConnection();
});
