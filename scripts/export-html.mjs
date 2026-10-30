import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
let css = await readFile(new URL('src/preview.css', root), 'utf8');
let js = (await readFile(new URL('src/main.js', root), 'utf8')).replace(/^import\s+['"][^'"]+\.css['"];?\s*$/gm, '');
css += '\n' + await readFile(new URL('src/header-collection.css', root), 'utf8');
css += '\n' + await readFile(new URL('src/benefits.css', root), 'utf8');
css += '\n' + await readFile(new URL('src/studio.css', root), 'utf8');
css += '\n' + await readFile(new URL('src/workshop-teaser.css', root), 'utf8');
const favorites = (await readFile(new URL('src/favorites.js', root), 'utf8')).replace('export function ', 'function ');
const headerCollection = (await readFile(new URL('src/header-collection.js', root), 'utf8')).replace(/^import[^\n]+\n/, '').replace('export function ', 'function ');
js = js.replace(/^import \{setupHeaderCollection\}[^\n]+\n/m, favorites + '\n' + headerCollection + '\n');
const paths = new Set((js + '\n' + css).match(/\/(?:scroll-assets|hero-assets|collection-assets|woody-green-assets)\/[\w.-]+\.(?:png|webp|svg|jpg)/g) || []);
const types = { png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', jpg: 'image/jpeg' };
for (const path of paths) {
  const mime = types[path.split('.').pop()];
  const data = `data:${mime};base64,${(await readFile(new URL(`public${path}`, root))).toString('base64')}`;
  js = js.replaceAll(path, data);
  css = css.replaceAll(path, data);
}
const standalone = html.replace('</head>', `<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`).replace('<script type="module" src="/src/main.js"></script>', `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/WoodBase.html', root), standalone);
console.log('Exported dist/WoodBase.html — open directly in a browser.');
