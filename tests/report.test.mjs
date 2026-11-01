/* /en/report/<domain> SSR 测试：node tests/report.test.mjs */
import { readFileSync } from 'node:fs';
import { handleReport, isPreviewBot, headFor } from '../worker/report.js';
import { renderReport, cleanDomain } from '../en/view.js';
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
console.log(`\n${pass} 通过，${fail} 失败`); if (fail) process.exit(1);
