import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

test('session and task lifecycle, ownership, persistence and optimistic updates', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'task-manager-'));
  const database = join(directory, 'tasks.sqlite');
  const origin = 'http://localhost:3000';
  async function start() {
    const app = createApp({ database, origin, metricsToken: 'test-token', log: () => {} });
    app.listen(0, '127.0.0.1');
    await once(app, 'listening');
    return app;
  }
  let app = await start();
  t.after(async () => {
    await new Promise(resolve => app.close(resolve));
    await rm(directory, { force: true, recursive: true });
  });
  function send(path, method = 'GET', body, cookie, host = origin, extra = {}) {
    return fetch(`http://127.0.0.1:${app.address().port}${path}`, {
      method, headers: { origin: host, ...(cookie && { cookie }), ...(body && { 'content-type': 'application/json' }), ...extra },
      body: body && JSON.stringify(body)
    });
  }

  assert.equal((await send('/')).status, 200);
  assert.equal((await send('/health/ready')).status, 200);
  assert.equal((await send('/api/tasks')).status, 401);
  const details = { email: 'first@example.com', password: 'long test password' };
  assert.equal((await send('/api/register', 'POST', details, null, 'https://elsewhere.example')).status, 403);
  const login = await send('/api/register', 'POST', details);
  assert.equal(login.status, 201);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  assert.equal((await send('/api/register', 'POST', details)).status, 409);
  assert.equal((await send('/api/login', 'POST', { ...details, password: 'incorrect password' })).status, 401);
  const second = (await send('/api/register', 'POST', { ...details, email: 'second@example.com' })).headers.get('set-cookie');
  assert.equal((await send('/api/tasks', 'POST', { title: 'Test', due: '2026-02-30' }, cookie)).status, 400);
  const created = await send('/api/tasks', 'POST', { title: 'Ship it', due: '2026-11-30' }, cookie);
  assert.equal(created.status, 201);
  const item = await created.json();
  const path = '/api/tasks/' + item.id;
  assert.equal((await send(path, 'GET', null, second)).status, 404);
  assert.equal((await send(path, 'PUT', item, second)).status, 404);
  assert.equal((await send(path, 'DELETE', null, second)).status, 404);
  assert.deepEqual((await (await send('/api/tasks', 'GET', null, second)).json()).tasks, []);
  assert.equal((await send(path, 'PUT', { ...item, status: 'done' }, cookie)).status, 200);
  assert.equal((await send(path, 'PUT', item, cookie)).status, 409);

  await new Promise(resolve => app.close(resolve));
  app = await start();
  assert.equal((await (await send(path, 'GET', null, cookie)).json()).status, 'done');
  assert.equal((await send(path, 'DELETE', null, cookie)).status, 204);
  assert.equal((await send(path, 'GET', null, cookie)).status, 404);
  assert.equal((await send('/api/logout', 'POST', null, cookie)).status, 204);
  assert.equal((await send('/api/me', 'GET', null, cookie)).status, 401);
  assert.equal((await send('/api/login', 'POST', details)).status, 200);
  assert.equal((await send('/metrics')).status, 404);
  const metrics = await send('/metrics', 'GET', null, null, origin, { authorization: 'Bearer test-token' });
  assert.match(await metrics.text(), /task_http_requests_total/);
});
