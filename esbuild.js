const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

async function main() {
  const isTest = process.argv.includes('--test');

  if (isTest) {
    await esbuild.build({
      entryPoints: ['test/engine.test.ts'],
      bundle: true,
      format: 'cjs',
      platform: 'node',
      outfile: 'dist/test/engine.test.js',
      external: ['vscode'],
      sourcemap: true,
      logLevel: 'info',
    });
    return;
  }

  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
