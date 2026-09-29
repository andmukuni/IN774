import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getConfig } from './config.js';

const MAX_RECORDS = 100;
let queue = Promise.resolve();

async function readAll(file) {
  try {
    const text = await readFile(file, 'utf8');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeAll(file, records) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(records, null, 2));
  await rename(temp, file);
}

export function rememberVerification(record, file = getConfig().dataFile) {
  const job = queue.then(async () => {
    const existing = await readAll(file);
    const next = [record, ...existing].slice(0, MAX_RECORDS);
    await writeAll(file, next);
    return record;
  });
  queue = job.catch(() => {});
  return job;
}

export async function listVerifications(limit = 20, file = getConfig().dataFile) {
  const records = await readAll(file);
  const size = Math.min(Math.max(Number(limit) || 20, 1), MAX_RECORDS);
  return records.slice(0, size);
}
