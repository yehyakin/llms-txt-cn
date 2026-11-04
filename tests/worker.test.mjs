/* Worker /api/check 测试（mock fetch 与 DNS）：node tests/worker.test.mjs */
import { createRequire } from 'node:module';
import { cleanDomain, isPublicIP, fetchLimited, checkRobots, checkLlms, createApi, LIMITS } from '../worker/check.js';
const require = createRequire(import.meta.url);
const ROBOTS = require('../lib/robots.js');
const AIAUDIT = require('../lib/aiaudit.js');
const DATA = require('../data/ai-crawlers.json');

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('ok  - ' + name); }
  catch (e) { fail++; console.log('FAIL - ' + name + '\n       ' + (e && e.stack || e)); }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' 期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || '断言失败'); }

/* 模拟网络：routes[url] = { status, headers, body } 或 'throw' */
function mockNet(routes, dns) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push(url);
      const r = routes[url];
      if (r === undefined) return new Response('nf', { status: 404 });
      if (r === 'throw') throw new TypeError('network');
      if (r === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }));
      return new Response(r.body == null ? '' : r.body, { status: r.status || 200, headers: r.headers || {} });
    },
    resolve: async (host) => {
      if (dns && dns[host] !== undefined) { if (dns[host] === 'fail') throw new Error('nx'); return dns[host]; }
      return ['93.184.216.34'];
    }
  };
}

await t('cleanDomain：合法输入与归一化', () => {
  eq(cleanDomain('Example.COM'), 'example.com');
  eq(cleanDomain('https://www.example.com/path?q=1'), 'www.example.com');
  eq(cleanDomain('example.com:8080'), 'example.com');
  eq(cleanDomain('中文.com'), 'xn--fiq228c.com');
});
await t('cleanDomain：拒绝 IP 字面量、内网与保留域名、带账号密码', () => {
  for (const bad of ['127.0.0.1', '10.0.0.1', '[::1]', 'http://[::1]/', '0x7f000001', 'localhost', 'a.localhost', 'nas.local', 'svc.internal', 'x.onion', 'x.test',
    'user:pass@example.com', '', 'a', '-a.com', 'a..com', 'exa mple.com', 'javascript:alert(1)']) {
    eq(cleanDomain(bad), null, bad);
  }
});
await t('isPublicIP：内网 / 保留 / 映射地址', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '2001:db8::1', '64:ff9b::a00:1']) eq(isPublicIP(ip), false, ip);
  for (const ip of ['93.184.216.34', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) eq(isPublicIP(ip), true, ip);
});

await t('恶意跳转到 IP 字面量内网地址 → 拒绝跟随', async () => {
  const net = mockNet({ 'https://evil.com/robots.txt': { status: 302, headers: { location: 'http://127.0.0.1/robots.txt' } } });
  const r = await checkRobots('evil.com', net, Date.now() + 5000);
  eq(r.state, 'refused'); eq(r.code, 'bad_host');
  ok(!net.calls.some(u => u.includes('127.0.0.1')), '不应请求内网');
});
await t('恶意跳转到解析为内网的域名（DNS rebinding 式）→ 拒绝', async () => {
  const net = mockNet({ 'https://evil.com/robots.txt': { status: 301, headers: { location: 'https://internal.nip.io/robots.txt' } } }, { 'internal.nip.io': ['10.0.0.5'] });
  const r = await checkRobots('evil.com', net, Date.now() + 5000);
  eq(r.state, 'refused'); eq(r.code, 'dns_blocked');
  ok(!net.calls.some(u => u.includes('internal.nip.io')));
});
await t('跳转到非默认端口 / 非 http(s) 协议 → 拒绝', async () => {
  const net = mockNet({ 'https://a.com/robots.txt': { status: 302, headers: { location: 'http://a.com:6379/' } } });
  eq((await checkRobots('a.com', net, Date.now() + 5000)).code, 'bad_port');
  const net2 = mockNet({ 'https://a.com/robots.txt': { status: 302, headers: { location: 'file:///etc/passwd' } } });
  eq((await checkRobots('a.com', net2, Date.now() + 5000)).code, 'bad_scheme');
});
await t('域名本身解析到内网 → llms 未能判定、robots 拒绝', async () => {
  const net = mockNet({}, { 'rebind.com': ['192.168.0.10', '93.184.216.34'] });
  const l = await checkLlms('rebind.com', net, Date.now() + 5000);
  eq(l.verdict, 'unknown'); eq(l.code, 'dns_blocked');
  eq(net.calls.length, 0);
});
await t('最多跟 5 跳；第 6 跳 → robots 视为 unavailable（全允许）', async () => {
  const routes = {};
  for (let i = 0; i < 7; i++) routes['https://loop.com/r' + i] = { status: 302, headers: { location: '/r' + (i + 1) } };
  routes['https://loop.com/robots.txt'] = { status: 301, headers: { location: '/r0' } };
  const net = mockNet(routes);
  const r = await checkRobots('loop.com', net, Date.now() + 5000);
  eq(r.state, 'too_many_redirects');
  eq(net.calls.length, 6, '首个请求 + 5 次跳转');
  eq(AIAUDIT.analyze({ tooManyRedirects: true, http_status: null }, DATA).fetch.policy, 'allow_all');
});
await t('跳转 5 次以内正常跟随，每跳都重新解析', async () => {
  const net = mockNet({
    'https://a.com/robots.txt': { status: 301, headers: { location: 'https://www.a.com/robots.txt' } },
    'https://www.a.com/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /x\n' }
  });
  let resolved = [];
  const r0 = net.resolve; net.resolve = async (h) => { resolved.push(h); return r0(h); };
  const r = await checkRobots('a.com', net, Date.now() + 5000);
  eq(r.state, 'ok'); eq(r.final_url, 'https://www.a.com/robots.txt'); eq(resolved.join(','), 'a.com,www.a.com');
});
await t('robots 5xx → server_error → 全禁；404 → 全允许', async () => {
  const net = mockNet({ 'https://a.com/robots.txt': { status: 503 } });
  const r = await checkRobots('a.com', net, Date.now() + 5000);
  eq(r.state, 'server_error');
  eq(AIAUDIT.analyze({ http_status: r.http_status }, DATA).fetch.policy, 'disallow_all');
  const r2 = await checkRobots('b.com', mockNet({}), Date.now() + 5000);
  eq(r2.state, 'unavailable'); eq(r2.http_status, 404);
});
await t('https 传输失败回落 http；都失败 → unreachable（全禁）', async () => {
  const net = mockNet({ 'https://a.com/robots.txt': 'throw', 'http://a.com/robots.txt': { status: 200, body: 'User-agent: *\nAllow: /\n' } });
  const r = await checkRobots('a.com', net, Date.now() + 5000);
  eq(r.state, 'ok'); eq(r.final_url, 'http://a.com/robots.txt');
  const net2 = mockNet({ 'https://a.com/robots.txt': 'throw', 'http://a.com/robots.txt': 'throw' });
  const r2 = await checkRobots('a.com', net2, Date.now() + 5000);
  eq(r2.state, 'unreachable');
  eq(AIAUDIT.analyze({ unreachable: true }, DATA).fetch.policy, 'disallow_all');
});
await t('超时：挂起的请求在超时后中止', async () => {
  const old = LIMITS.timeoutMs; LIMITS.timeoutMs = 50;
  try {
    const net = mockNet({ 'https://slow.com/robots.txt': 'hang', 'http://slow.com/robots.txt': 'hang' });
    const r = await checkRobots('slow.com', net, Date.now() + 5000);
    eq(r.state, 'unreachable'); eq(r.code, 'timeout');
  } finally { LIMITS.timeoutMs = old; }
});
await t('体积上限：robots 读 500 KiB、llms 读 200KB 后停止', async () => {
  const big = 'User-agent: *\nDisallow: /a\n' + '#'.repeat(700 * 1024);
  const r = await checkRobots('a.com', mockNet({ 'https://a.com/robots.txt': { status: 200, body: big } }), Date.now() + 5000);
  eq(r.truncated, true); eq(r.bytes, 500 * 1024);
  const l = await checkLlms('a.com', mockNet({ 'https://a.com/llms.txt': { status: 200, body: '# T\n' + 'x'.repeat(300 * 1024) } }), Date.now() + 5000);
  eq(l.truncated, true); eq(l.text.length, 200 * 1024);
});
await t('llms verdict 语义保持：real / html_spoof / missing / nonstandard / 非 200', async () => {
  const net = mockNet({
    'https://r.com/llms.txt': { status: 200, body: '# Site\n> hi\n', headers: { 'content-type': 'text/plain' } },
    'https://h.com/llms.txt': { status: 200, body: '<!DOCTYPE html><html></html>', headers: { 'content-type': 'text/html' } },
    'https://n.com/llms.txt': { status: 200, body: 'just text', headers: { 'content-type': 'text/plain' } },
    'https://f.com/llms.txt': { status: 403 }
  });
  const d = Date.now() + 5000;
  eq((await checkLlms('r.com', net, d)).verdict, 'real');
  eq((await checkLlms('h.com', net, d)).verdict, 'html_spoof');
  eq((await checkLlms('m.com', net, d)).verdict, 'missing');
  eq((await checkLlms('n.com', net, d)).verdict, 'nonstandard');
  const f = await checkLlms('f.com', net, d); eq(f.verdict, 'unknown'); eq(f.code, 'http_403');
});
await t('GBK 编码的 llms.txt 能解码', async () => {
  const gbk = new Uint8Array([0x23, 0x20, 0xd6, 0xd0, 0xce, 0xc4, 0x0a]); // "# 中文\n"
  const net = mockNet({ 'https://g.com/llms.txt': { status: 200, body: gbk, headers: { 'content-type': 'text/plain; charset=gbk' } } });
  const l = await checkLlms('g.com', net, Date.now() + 5000);
  eq(l.text, '# 中文\n');
});

/* ---------- 完整 handler ---------- */
const api = createApi({ ROBOTS, AIAUDIT });
const env = {};
function req(q, ip) { return new Request('https://cetxt-preview.example/api/check' + q, { headers: { 'cf-connecting-ip': ip || '203.0.113.9' } }); }
await t('handler：非法域名 400，路由 404，健康检查 200', async () => {
  const net = Object.assign(mockNet({}), { crawlerData: DATA, noCache: true });
  eq((await api(req('?domain=127.0.0.1'), env, null, net)).status, 400);
  eq((await api(req('?domain='), env, null, net)).status, 400);
  eq((await api(new Request('https://x.example/api/nope'), env, null, net)).status, 404);
  eq((await api(new Request('https://x.example/api/health'), env, null, net)).status, 200);
});
await t('handler：一次返回 llms + robots，顶层字段兼容旧版', async () => {
  const net = Object.assign(mockNet({
    'https://site.com/llms.txt': { status: 200, body: '# Site\n\n> 简介\n', headers: { 'content-type': 'text/plain' } },
    'https://site.com/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n' }
  }), { crawlerData: DATA, noCache: true });
  const res = await api(req('?domain=https://Site.com/'), env, null, net);
  eq(res.status, 200);
  const j = await res.json();
  eq(j.domain, 'site.com'); eq(j.verdict, 'real'); eq(j.http_status, 200); ok(typeof j.text === 'string'); ok(typeof j.elapsed_ms === 'number');
  eq(j.llms.verdict, 'real');
  eq(j.robots.state, 'ok'); ok(j.robots.text.startsWith('User-agent'));
  ok(j.robots.analysis.findings.some(f => f.id === 'wildcard_block_specific_open'));
  eq(j.data_version, DATA.version);
});
await t('handler：跳到内网的 robots → analysis 为 null（不套用 RFC 语义）', async () => {
  const net = Object.assign(mockNet({ 'https://evil2.com/robots.txt': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } } }), { crawlerData: DATA, noCache: true });
  const j = await (await api(req('?domain=evil2.com', '198.51.100.77'), env, null, net)).json();
  eq(j.robots.state, 'refused'); eq(j.robots.analysis, null);
});
await t('handler：同一 IP 60 秒内第 21 次 → 429（内存限频兜底）', async () => {
  const net = Object.assign(mockNet({}), { crawlerData: DATA, noCache: true });
  let last;
  for (let i = 0; i < 21; i++) last = await api(req('?domain=limit' + i + '.com', '192.0.2.200'), env, null, net);
  eq(last.status, 429);
  const other = await api(req('?domain=limit.com', '192.0.2.201'), env, null, net);
  eq(other.status, 200);
});
await t('handler：有 Rate Limiting binding 时使用它', async () => {
  const net = Object.assign(mockNet({}), { crawlerData: DATA, noCache: true });
  const env2 = { RL: { limit: async () => ({ success: false }) } };
  eq((await api(req('?domain=a.com', '192.0.2.250'), env2, null, net)).status, 429);
});
await t('handler：只按天记 verdict，不写域名 / IP', async () => {
  const points = [];
  const env3 = { STATS: { writeDataPoint: (p) => points.push(p) } };
  const net = Object.assign(mockNet({}), { crawlerData: DATA, noCache: true });
  await api(req('?domain=secret-domain.com', '192.0.2.251'), env3, null, net);
  eq(points.length, 1);
  const s = JSON.stringify(points[0]);
  ok(!s.includes('secret-domain') && !s.includes('192.0.2.251'), '不应包含域名或 IP');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(points[0].blobs[0]));
  eq(points[0].blobs[1], 'missing');
});
await t('handler：5 分钟内同域名命中内存缓存', async () => {
  const net = Object.assign(mockNet({}), { crawlerData: DATA, noCache: true });
  await api(req('?domain=cached.com', '192.0.2.252'), env, null, net);
  const n = net.calls.length;
  const r = await api(req('?domain=cached.com', '192.0.2.252'), env, null, net);
  eq(net.calls.length, n); eq(r.headers.get('x-cetxt-cache'), 'hit');
});

/* ---------------- 中转回落（Worker 出口被拦） ---------------- */
function relayNet(routes, relayFn) {
  const net = mockNet(routes);
  const base = net.fetch;
  net.relayCalls = [];
  net.fetch = async (url, init) => {
    if (url === 'https://relay.test/fetch') { const b = JSON.parse(init.body); net.relayCalls.push({ b, key: init.headers['x-relay-key'] }); return new Response(JSON.stringify(relayFn(b)), { status: 200 }); }
    return base(url, init);
  };
  net.relay = { url: 'https://relay.test/fetch', key: 'k1' };
  return net;
}
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
await t('中转：直连 412 → 走中转，拿到 robots 内容', async () => {
  const net = relayNet({ 'https://blk.com/robots.txt': { status: 412 } }, () => ({ kind: 'response', status: 200, content_type: 'text/plain', body_b64: b64('User-agent: *\nDisallow: /x\n'), final_url: 'https://blk.com/robots.txt', redirects: 0 }));
  const r = await checkRobots('blk.com', net, Date.now() + 5000);
  eq(r.state, 'ok'); eq(r.via, 'relay'); ok(r.text.includes('Disallow: /x')); eq(net.relayCalls[0].key, 'k1');
});
await t('中转：直连 200 / 404 不走中转', async () => {
  const net = relayNet({ 'https://fine.com/robots.txt': { status: 200, body: 'User-agent: *\n' } }, () => { throw new Error('不应调用'); });
  const r = await checkRobots('fine.com', net, Date.now() + 5000);
  eq(r.state, 'ok'); eq(net.relayCalls.length, 0);
  const l = await checkLlms('fine.com', net, Date.now() + 5000);
  eq(l.verdict, 'missing'); eq(net.relayCalls.length, 0);
});
await t('中转：llms 直连 530 → 中转返回真文件', async () => {
  const net = relayNet({ 'https://cf.com/llms.txt': { status: 530 } }, () => ({ kind: 'response', status: 200, content_type: 'text/plain', body_b64: b64('# Site\n> hi\n'), final_url: 'https://cf.com/llms.txt' }));
  const l = await checkLlms('cf.com', net, Date.now() + 5000);
  eq(l.verdict, 'real'); eq(l.via, 'relay');
});
await t('中转：中转本身不可用 → 保留直连结果', async () => {
  const net = mockNet({ 'https://blk2.com/robots.txt': { status: 403 }, 'https://relay.test/fetch': { status: 502 } });
  net.relay = { url: 'https://relay.test/fetch', key: 'k1' };
  const r = await checkRobots('blk2.com', net, Date.now() + 5000);
  eq(r.state, 'unavailable'); eq(r.http_status, 403); ok(!r.via);
});

console.log('\n' + pass + ' 通过，' + fail + ' 失败');
if (fail) process.exit(1);
