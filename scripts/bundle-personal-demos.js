import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const result = await build({
  entryPoints: ['src/index.ts'],
  external: ['cloudflare:workers'],
  plugins: [
    {
      name: 'platform-text',
      setup(b) {
        b.onLoad(
          {
            filter:
              /public\/(platform\.(js|html)|platform-editor\.html|admin(-i18n)?\.(js|html|css)|storefront\.(js|html)|favicon\.svg)$/,
          },
          async (args) => ({
            contents: 'export default ' + JSON.stringify(await readFile(args.path, 'utf8')),
            loader: 'js',
          }),
        );
      },
    },
  ],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
});
await mkdir('dist', { recursive: true });
await writeFile('dist/worker.mjs', result.outputFiles[0].text);
console.log('Built dist/worker.mjs:', result.outputFiles[0].text.length, 'characters');
