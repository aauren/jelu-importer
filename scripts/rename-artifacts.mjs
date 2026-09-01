import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';

async function renameZip(dir, prefix) {
  const fullDir = path.resolve(dir);
  const entries = await readdir(fullDir);
  for (const entry of entries) {
    if (!entry.endsWith('.zip')) continue;
    // Skip anything already carrying the prefix so that a second pass over the
    // same directory doesn't produce chrome-chrome-foo.zip
    if (entry.startsWith(`${prefix}-`)) continue;
    await rename(path.join(fullDir, entry), path.join(fullDir, `${prefix}-${entry}`));
  }
}

await renameZip('artifacts/firefox', 'firefox');
await renameZip('artifacts/chrome', 'chrome');
