import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function updateManifest(version) {
  const manifestPath = path.resolve('static', 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  manifest.version = version;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[version] Updated static/manifest.json to ${version}`);
}

const nextVersion = process.argv[2];
if (!nextVersion) {
  console.error('[version] Missing version argument');
  process.exit(1);
}

updateManifest(nextVersion).catch((error) => {
  console.error('[version] Failed to update manifest', error);
  process.exit(1);
});
