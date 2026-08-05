const esbuild = require('esbuild');
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
  });
  if (isWatch) await ctx.watch();
  else { await ctx.rebuild(); await ctx.dispose(); }
}
main().catch(console.error);
