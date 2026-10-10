import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
let css = ((await readFile(new URL('src/style.css', root), 'utf8')) + '\n' + (await readFile(new URL('src/brand.css', root), 'utf8'))).replace(/@import\s+url\([^)]*\);/g, '');
let js = (await readFile(new URL('src/main.js', root), 'utf8')).replace("import './style.css';", '').replace("import './brand.css';", '');
const inlineImages = {};
for (const name of ['hero.png', 'family.png', 'wood-grain.svg', 'in-hands.png', 'brand/logo.png', 'brand/mascot-greeting.png', 'brand/mascot-helper.png', 'brand/mascot-joy.png']) {
  const mime = name.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  inlineImages[name] = `data:${mime};base64,${(await readFile(new URL(`public/images/${name}`, root))).toString('base64')}`;
  js = js.replaceAll(`/images/${name}`, '${inlineImages[' + JSON.stringify(name) + ']}');
  css = css.replaceAll(`url('/images/${name}')`, `var(--asset-${name.replaceAll('.', '-').replaceAll('/', '-')})`);
}
js = `const inlineImages = ${JSON.stringify(inlineImages)};\nfor (const [name, value] of Object.entries(inlineImages)) document.documentElement.style.setProperty('--asset-' + name.replaceAll('.', '-').replaceAll('/', '-'), 'url("' + value + '")');\n` + js;
const standalone = html.replace('</head>', `<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`).replace('<script type="module" src="/src/main.js"></script>', `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/WoodBase.html', root), standalone);
console.log('Exported dist/WoodBase.html — open directly in a browser.');
