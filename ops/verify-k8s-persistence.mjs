import { randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';

const context = 'kind-task-lab';
const origin = 'http://localhost:3000';
const address = 'http://127.0.0.1:33000';
const email = `lab-${randomBytes(8).toString('hex')}@example.invalid`;
const password = randomBytes(24).toString('base64url');

async function request(path, method = 'GET', body, cookie) {
  return fetch(`${address}${path}`, {
    method,
    headers: {
      origin,
      ...(body && { 'content-type': 'application/json' }),
      ...(cookie && { cookie }),
    },
    body: body && JSON.stringify(body),
  });
}

async function startForward() {
  const child = spawn('kubectl', [
    '--context', context, '-n', 'task-manager', 'port-forward', 'svc/task-manager', '33000:3000',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`${address}/health/ready`);
      if (response.ok) return child;
    } catch {}
    if (child.exitCode !== null) throw new Error('kubectl port-forward exited before readiness');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error('port-forward did not become ready');
}

async function stopForward(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let forward = await startForward();
const createdUser = await request('/api/register', 'POST', { email, password });
assert(createdUser.status === 201, `registration status ${createdUser.status}`);
const originalCookie = createdUser.headers.get('set-cookie');
assert(originalCookie, 'registration did not set a session cookie');

const createdTask = await request('/api/tasks', 'POST', {
  title: 'PVC persistence check',
  notes: 'Disposable verification record',
}, originalCookie);
assert(createdTask.status === 201, `task creation status ${createdTask.status}`);
const task = await createdTask.json();

execFileSync('kubectl', [
  '--context', context, '-n', 'task-manager', 'scale', 'deployment/task-blue', '--replicas=2',
], { stdio: 'ignore' });
execFileSync('kubectl', [
  '--context', context, '-n', 'task-manager', 'rollout', 'status', 'deployment/task-blue', '--timeout=120s',
], { stdio: 'ignore' });
execFileSync('kubectl', [
  '--context', context, '-n', 'task-manager', 'rollout', 'restart', 'deployment/task-blue',
], { stdio: 'ignore' });
execFileSync('kubectl', [
  '--context', context, '-n', 'task-manager', 'rollout', 'status', 'deployment/task-blue', '--timeout=120s',
], { stdio: 'ignore' });

await stopForward(forward);
forward = await startForward();
const relogin = await request('/api/login', 'POST', { email, password });
assert(relogin.status === 200, `login after restart status ${relogin.status}`);
const loginCookie = relogin.headers.get('set-cookie');
const persisted = await request(`/api/tasks/${task.id}`, 'GET', undefined, loginCookie);
assert(persisted.status === 200, `task lookup after restart status ${persisted.status}`);
const recovered = await persisted.json();
assert(recovered.title === 'PVC persistence check', 'task content did not persist');
await stopForward(forward);

console.log('Created an isolated verification account and task without printing credentials.');
console.log('Scaled the blue deployment to 2 replicas, restarted it, and completed rollout.');
console.log('Logged in again and read the same task after the restart: HTTP 200.');
