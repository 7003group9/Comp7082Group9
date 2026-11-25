import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function filesUnder(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.endsWith('.js')) files.push(path);
  }
  return files;
}

let failed = false;
for (const root of ['src', 'tests', 'scripts']) {
  let files;
  try {
    files = await filesUnder(root);
  } catch (err) {
    if (err.code === 'ENOENT') continue;
    throw err;
  }
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) failed = true;
  }
}

if (failed) process.exit(1);
console.log('Server JavaScript syntax check passed.');
