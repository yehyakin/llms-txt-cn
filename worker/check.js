/* worker/check.js — /api/check 核心逻辑（纯 ESM，无 import；依赖全部注入，方便 Node 测试）
 *
 * 安全要点（沿用 backend/check.py 的口径，并按 Worker 环境调整）：
 *  - 域名白名单正则；拒绝 IP 字面量、localhost 及保留/内网后缀
 *  - 每一跳先用 DoH 解析，所有 A/AAAA 必须是公网地址，否则拒绝（Workers 出站本身也到不了内网，这是第二道防线）
 *  - 手动跟随重定向，最多 5 跳，每跳重验 scheme / 端口 / 主机 / 解析结果
 *  - 单次请求超时 10s，整体 25s 截止；llms.txt 读 200KB、robots.txt 读 500KiB 后停止
 *  - 不执行目标内容（只当字节读，不渲染、不 eval）
 *  - 不记录域名 / IP：只把 当天日期 + verdict 写入 Analytics Engine（若绑定存在）
 */

export const LIMITS = {
  timeoutMs: 10000,
  deadlineMs: 25000,
  llmsMax: 200 * 1024,
  robotsMax: 500 * 1024,
  maxRedirects: 5,
  rateN: 20,
  rateWindowMs: 60000,
  cacheTtlMs: 5 * 60 * 1000,
  accessDeadlineMs: 45000,
  pageMax: 1536 * 1024,
  sitemapMax: 4096
};
export const UA = 'cetxt-check/2.0 (+https://cetxt.com/)';
import { classifyAccess } from './access.js';
import { analyzePage } from './seo.js';

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const BLOCKED_SUFFIX = ['localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home', 'corp', 'arpa', 'onion', 'test', 'invalid', 'example', 'home.arpa'];

/* ---------------- 域名与地址校验 ---------------- */
export function cleanDomain(raw) {
  let s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!s || s.length > 300) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s;
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.username || u.password) return null;
  const host = (u.hostname || '').replace(/\.+$/, '');
  return validHost(host) ? host : null;
}

export function validHost(host) {
  host = String(host || '').toLowerCase();
  if (!host || host.indexOf('[') >= 0 || host.indexOf(':') >= 0) return false; // IPv6 字面量
  if (/^[0-9.]+$/.test(host)) return false;                                      // IPv4 字面量
  if (/^0x/i.test(host)) return false;
  if (!HOST_RE.test(host)) return false;
  for (const suf of BLOCKED_SUFFIX) if (host === suf || host.endsWith('.' + suf)) return false;
  return true;
}

function v4num(ip) {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) { if (!/^\d{1,3}$/.test(x) || +x > 255) return null; n = n * 256 + (+x); }
  return n;
}
function inCidr4(n, base, bits) {
  const b = v4num(base); const size = Math.pow(2, 32 - bits);
  return Math.floor(n / size) === Math.floor(b / size);
}
const V4_BLOCKS = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
];
function expand6(ip) {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%'); if (zone >= 0) s = s.slice(0, zone);
  let tail4 = null;
  const m = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (m) { tail4 = m[1]; s = s.slice(0, -m[1].length) + '0:0'; }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = 8 - head.length - tail.length;
  if (parts.length === 1 && head.length !== 8) return null;
  if (fill < 0) return null;
  const all = head.concat(new Array(parts.length === 2 ? fill : 0).fill('0'), tail).map(h => parseInt(h || '0', 16));
  if (all.length !== 8 || all.some(x => isNaN(x) || x < 0 || x > 0xffff)) return null;
  if (tail4) { const n = v4num(tail4); all[6] = Math.floor(n / 65536); all[7] = n % 65536; }
  return all;
}
export function isPublicIP(ip) {
  ip = String(ip || '').trim();
  const n = v4num(ip);
  if (n != null) return !V4_BLOCKS.some(([b, bits]) => inCidr4(n, b, bits));
  const h = expand6(ip);
  if (!h) return false;
  if (h.every(x => x === 0)) return false;                                  // ::
  if (h.slice(0, 7).every(x => x === 0) && h[7] === 1) return false;        // ::1
  if (h.slice(0, 5).every(x => x === 0) && (h[5] === 0xffff || h[5] === 0)) {  // ::ffff:a.b.c.d / ::a.b.c.d
    return isPublicIP(((h[6] >> 8) & 255) + '.' + (h[6] & 255) + '.' + ((h[7] >> 8) & 255) + '.' + (h[7] & 255));
  }
  if ((h[0] & 0xfe00) === 0xfc00) return false;  // fc00::/7
  if ((h[0] & 0xffc0) === 0xfe80) return false;  // fe80::/10
  if ((h[0] & 0xff00) === 0xff00) return false;  // ff00::/8
  if (h[0] === 0x2001 && h[1] === 0x0db8) return false; // 文档地址
  if (h[0] === 0x0064 && h[1] === 0xff9b) return false; // NAT64
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return false; // 100::/64
  if (h[0] === 0x2002) return isPublicIP(((h[1] >> 8) & 255) + '.' + (h[1] & 255) + '.' + ((h[2] >> 8) & 255) + '.' + (h[2] & 255)); // 6to4
  if (h[0] === 0x2001 && h[1] === 0) return false; // Teredo
  return true;
}

/* 默认 DoH 解析器：返回所有 A/AAAA 地址 */
export function makeDohResolver(fetchFn) {
  return async function resolve(host) {
    const q = async (type) => {
      const r = await fetchFn('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=' + type, {
        headers: { accept: 'application/dns-json' }
      });
      if (!r.ok) throw new Error('doh_http_' + r.status);
      const j = await r.json();
      return (j.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => String(a.data));
    };
    const [a, aaaa] = await Promise.all([q('A'), q('AAAA').catch(() => [])]);
    return a.concat(aaaa);
  };
}

async function hostIsSafe(host, deps) {
  if (!validHost(host)) return { ok: false, code: 'bad_host', reason: '目标主机名非法（IP 字面量、内网或保留域名）' };
  let ips;
  try { ips = await deps.resolve(host); } catch (e) { return { ok: false, code: 'dns_fail', reason: '域名解析失败' }; }
  if (!ips || !ips.length) return { ok: false, code: 'dns_fail', reason: '域名无法解析' };
  if (!ips.every(isPublicIP)) return { ok: false, code: 'dns_blocked', reason: '域名解析到了内网或保留地址，已拒绝' };
  return { ok: true };
}

/* ---------------- 受限抓取 ---------------- */
async function readLimited(resp, max) {
  if (!resp.body) { const b = new Uint8Array(await resp.arrayBuffer()); return { bytes: b.subarray(0, max), truncated: b.length > max }; }
  const reader = resp.body.getReader();
  const chunks = []; let total = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); total += value.length;
    if (total > max) { truncated = true; try { await reader.cancel(); } catch (e) {} break; }
  }
  const out = new Uint8Array(Math.min(total, max));
  let off = 0;
  for (const c of chunks) { const n = Math.min(c.length, out.length - off); if (n <= 0) break; out.set(c.subarray(0, n), off); off += n; }
  return { bytes: out, truncated };
}

/* 手动跟跳转；返回 {kind:'response'|'error'|'too_many_redirects', ...} */
export async function fetchLimited(startUrl, opts, deps) {
  const max = opts.maxBytes, deadline = opts.deadline || (Date.now() + LIMITS.deadlineMs);
  let url = startUrl, redirects = 0;
  for (;;) {
    let u;
    try { u = new URL(url); } catch (e) { return { kind: 'error', code: 'bad_url', reason: '重定向地址无效' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'error', code: 'bad_scheme', reason: '仅支持 http/https' };
    if (u.username || u.password) return { kind: 'error', code: 'bad_url', reason: 'URL 含用户名密码，已拒绝' };
    if (u.port && !((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443'))) {
      return { kind: 'error', code: 'bad_port', reason: '只允许默认端口 80/443' };
    }
    const safe = await hostIsSafe(u.hostname.replace(/\.+$/, ''), deps);
    if (!safe.ok) return { kind: 'error', code: safe.code, reason: safe.reason, refused: redirects > 0 };
    const remain = deadline - Date.now();
    if (remain <= 0) return { kind: 'error', code: 'timeout', reason: '整体超时' };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(LIMITS.timeoutMs, remain));
    let resp;
    try {
      resp = await deps.fetch(u.href, {
        method: 'GET', redirect: 'manual', signal: ac.signal,
        headers: { 'user-agent': UA, accept: opts.accept || 'text/plain,*/*' }
      });
    } catch (e) {
      clearTimeout(timer);
      return { kind: 'error', code: (e && e.name === 'AbortError') ? 'timeout' : 'conn_fail',
        reason: (e && e.name === 'AbortError') ? '连接超时（10 秒）' : '连接失败（对方拒连、TLS 失败或网络不可达）', transport: true };
    }
    if ([301, 302, 303, 307, 308].indexOf(resp.status) >= 0) {
      clearTimeout(timer);
      try { if (resp.body) await resp.body.cancel(); } catch (e) {}
      const loc = resp.headers.get('location');
      if (!loc) return { kind: 'error', code: 'bad_redirect', reason: '重定向缺少 Location' };
      if (redirects >= LIMITS.maxRedirects) return { kind: 'too_many_redirects', final_url: u.href, redirects };
      redirects++;
      try { url = new URL(loc, u.href).href; } catch (e) { return { kind: 'error', code: 'bad_redirect', reason: '重定向地址无效' }; }
      continue;
    }
    let body = { bytes: new Uint8Array(0), truncated: false };
    try {
      if (resp.status >= 200 && resp.status < 300) body = await readLimited(resp, max);
      else if (resp.body) await resp.body.cancel();
    } catch (e) {
      clearTimeout(timer);
      return { kind: 'error', code: 'timeout', reason: '读取响应超时', transport: true };
    }
    clearTimeout(timer);
    return { kind: 'response', status: resp.status, content_type: resp.headers.get('content-type') || '',
      bytes: body.bytes, truncated: body.truncated, final_url: u.href, redirects, x_robots: resp.headers.get('x-robots-tag') || '' };
  }
}

/* ---------------- 解码 ---------------- */
export function decodeBody(bytes, ctype) {
  const m = /charset=([\w-]+)/i.exec(ctype || '');
  const cands = (m ? [m[1]] : []).concat(['utf-8', 'gb18030']);
  for (const enc of cands) {
    try {
      let t = new TextDecoder(enc, { fatal: true }).decode(bytes);
      if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
      return t;
    } catch (e) {}
  }
  return new TextDecoder('utf-8').decode(bytes);
}

const MD_LINK_RE = /\[[^\]]+\]\(https?:\/\//i;
export function classifyLlms(status, ctype, text) {
  if (status === 404) return 'missing';
  const ct = (ctype || '').toLowerCase();
  const st = (text || '').replace(/^\s+/, '').toLowerCase();
  if (ct.indexOf('text/html') >= 0 || st.startsWith('<!doctype html') || st.startsWith('<html')) return 'html_spoof';
  if ((text || '').replace(/^\s+/, '').startsWith('#') || MD_LINK_RE.test(text || '')) return 'real';
  return 'nonstandard';
}

/* https 优先；仅传输层失败时回落 http */
async function fetchDirect(domain, path, opts, deps) {
  let r = await fetchLimited('https://' + domain + path, opts, deps);
  if (r.kind === 'error' && r.transport) {
    const r2 = await fetchLimited('http://' + domain + path, opts, deps);
    r2.httpFallback = true;
    return r2;
  }
  return r;
}

/* Worker 出口被对方拦截的典型表现：403/412/429/5xx（含 Cloudflare 52x/530）或传输层失败 */
export function looksBlocked(r) {
  if (!r) return false;
  if (r.kind === 'error') return !!r.transport || r.code === 'timeout';
  if (r.kind === 'response') return r.status === 403 || r.status === 412 || r.status === 429 || r.status >= 500;
  return false;
}

function b64ToBytes(s) {
  const bin = atob(s || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* 回落：交给自有服务器代抓（relay.cetxt.com），它自己做 SSRF 防护与跟跳转 */
export async function fetchViaRelay(url, opts, deps) {
  const ac = new AbortController();
  const remain = (opts.deadline || (Date.now() + LIMITS.deadlineMs)) - Date.now();
  if (remain <= 1000) return null;
  const timer = setTimeout(() => ac.abort(), Math.min(remain, 22000));
  try {
    const resp = await deps.fetch(deps.relay.url, {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-relay-key': deps.relay.key },
      body: JSON.stringify({ url, max: opts.maxBytes, accept: opts.accept || 'text/plain,*/*' })
    });
    if (!resp.ok) return null;
    const j = await resp.json();
    if (!j || !j.kind) return null;
    if (j.kind === 'response') {
      return { kind: 'response', status: j.status, content_type: j.content_type || '', bytes: b64ToBytes(j.body_b64),
        truncated: !!j.truncated, final_url: j.final_url, redirects: j.redirects || 0, via: 'relay', x_robots: (j.headers && j.headers['x-robots-tag']) || '' };
    }
    return Object.assign({}, j, { via: 'relay' });
  } catch (e) { return null; }
  finally { clearTimeout(timer); }
}

async function fetchHttpsFirst(domain, path, opts, deps) {
  const r = await fetchDirect(domain, path, opts, deps);
  if (!deps.relay || !deps.relay.url || !deps.relay.key || !looksBlocked(r)) return r;
  const r2 = await fetchViaRelay('https://' + domain + path, opts, deps);
  if (!r2) return r;
  // 中转也失败（传输层）时，保留直连结果；否则以中转结果为准
  if (r2.kind === 'error' && r2.transport && r.kind === 'response') return r;
  return r2;
}

export async function checkLlms(domain, deps, deadline) {
  const r = await fetchHttpsFirst(domain, '/llms.txt', { maxBytes: LIMITS.llmsMax, accept: 'text/markdown,text/plain,*/*', deadline }, deps);
  if (r.kind === 'too_many_redirects') return { verdict: 'unknown', reason: '重定向次数过多', code: 'redirect_loop' };
  if (r.kind === 'error') return { verdict: 'unknown', reason: r.reason, code: r.code };
  if (r.status === 404) return { verdict: 'missing', http_status: 404, final_url: r.final_url };
  if (r.status !== 200) return { verdict: 'unknown', reason: '对方返回 HTTP ' + r.status, code: 'http_' + r.status, http_status: r.status, final_url: r.final_url };
  const text = decodeBody(r.bytes, r.content_type);
  const verdict = classifyLlms(200, r.content_type, text);
  const out = { verdict, http_status: 200, final_url: r.final_url };
  if (r.via) out.via = r.via;
  if (verdict === 'real' || verdict === 'nonstandard') { out.text = text; out.truncated = r.truncated; }
  return out;
}

export async function checkRobots(domain, deps, deadline) {
  const r = await fetchHttpsFirst(domain, '/robots.txt', { maxBytes: LIMITS.robotsMax, accept: 'text/plain,*/*', deadline }, deps);
  if (r.kind === 'too_many_redirects') return { state: 'too_many_redirects', tooManyRedirects: true, http_status: null, final_url: r.final_url };
  if (r.kind === 'error') {
    if (r.transport || r.code === 'timeout') return { state: 'unreachable', unreachable: true, reason: r.reason, code: r.code };
    // 我们主动拒绝跟随（跳到内网 / 非法端口等），不是对方状态，不能套用 RFC 语义
    return { state: 'refused', reason: r.reason, code: r.code };
  }
  const out = { state: r.status >= 200 && r.status < 300 ? 'ok' : (r.status >= 500 ? 'server_error' : 'unavailable'),
    http_status: r.status, final_url: r.final_url, redirects: r.redirects };
  if (r.via) out.via = r.via;
  if (out.state === 'ok') {
    out.text = decodeBody(r.bytes, 'charset=utf-8');
    out.truncated = r.truncated;
    out.bytes = r.bytes.length;
  }
  return out;
}

/* 首页 HTML：给 seo.js 做“能不能读 / 能不能被引用”检查 */
export async function checkPage(domain, deps, deadline) {
  const r = await fetchHttpsFirst(domain, '/', { maxBytes: LIMITS.pageMax, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', deadline }, deps);
  if (r.kind !== 'response') return { ok: false, code: r.code || r.kind };
  if (r.status !== 200) return { ok: false, code: 'http_' + r.status, http_status: r.status, final_url: r.final_url };
  const ct = (r.content_type || '').toLowerCase();
  if (ct && !/html|xml/.test(ct)) return { ok: false, code: 'not_html', final_url: r.final_url };
  return { ok: true, html: decodeBody(r.bytes, r.content_type), final_url: r.final_url, truncated: r.truncated, x_robots: r.x_robots || '', via: r.via };
}
/* sitemap：robots.txt 里声明的第一个，没有就试 /sitemap.xml；只读开头 4KB 判断是不是 XML 站点地图 */
export async function checkSitemap(domain, robotsText, deps, deadline) {
  const m = /^\s*sitemap\s*:\s*(\S+)/im.exec(robotsText || '');
  let url = m ? m[1] : 'https://' + domain + '/sitemap.xml';
  try { url = new URL(url).href; } catch (e) { return { ok: false, declared: !!m, url, status: 'bad_url' }; }
  const so = { maxBytes: LIMITS.sitemapMax, accept: 'application/xml,text/xml,*/*', deadline };
  let r = await fetchLimited(url, so, deps);
  if (deps.relay && deps.relay.url && deps.relay.key && looksBlocked(r)) { const r2 = await fetchViaRelay(url, so, deps); if (r2 && !(r2.kind === 'error' && r2.transport && r.kind === 'response')) r = r2; }
  if (r.kind !== 'response') return { ok: false, declared: !!m, url, status: r.code || r.kind };
  const head = decodeBody(r.bytes, r.content_type).slice(0, 2000);
  const ok = r.status === 200 && (/<(urlset|sitemapindex)\b/i.test(head) || (/^\s*https?:\/\//.test(head) && /text\/plain/i.test(r.content_type)) || /gzip/i.test(r.content_type));
  return { ok, declared: !!m, url: r.final_url || url, status: r.status };
}

/* ---------------- 限频 / 缓存 ---------------- */
/* AI 爬虫实测：交给 relay（非 Cloudflare 出口）用各爬虫 UA 请求首页，原始信号回来后在 access.js 判定 */
export async function probeAccess(domain, deps, deadline) {
  if (!deps.relay || !deps.relay.url || !deps.relay.key) return { kind: 'error', code: 'no_relay' };
  const remain = deadline - Date.now();
  if (remain <= 2000) return { kind: 'error', code: 'timeout' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), remain);
  try {
    const resp = await deps.fetch(deps.relay.url.replace(/\/fetch$/, '/probe'), {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-relay-key': deps.relay.key },
      body: JSON.stringify({ domain })
    });
    if (!resp.ok) return { kind: 'error', code: 'relay_' + resp.status };
    return await resp.json();
  } catch (e) { return { kind: 'error', code: 'probe_timeout' }; }
  finally { clearTimeout(timer); }
}

export function makeMemoryLimiter(n, windowMs) {
  const hits = new Map();
  return function ok(key) {
    const now = Date.now();
    let q = hits.get(key) || [];
    q = q.filter(t => now - t < windowMs);
    if (q.length >= n) { hits.set(key, q); return false; }
    q.push(now); hits.set(key, q);
    if (hits.size > 5000) { for (const k of hits.keys()) { hits.delete(k); if (hits.size < 4000) break; } }
    return true;
  };
}

/* ---------------- HTTP 处理 ---------------- */
function json(code, obj, extra) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: Object.assign({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': 'https://cetxt.com',
      'x-content-type-options': 'nosniff'
    }, extra || {})
  });
}

export function createApi(libs) {
  const { AIAUDIT } = libs;
  const memLimit = makeMemoryLimiter(LIMITS.rateN, LIMITS.rateWindowMs);
  const memCache = new Map();
  let crawlerData = null;

  async function loadData(env, deps) {
    if (crawlerData) return crawlerData;
    if (deps.crawlerData) return (crawlerData = deps.crawlerData);
    const r = deps.assetsFetch ? await deps.assetsFetch('/data/ai-crawlers.json')
      : await env.ASSETS.fetch(new Request('https://assets.invalid/data/ai-crawlers.json'));
    crawlerData = await r.json();
    return crawlerData;
  }

  async function rateOk(request, env) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    // Rate Limiting binding 是按机房、最终一致的近似计数；再叠一层 isolate 内存滑窗，任一拒绝即 429
    const memOk = memLimit(ip);
    if (env && env.RL && typeof env.RL.limit === 'function') {
      try { const { success } = await env.RL.limit({ key: ip }); if (!success) return false; } catch (e) {}
    }
    return memOk;
  }

  async function runCheck(domain, env, deps) {
    const t0 = Date.now();
    const deadline = t0 + LIMITS.deadlineMs;
    const wantAccess = !!deps.withAccess;
    const [llms, robots, probe, page] = await Promise.all([checkLlms(domain, deps, deadline), checkRobots(domain, deps, deadline),
      wantAccess ? probeAccess(domain, deps, t0 + LIMITS.accessDeadlineMs) : Promise.resolve(null),
      checkPage(domain, deps, deadline).catch(() => ({ ok: false, code: 'internal' }))]);
    let seo = { ok: false, code: page.code };
    if (page.ok) {
      const sitemap = robots.state === 'refused' ? null : await checkSitemap(domain, robots.text || '', deps, Math.min(deadline, Date.now() + 6000)).catch(() => null);
      try { seo = Object.assign({ ok: true, truncated: !!page.truncated, via: page.via }, analyzePage({ html: page.html, url: page.final_url, xRobots: page.x_robots, sitemap, llms: llms.verdict })); }
      catch (e) { seo = { ok: false, code: 'parse' }; }
    }
    const data = await loadData(env, deps);
    let analysis = null;
    if (robots.state !== 'refused') {
      analysis = AIAUDIT.analyze({
        text: robots.text || '', http_status: robots.http_status == null ? null : robots.http_status,
        unreachable: !!robots.unreachable, tooManyRedirects: !!robots.tooManyRedirects, truncated: !!robots.truncated
      }, data);
    }
    const elapsed = Date.now() - t0;
    llms.elapsed_ms = elapsed;
    // 顶层字段保持旧版 /api/check 结构（domain/verdict/http_status/final_url/text/truncated/reason/code/elapsed_ms）
    return Object.assign({ domain }, llms, {
      llms: Object.assign({}, llms),
      robots: Object.assign({}, robots, { analysis }),
      access: wantAccess ? classifyAccess(probe, analysis && analysis.access, data) : undefined,
      seo,
      data_version: data && data.version,
      elapsed_ms: elapsed
    });
  }

  return async function handle(request, env, ctx, deps) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': 'https://cetxt.com', 'access-control-allow-methods': 'GET' } });
    if (url.pathname === '/api/health') return json(200, { ok: true });
    if (url.pathname !== '/api/check') return json(404, { error: 'not_found' });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, { error: 'method_not_allowed' });
    const domain = cleanDomain(url.searchParams.get('domain'));
    if (!domain) return json(400, { error: 'bad_domain', reason: '域名不合法' });
    if (!(deps && deps.internal) && !(await rateOk(request, env))) return json(429, { error: 'rate_limited', reason: '请求太频繁，稍后再试' });

    const withAccess = url.searchParams.get('access') === '1';
    if (withAccess) deps = Object.assign({}, deps, { withAccess: true });
    const ck = (withAccess ? 'a:' : '') + domain;
    const now = Date.now();
    let result = null, cached = false;
    const hit = memCache.get(ck);
    if (hit && now - hit.t < LIMITS.cacheTtlMs) { result = hit.v; cached = true; }
    const cacheKey = new Request('https://cetxt-check-cache.invalid/' + (withAccess ? 'v5a/' : 'v3/') + encodeURIComponent(domain));
    const cacheApi = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
    if (!result && cacheApi && !deps.noCache) {
      try { const c = await cacheApi.match(cacheKey); if (c) { result = await c.json(); cached = true; } } catch (e) {}
    }
    if (!result) {
      try { result = await runCheck(domain, env, deps); }
      catch (e) { result = { domain, verdict: 'unknown', reason: '内部错误：' + (e && e.name || 'Error'), code: 'internal' }; }
      memCache.set(ck, { t: now, v: result });
      if (memCache.size > 500) memCache.delete(memCache.keys().next().value);
      if (cacheApi && !deps.noCache && result.code !== 'internal') {
        const put = cacheApi.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=300' } })).catch(() => {});
        if (ctx && ctx.waitUntil) ctx.waitUntil(put);
      }
    }
    // 最小计数：只记 当天 + verdict，不记域名 / IP
    try {
      if (env && env.STATS && typeof env.STATS.writeDataPoint === 'function') {
        const day = new Date().toISOString().slice(0, 10);
        env.STATS.writeDataPoint({ blobs: [day, String(result.verdict || 'unknown'), String((result.robots && result.robots.analysis && result.robots.analysis.fetch.policy) || (result.robots && result.robots.state) || 'unknown')], indexes: [day] });
      }
    } catch (e) {}
    return json(200, result, { 'x-cetxt-cache': cached ? 'hit' : 'miss' });
  };
}
