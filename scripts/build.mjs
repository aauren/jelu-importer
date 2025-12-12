import { build, context } from 'esbuild';
import chokidar from 'chokidar';
import { rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');

function resolveTarget() {
  const explicit = args.find((arg) => arg.startsWith('--target='));
  if (explicit) {
    return explicit.split('=')[1] || 'firefox';
  }
  const index = args.indexOf('--target');
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return 'firefox';
}

const buildTarget = resolveTarget().toLowerCase();
const distDir = path.resolve(buildTarget === 'firefox' ? 'dist' : `dist-${buildTarget}`);
const staticDir = path.resolve('static');
const manifestDir = path.resolve('manifests');

const targets = [
  { entry: 'src/background/index.ts', outfile: 'background.js', format: 'iife' },
  { entry: 'src/popup/index.ts', outfile: 'popup.js', format: 'esm' },
  { entry: 'src/options/index.ts', outfile: 'options.js', format: 'esm' },
  { entry: 'src/content/index.ts', outfile: 'contentScript.js', format: 'iife' },
];

const commonOptions = {
  bundle: true,
  sourcemap: true,
  target: ['firefox115', 'chrome115'],
  platform: 'browser',
  logLevel: 'info',
};

async function ensureDist() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
}

async function copyStaticAssets() {
  await cp(staticDir, distDir, { recursive: true });
  console.log('[build] static assets copied');
}

function deepMerge(base, override) {
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(override ?? {}).forEach(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof output[key] === 'object' &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

async function generateManifest() {
  const basePath = path.join(manifestDir, 'base.json');
  const overridePath = path.join(manifestDir, `${buildTarget}.json`);
  const baseRaw = await readFile(basePath, 'utf8');
  let manifest = JSON.parse(baseRaw);
  try {
    const overrideRaw = await readFile(overridePath, 'utf8');
    manifest = deepMerge(manifest, JSON.parse(overrideRaw));
  } catch {
    // no override for this target
  }
  if (manifest.manifest_version === 2) {
    if (!manifest.browser_action && manifest.action) {
      manifest.browser_action = manifest.action;
    }
    delete manifest.action;
    if (manifest.host_permissions?.length) {
      const merged = new Set([...(manifest.permissions ?? []), ...manifest.host_permissions]);
      manifest.permissions = Array.from(merged);
    }
    delete manifest.host_permissions;
    if (manifest.background?.service_worker && !manifest.background.scripts) {
      manifest.background = {
        scripts: ['background.js'],
        persistent: false,
      };
    }
    if (manifest.background?.service_worker) {
      delete manifest.background.service_worker;
    }
  }
  const pkgRaw = await readFile(path.resolve('package.json'), 'utf8');
  const pkgVersion = JSON.parse(pkgRaw).version ?? '0.0.1';
  manifest.version = pkgVersion;
  const manifestPath = path.join(distDir, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[build] manifest generated for ${buildTarget}`);
}

async function runBuild(buildOptions, enableWatch) {
  const config = {
    entryPoints: [buildOptions.entry],
    outfile: path.join(distDir, buildOptions.outfile),
    format: buildOptions.format,
    ...commonOptions,
  };

  if (enableWatch) {
    const ctx = await context(config);
    await ctx.watch();
    return ctx;
  }

  await build(config);
  return null;
}

async function runAllBuilds(enableWatch) {
  await ensureDist();
  const contexts = [];
  for (const target of targets) {
    const ctx = await runBuild(target, enableWatch);
    if (ctx) {
      contexts.push(ctx);
    }
  }
  await copyStaticAssets();
  await generateManifest();

  if (enableWatch) {
    chokidar.watch(staticDir, { ignoreInitial: true }).on('all', async () => {
      await copyStaticAssets();
      await generateManifest();
    });
    chokidar.watch(manifestDir, { ignoreInitial: true }).on('all', async () => {
      await generateManifest();
    });
    console.log(`[build] watching for file changes (${buildTarget})...`);
  } else {
    for (const ctx of contexts) {
      await ctx.dispose();
    }
  }
}

runAllBuilds(watchMode).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
