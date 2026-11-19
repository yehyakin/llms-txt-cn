// 极轻构建（无第三方依赖）：
//  1) 把 UMD 库包成 Worker 可 import 的 ESM（worker/_libs.js）
//  2) worker/_assets.js：默认是空桩（用 Workers Static Assets / env.ASSETS 托管静态页）；
//     加 --embed 时把站点文件按 .assetsignore 过滤后内嵌进脚本（直接调 API 部署、无法上传 assets 时用）
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EMBED = process.argv.includes('--embed');

function wrap(file, extraRequire) {
  const src = readFileSync(join(root, file), 'utf8');
  return `(function(){ const module = { exports: {} }; const exports = module.exports;
  const require = (p) => { ${extraRequire || "throw new Error('require ' + p);"} };
  ${src}
  return module.exports; })()`;
}
const libs = `// 自动生成，勿手改：node scripts/build-worker.mjs
export const ROBOTS = ${wrap('lib/robots.js')};
export const AIAUDIT = ${wrap('lib/aiaudit.js', "if (p === './robots.js') return ROBOTS; throw new Error('require ' + p);")};
`;
writeFileSync(join(root, 'worker/_libs.js'), libs);
console.log('worker/_libs.js', libs.length, 'bytes');

const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', '': 'text/plain; charset=utf-8' };
function globToRe(g) { return new RegExp('^' + g.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); }
function loadIgnore() {
  const p = join(root, '.assetsignore');
  return existsSync(p) ? readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim().replace(/\/$/, '')).filter(s => s && !s.startsWith('#')).map(globToRe) : [];
}
function ignored(rel, pats) { const segs = rel.split('/'); return pats.some(re => re.test(rel) || segs.some(s => re.test(s))); }
function walk(dir, pats, out) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name), rel = relative(root, abs).split(sep).join('/');
    if (ignored(rel, pats)) continue;
    if (statSync(abs).isDirectory()) walk(abs, pats, out); else out.push(rel);
  }
  return out;
}
let assets = 'export const EMBED = null;\n';
if (EMBED) {
  const files = walk(root, loadIgnore(), []).sort();
  const map = {};
  for (const rel of files) {
    const buf = readFileSync(join(root, rel));
    map['/' + rel] = { t: TYPES[extname(rel).slice(1)] || 'application/octet-stream', e: createHash('sha256').update(buf).digest('hex').slice(0, 16), b: buf.toString('base64') };
  }
  assets = '// 自动生成（--embed），勿手改\nexport const EMBED = ' + JSON.stringify(map) + ';\n';
  console.log('embedded', files.length, 'files');
}
writeFileSync(join(root, 'worker/_assets.js'), assets);
console.log('worker/_assets.js', assets.length, 'bytes');
