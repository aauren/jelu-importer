import { build, context } from 'esbuild';
import chokidar from 'chokidar';
import { rm, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';

const watchMode = process.argv.includes('--watch');
const distDir = path.resolve('dist');
const staticDir = path.resolve('static');

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

  if (enableWatch) {
    chokidar.watch(staticDir, { ignoreInitial: true }).on('all', async () => {
      await copyStaticAssets();
    });
    console.log('[build] watching for file changes...');
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
