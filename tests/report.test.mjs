/* /en/report/<domain> SSR 测试：node tests/report.test.mjs */
import { readFileSync } from 'node:fs';
import { handleReport, isPreviewBot, headFor, rebase } from '../worker/report.js';
import worker from '../worker/index.js';
import { existsSync } from 'node:fs';
import { renderReport, cleanDomain, ogData } from '../en/view.js';
const TPL = readFileSync(new URL('../en/report/index.html', import.meta.url), 'utf8');
const FIX = JSON.parse(readFileSync(new URL('./fixture-toyota.json', import.meta.url), 'utf8'));
let pass = 0, fail = 0;
async function t(n, fn) { try { await fn(); pass++; console.log('ok  - ' + n); } catch (e) { fail++; console.log('FAIL - ' + n + '\n       ' + (e && e.stack || e)); } }
const ok = (c, m) => { if (!c) throw new Error(m || '断言失败'); };
const deps = (status, body, extra) => Object.assign({ template: async () => TPL, now: () => '2026-11-01T12:00:00Z',
  api: async () => new Response(JSON.stringify(body), { status }) }, extra || {});
const req = (path, ua) => new Request('https://x.test' + path, { headers: { 'user-agent': ua || 'Mozilla/5.0 Safari' } });

await t('cleanDomain', () => { ok(cleanDomain('https://Toyota.com/x') === 'toyota.com'); ok(cleanDomain('bad') === null); });
await t('isPreviewBot', () => { ok(isPreviewBot('Slackbot-LinkExpanding 1.0')); ok(isPreviewBot('Twitterbot/1.0')); ok(!isPreviewBot('Mozilla/5.0 (iPhone) Safari')); });
await t('renderReport 结论与表格', () => { const o = renderReport(FIX, { url: 'u', when: '2026-11-01T12:00:00Z' }); ok(o.verdict === 'silent_block'); ok(o.html.includes('OAI-SearchBot')); ok(o.summary.includes('2 of 8')); });
await t('非法域名不接管', async () => { ok((await handleReport(req('/en/report/notadomain'), deps(200, FIX))) === null); });
await t('大写域名 301 到规范地址', async () => { const r = await handleReport(req('/en/report/Toyota.com'), deps(200, FIX)); ok(r.status === 301); ok(r.headers.get('location').endsWith('/en/report/toyota.com')); });
await t('爬虫整页：head 带结论', async () => {
  const h = await (await handleReport(req('/en/report/toyota.com', 'Twitterbot/1.0'), deps(200, FIX))).text();
  ok(h.includes('<title>toyota.com: Silent block'), 'title'); ok(h.includes('og:description" content="Silent block')); ok(h.includes('rel="canonical" href="https://x.test/en/report/toyota.com"'));
  ok(h.includes('class="verdict')); ok(!h.includes('id="ld"')); ok(h.includes('content="noindex"'));
});
await t('INDEX_REPORTS 时可索引', async () => { const h = await (await handleReport(req('/en/report/toyota.com', 'Googlebot'), deps(200, FIX, { index: true }))).text(); ok(h.includes('content="index,follow"')); });
await t('访客流式：加载动画在报告之前，报告在同一响应里', async () => {
  const h = await (await handleReport(req('/en/report/toyota.com'), deps(200, FIX))).text();
  const a = h.indexOf('id="ld"'), b = h.indexOf('class="verdict'); ok(a > 0 && b > a); ok(h.includes('#ld{display:none}')); ok(h.trim().endsWith('</html>'));
});
await t('429 显示提示且不渲染报告', async () => { const h = await (await handleReport(req('/en/report/toyota.com', 'Slackbot'), deps(429, { error: 'rate_limited' }))).text(); ok(h.includes('Too many checks')); ok(!h.includes('class="verdict')); });
await t('域名与结果都转义', async () => { const bad = JSON.parse(JSON.stringify(FIX)); bad.access.target = '"><script>x</script>'; const h = await (await handleReport(req('/en/report/toyota.com', 'Slackbot'), deps(200, bad))).text(); ok(!h.includes('<script>x</script>')); });
await t('headFor 默认 noindex', () => { ok(headFor('a.com', 'https://o').includes('noindex')); });
await t('rebase 把 /en/ 链接改成根路径', () => { ok(rebase('<a href="/en/x">', '') === '<a href="/x">'); ok(rebase("f('/en/view.js')", '') === "f('/view.js')"); ok(rebase('href="https://cetxt.com/"', '') === 'href="https://cetxt.com/"'); });
await t('品牌域名报告：规范地址不带 /en', async () => { const h = await (await handleReport(req('/en/report/toyota.com', 'Slackbot'), deps(200, FIX, { base: '' }))).text(); ok(h.includes('href="https://x.test/report/toyota.com"')); ok(!h.includes('"/en/')); });
const ASSETS = { fetch: async (r) => { const u = new URL(r.url); if (u.pathname === '/en/') return new Response('<a href="/en/report/">x</a><link href="/en/app.css">', { headers: { 'content-type': 'text/html' } }); if (u.pathname === '/en/report') return new Response(null, { status: 307, headers: { location: '/en/report/' } }); return new Response('nf', { status: 404, headers: { 'content-type': 'text/plain' } }); } };
const wreq = (u) => new Request(u, { headers: { 'user-agent': 'Mozilla/5.0' } });
await t('vaksel.com/ 直接是英文首页，链接去掉 /en', async () => { const r = await worker.fetch(wreq('https://vaksel.com/'), { ASSETS }, {}); const h = await r.text(); ok(h.includes('href="/report/"') && h.includes('href="/app.css"'), h); });
await t('vaksel.com/en/... 301 到根路径', async () => { const r = await worker.fetch(wreq('https://vaksel.com/en/report/a.com'), { ASSETS }, {}); ok(r.status === 301); ok(r.headers.get('location') === 'https://vaksel.com/report/a.com'); });
await t('www.vaksel.com 301 到裸域', async () => { const r = await worker.fetch(wreq('https://www.vaksel.com/x'), { ASSETS }, {}); ok(r.status === 301 && r.headers.get('location') === 'https://vaksel.com/x'); });
await t('品牌域名的跳转 Location 去掉 /en', async () => { const r = await worker.fetch(wreq('https://vaksel.com/report'), { ASSETS }, {}); ok(r.headers.get('location') === '/report/', r.headers.get('location')); });
await t('其他域名不受影响', async () => { const r = await worker.fetch(wreq('https://cetxt-preview.x.dev/en/'), { ASSETS }, {}); ok((await r.text()).includes('href="/en/report/"')); });
const RONLY = { domain: 'x.com', access: { verdict: 'inconclusive', bots: [] }, robots: { analysis: { access: [
  { token: 'Googlebot', vendor: 'Google', category: 'search', status: 'allowed' }, { token: 'Applebot', vendor: 'Apple', category: 'search', status: 'allowed' },
  { token: 'OAI-SearchBot', vendor: 'OpenAI', category: 'search', status: 'blocked' }, { token: 'GPTBot', vendor: 'OpenAI', category: 'training', status: 'blocked' } ] } } };
await t('robots-only 回落不把 Googlebot/Applebot 算作 AI 搜索', () => { const h = renderReport(RONLY, {}).html; ok(!h.includes('>Googlebot<') && !h.includes('>Applebot<'), 'classic listed'); ok(h.includes('OAI-SearchBot')); });
await t('ogData：robots-only 时按 robots 计数并标记 live=false', () => { const d = ogData(RONLY); ok(d.total === 1 && d.reach === 0 && d.live === false && d.tone === 'gray', JSON.stringify(d)); });
await t('ogData：实测结果', () => { const d = ogData(FIX); ok(d.live && d.total === 8 && d.reach === 2 && d.tone === 'bad', JSON.stringify(d)); });
await t('爬虫名链接到百科页，base 可去掉 /en', () => { ok(renderReport(FIX, {}).html.includes('href="/en/bots/oai-searchbot/"')); ok(renderReport(FIX, { base: '' }).html.includes('href="/bots/oai-searchbot/"')); });
await t('报告 head 带动态分享图', () => { const h = headFor('toyota.com', 'https://vaksel.com', { base: '' }); ok(h.includes('content="https://vaksel.com/og/toyota.com.png"') && h.includes('summary_large_image')); });
await t('英文静态页齐全', () => { for (const f of ['en/404.html', 'en/pricing/index.html', 'en/guides/cloudflare/index.html', 'en/bots/gptbot/index.html', 'en/sitemap.xml']) ok(existsSync(f), f); ok(readFileSync('en/index.html', 'utf8').includes('href="/en/pricing/"')); });
const KV = new Map(); const WENV = { ASSETS, WAITLIST: { put: async (k, v) => KV.set(k, v), get: async (k) => KV.get(k) || null } };
const post = (b) => new Request('https://vaksel.com/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
await t('早鸟名单：存邮箱和方案，拒绝坏邮箱，蜜罐静默', async () => {
  ok((await worker.fetch(post({ email: 'A@B.co', plan: 'agency', site: 'Ex.com' }), WENV, {})).status === 200);
  const r = JSON.parse(KV.get('wl:a@b.co')); ok(r.plan === 'agency' && r.site === 'ex.com' && !('ip' in r), JSON.stringify(r));
  ok((await worker.fetch(post({ email: 'nope' }), WENV, {})).status === 400);
  ok((await worker.fetch(post({ email: 'c@d.co', hp: 'x' }), WENV, {})).status === 200 && !KV.has('wl:c@d.co'));
});
await t('联系表单：存留言，拒空消息', async () => {
  const req = (b) => new Request('https://vaksel.com/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  ok((await worker.fetch(req({ email: 'x@y.co', topic: 'data', message: 'delete me' }), WENV, {})).status === 200);
  ok([...KV.keys()].some((k) => k.startsWith('ct:')));
  ok((await worker.fetch(req({ email: 'x@y.co', message: ' ' }), WENV, {})).status === 400);
});
await t('隐私/条款/联系页与手机菜单', () => { for (const f of ['en/privacy/index.html', 'en/terms/index.html', 'en/contact/index.html']) ok(existsSync(f), f); const h = readFileSync('en/index.html', 'utf8'); ok(h.includes('class="menu"') && h.includes('/en/privacy/') && h.includes('apple-touch-icon') && h.includes('id="main"')); });
await t('INDEX_SITE=1 只放开品牌域名内容页', async () => {
  const A2 = { fetch: async () => new Response('<meta name="robots" content="noindex"><a href="/en/x/">', { headers: { 'content-type': 'text/html' } }) };
  const h1 = await (await worker.fetch(wreq('https://vaksel.com/guides/'), { ASSETS: A2, INDEX_SITE: '1' }, {})).text(); ok(h1.includes('index,follow'), h1);
  const h2 = await (await worker.fetch(wreq('https://vaksel.com/guides/'), { ASSETS: A2 }, {})).text(); ok(h2.includes('content="noindex"'));
});
console.log(`\n${pass} 通过，${fail} 失败`); if (fail) process.exit(1);
