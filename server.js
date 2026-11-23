import { createServer } from 'node:http';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const sessionSeconds = 8 * 60 * 60;
const statuses = ['todo', 'doing', 'done'];
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
].map(([url, [file, type]]) => [url, [readFileSync(new URL(`./public/${file}`, import.meta.url)), type]]));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function json(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new HttpError(415, 'Send application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 16384) {
      req.resume();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // All malformed bodies use the same response.
  }
  throw new HttpError(400, 'Send a JSON object.');
}

function taskInput({ title, notes = '', status = 'todo', due = '' }) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120 ||
      typeof notes !== 'string' || notes.length > 2000 || !statuses.includes(status) ||
      typeof due !== 'string' || (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0, 10) !== due))) {
    throw new HttpError(400, 'Check the task title, notes, status and due date.');
  }
  return [title.trim(), notes.trim(), status, due];
}

export function createApp({ database = ':memory:', origin = 'http://localhost:3000',
  secure = origin.startsWith('https:'), metricsToken = '', log = console.log } = {}) {
  const db = new DatabaseSync(database);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expiry INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expiry);
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, notes TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),
      due TEXT NOT NULL, updated INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS tasks_owner_updated ON tasks(owner, updated DESC, id);
    CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, until INTEGER NOT NULL);
  `);
  const counts = new Map();
  let authInFlight = 0;
  const q = sql => db.prepare(sql);
  const dummySalt = randomBytes(16).toString('hex');
  const cookie = (value, ttl) =>
    `session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure ? '; Secure' : ''}`;

  async function auth(req, res, route, now) {
    const { email: raw, password } = await json(req);
    if (typeof raw !== 'string' || raw.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim()) ||
        typeof password !== 'string' || password.length < 12 || password.length > 128) {
      throw new HttpError(400, 'Enter a valid email and a password of 12 to 128 characters.');
    }
    const email = raw.trim().toLowerCase();
    if (authInFlight >= 4) throw new HttpError(503, 'Try again shortly.');
    q('DELETE FROM auth_limits WHERE until <= ?').run(now);
    const limit = q(`INSERT INTO auth_limits VALUES (?, 1, ?) ON CONFLICT(bucket)
      DO UPDATE SET hits = hits + 1 RETURNING hits`);
    const bucket = route === 'register' ? 'registration' : digest(email);
    const maxAttempts = route === 'register' ? 30 : 10;
    if (limit.get('global', now + 600).hits > 300 || limit.get(bucket, now + 600).hits > maxAttempts) {
      res.setHeader('Retry-After', '600');
      throw new HttpError(429, 'Too many attempts. Try again later.');
    }

    authInFlight++;
    try {
      const user = q('SELECT * FROM users WHERE email = ?').get(email);
      let owner;
      if (route === 'register') {
        const salt = randomBytes(16).toString('hex');
        const key = await derive(password, salt, 64);
        owner = randomUUID();
        if (!q('INSERT INTO users VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING')
          .run(owner, email, `${salt}:${key.toString('hex')}`).changes) {
          throw new HttpError(409, 'An account with this email already exists.');
        }
      } else {
        const [salt, expected] = user ? user.password.split(':') : [dummySalt, '00'.repeat(64)];
        const key = await derive(password, salt, 64);
        if (!timingSafeEqual(key, Buffer.from(expected, 'hex')) || !user) {
          throw new HttpError(401, 'Email or password is incorrect.');
        }
        owner = user.id;
      }
      const token = randomBytes(32).toString('hex');
      q('DELETE FROM sessions WHERE expiry <= ?').run(now);
      q('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), owner, now + sessionSeconds);
      res.setHeader('Set-Cookie', cookie(token, sessionSeconds));
      return [route === 'register' ? 201 : 200, { email }];
    } finally {
      authInFlight--;
    }
  }

  function tasks(method, parts, owner, url, req) {
    const [, , , id] = parts;
    const columns = 'id, title, notes, status, due, updated, revision';
    const get = key => q(`SELECT ${columns} FROM tasks WHERE id = ? AND owner = ?`).get(key, owner);
    if (id && !/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, 'Task not found.');
    if (!id && method === 'GET') {
      const page = Number(url.searchParams.get('page') ?? 1);
      if (!Number.isInteger(page) || page < 1 || page > 10000) throw new HttpError(400, 'Invalid page.');
      const rows = q(`SELECT ${columns} FROM tasks WHERE owner = ? ORDER BY updated DESC, id LIMIT 51 OFFSET ?`)
        .all(owner, (page - 1) * 50);
      return [200, { tasks: rows.slice(0, 50), hasMore: rows.length > 50 }];
    }
    if (id && method === 'GET') {
      const row = get(id);
      if (!row) throw new HttpError(404, 'Task not found.');
      return [200, row];
    }
    if (id && method === 'DELETE') {
      if (!q('DELETE FROM tasks WHERE id = ? AND owner = ?').run(id, owner).changes) {
        throw new HttpError(404, 'Task not found.');
      }
      return [204];
    }
    if (!id && method === 'POST') return json(req).then(value => {
      const key = randomUUID();
      q('INSERT INTO tasks (id, owner, title, notes, status, due, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(key, owner, ...taskInput(value), Date.now());
      return [201, get(key)];
    });
    if (id && method === 'PUT') return json(req).then(value => {
      if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new HttpError(400, 'A revision is required.');
      const changed = q(`UPDATE tasks SET title = ?, notes = ?, status = ?, due = ?, updated = ?, revision = revision + 1
        WHERE id = ? AND owner = ? AND revision = ?`)
        .run(...taskInput(value), Date.now(), id, owner, value.revision);
      if (!changed.changes) {
        if (!get(id)) throw new HttpError(404, 'Task not found.');
        throw new HttpError(409, 'This task changed. Refresh and try again.');
      }
      return [200, get(id)];
    });
    throw new HttpError(405, 'Method not allowed.');
  }

  async function route(req, res, url) {
    const method = req.method;
    const path = url.pathname;
    if (method === 'GET' && path === '/health/live') return [200, { ok: true }];
    if (method === 'GET' && path === '/health/ready') {
      q('SELECT 1 FROM tasks LIMIT 1').get();
      return [200, { ok: true }];
    }
    if (method === 'GET' && path === '/metrics') {
      if (!metricsToken || digest(req.headers.authorization ?? '') !== digest(`Bearer ${metricsToken}`)) {
        throw new HttpError(404, 'Not found.');
      }
      const lines = ['# TYPE task_http_requests_total counter'];
      for (const [status, count] of counts) lines.push(`task_http_requests_total{status="${status}"} ${count}`);
      lines.push('# TYPE task_process_resident_memory_bytes gauge',
        `task_process_resident_memory_bytes ${process.memoryUsage().rss}`,
        '# TYPE task_process_cpu_seconds_total counter',
        `task_process_cpu_seconds_total ${Object.values(process.cpuUsage()).reduce((a, b) => a + b) / 1e6}`);
      return [200, lines.join('\n') + '\n', 'text/plain; version=0.0.4'];
    }
    if (method === 'GET' && assets.has(path)) {
      const [body, type] = assets.get(path);
      return [200, body, type];
    }
    if (!path.startsWith('/api/')) throw new HttpError(404, 'Not found.');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && req.headers.origin !== origin) {
      throw new HttpError(403, 'Request origin is not allowed.');
    }
    const now = Math.floor(Date.now() / 1000);
    const authRoute = /^\/api\/(register|login)$/.exec(path);
    if (authRoute && method === 'POST') return auth(req, res, authRoute[1], now);
    const token = /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
    const user = token && q(`SELECT users.id, users.email FROM sessions JOIN users ON sessions.owner = users.id
      WHERE token = ? AND expiry > ?`).get(digest(token), now);
    if (!user) throw new HttpError(401, 'Sign in to continue.');
    if (path === '/api/me' && method === 'GET') return [200, { email: user.email }];
    if (path === '/api/logout' && method === 'POST') {
      q('DELETE FROM sessions WHERE token = ?').run(digest(token));
      res.setHeader('Set-Cookie', cookie('', 0));
      return [204];
    }
    if (/^\/api\/tasks(?:\/[^/]+)?$/.test(path)) return tasks(method, path.split('/'), user.id, url, req);
    throw new HttpError(404, 'Not found.');
  }

  const server = createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    const started = Date.now();
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    res.once('finish', () => {
      counts.set(res.statusCode, (counts.get(res.statusCode) ?? 0) + 1);
      log(JSON.stringify({ level: 'info', requestId, method: req.method, status: res.statusCode,
        durationMs: Date.now() - started }));
    });
    try {
      const [status, body, type = 'application/json; charset=utf-8'] =
        await route(req, res, new URL(req.url, origin));
      res.statusCode = status;
      if (status === 204) return res.end();
      res.setHeader('Content-Type', type);
      res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
    } catch (error) {
      res.statusCode = error instanceof HttpError ? error.status : 500;
      if (res.statusCode === 500) log(JSON.stringify({ level: 'error', requestId, code: error.code ?? 'INTERNAL' }));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: res.statusCode === 500 ? 'Unexpected server error.' : error.message, requestId }));
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  const origin = process.env.APP_ORIGIN ?? `http://localhost:${port}`;
  const originUrl = new URL(origin);
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.origin !== origin) {
    throw new Error('APP_ORIGIN must be an exact HTTP(S) origin.');
  }
  const data = resolve(process.env.DATA_DIR ?? 'data');
  mkdirSync(data, { recursive: true, mode: 0o700 });
  const server = createApp({ database: resolve(data, 'tasks.sqlite'), origin, metricsToken: process.env.METRICS_TOKEN });
  server.listen(port, process.env.HOST ?? '127.0.0.1');
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close();
      setTimeout(() => process.exit(1), 10000).unref();
    });
  }
}
