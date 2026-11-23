import { backup, DatabaseSync } from 'node:sqlite';
import { lstatSync, unlinkSync, linkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const source = resolve(process.env.DATA_DIR ?? 'data', 'tasks.sqlite');
if (process.argv.length !== 3) throw new Error('Usage: node ops/backup.js <new-backup-file>');
const destination = resolve(process.argv[2]);
if (source === destination) throw new Error('Choose a separate backup file.');
if (!lstatSync(source).isFile()) throw new Error('The source database must be a regular file.');
process.umask(0o077);
const pending = destination + '.' + randomUUID() + '.tmp';
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, pending);
  const snapshot = new DatabaseSync(pending, { readOnly: true });
  try {
    if (snapshot.prepare('PRAGMA quick_check').get().quick_check !== 'ok') {
      throw new Error('Backup integrity check failed.');
    }
  } finally {
    snapshot.close();
  }
  linkSync(pending, destination);
} finally {
  database.close();
  try {
    unlinkSync(pending);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
console.log('Verified backup written to ' + destination);
