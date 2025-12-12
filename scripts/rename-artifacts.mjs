import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';

async function renameZip(dir, prefix) {
  const fullDir = path.resolve(dir);
  const entries = await readdir(fullDir);
  for (const entry of entries) {
    if (!entry.endsWith('.zip')) continue;
    const next = `${prefix}-${entry}`;
    if (entry === next) continue;
    await rename(path.join(fullDir, entry), path.join(fullDir, next));
  }
}

await renameZip('artifacts/firefox', 'firefox');
await renameZip('artifacts/chrome', 'chrome');
