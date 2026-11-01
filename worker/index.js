/* worker/index.js — cetxt Worker 入口
 * - 静态页：优先用 Workers Static Assets（env.ASSETS，wrangler 部署）；
 *   没有 ASSETS 绑定时用构建时内嵌的文件（scripts/build-worker.mjs --embed），行为对齐 auto-trailing-slash + 404-page
 * - /api/check?domain=  一次返回 llms.txt + robots.txt 两部分结果 */
import { ROBOTS, AIAUDIT } from './_libs.js';
import { EMBED } from './_assets.js';
import { createApi, makeDohResolver } from './check.js';
import { handleReport, rebase } from './report.js';
import { cleanDomain, ogData } from '../en/view.js';
import { confirmEmail } from './mail.js';

/* 品牌域名：根目录直接是英文版（站内文件仍放在 /en/ 下） */
const BRAND_HOSTS = new Set(['vaksel.com', 'www.vaksel.com']);
export function isBrandHost(h) { return BRAND_HOSTS.has((h || '').toLowerCase()); }

async function brandRewrite(resp, indexable) {
  if (resp.headers.get('x-rebased') === '1') return resp;
  const h = new Headers(resp.headers);
  const loc = h.get('location');
  if (loc) h.set('location', loc.replace(/^(https?:\/\/[^/]+)?\/en(\/|$)/, (m0, o) => (o || '') + '/'));
  if (/^text\/html/.test(h.get('content-type') || '') && resp.body) {
    let t = rebase(await resp.text(), '');
    if (indexable && resp.status === 200) t = t.replace('<meta name="robots" content="noindex">', '<meta name="robots" content="index,follow">');
    h.delete('content-length'); h.delete('etag');
    return new Response(t, { status: resp.status, statusText: resp.statusText, headers: h });
  }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

const api = createApi({ ROBOTS, AIAUDIT });

function secure(resp, status) {
  const r = new Response(resp.body, { status: status || resp.status, statusText: resp.statusText, headers: resp.headers });
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return r;
}

const decoded = new Map();
function bytesOf(path) {
  let b = decoded.get(path);
  if (!b) { const bin = atob(EMBED[path].b); b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); decoded.set(path, b); }
  return b;
}
function embedResponse(path, request, status) {
  const f = EMBED[path];
  const etag = '"' + f.e + '"';
  const headers = { 'content-type': f.t, etag, 'cache-control': /^text\/html/.test(f.t) ? 'public, max-age=0, must-revalidate' : 'public, max-age=3600' };
  if (!status && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : bytesOf(path), { status: status || 200, headers });
}
function serveEmbedded(request) {
  const url = new URL(request.url);
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { p = url.pathname; }
  if (p === '/404' || p === '/404.html') return embedResponse('/404.html', request, 404);
  if (p.endsWith('/')) { if (EMBED[p + 'index.html']) return embedResponse(p + 'index.html', request); }
  else if (EMBED[p]) {
    if (p.endsWith('/index.html')) return Response.redirect(new URL(p.slice(0, -10) + url.search, url), 307);
    return embedResponse(p, request);
  } else if (EMBED[p + '/index.html']) return Response.redirect(new URL(p + '/' + url.search, url), 307);
  else if (EMBED[p + '.html']) return embedResponse(p + '.html', request);
  return embedResponse('/404.html', request, 404);
}

export default {
  async fetch(request, env, ctx) {
    const brand = isBrandHost(new URL(request.url).hostname);
    if (brand) {
      const u0 = new URL(request.url);
      if (u0.hostname.startsWith('www.')) { u0.hostname = u0.hostname.slice(4); return Response.redirect(u0.toString(), 301); }
      if (u0.pathname === '/en' || u0.pathname.startsWith('/en/')) { u0.pathname = u0.pathname.slice(3) || '/'; return Response.redirect(u0.toString(), 301); }
      if (!u0.pathname.startsWith('/api/')) {
        u0.pathname = '/en' + u0.pathname;
        const r = await route(new Request(u0.toString(), request), env, ctx, '');
        // INDEX_SITE=1：品牌域名的内容页放开收录（报告页仍由 INDEX_REPORTS 单独控制）
        return brandRewrite(r, env.INDEX_SITE === '1' && !u0.pathname.startsWith('/en/report'));
      }
    }
    return route(request, env, ctx, '/en');
  }
};

/* 分享图：/en/og/<domain>.png（报告）与 /en/og/site.png（站点通用），边缘缓存 1 小时 */
async function ogImage(name, request, env, ctx, apiDeps) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL(request.url).origin + '/__og/v2/' + name + '.png');
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const { reportImage, siteImage } = await import('./og.js');
  let img;
  if (name === 'site') img = await siteImage();
  else {
    const domain = cleanDomain(name);
    if (!domain) return new Response('bad domain', { status: 404 });
    let j = null;
    try {
      const r = await api(new Request(new URL(request.url).origin + '/api/check?access=1&domain=' + encodeURIComponent(domain), { headers: request.headers }), env, ctx, apiDeps);
      if (r.status === 200) j = await r.json();
    } catch (e) {}
    img = await reportImage(j && !j.error ? { domain, ...ogData(j) } : { domain, title: 'AI crawler access report', tone: 'gray', total: 0 });
  }
  const resp = new Response(img.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } });
  if (cache) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

/* 早鸟名单：存 KV（WAITLIST），不存 IP，只存国家 */
async function waitlist(request, env) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return J({ error: 'method' }, 405);
  if (!env.WAITLIST) return J({ error: 'unavailable' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (env.RL && typeof env.RL.limit === 'function') { try { const { success } = await env.RL.limit({ key: 'wl:' + ip }); if (!success) return J({ error: 'rate_limited' }, 429); } catch (e) {} }
  let b; try { b = await request.json(); } catch (e) { return J({ error: 'bad_json' }, 400); }
  if (b.hp) return J({ ok: true });
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return J({ error: 'bad_email' }, 400);
  const plan = b.plan === 'agency' ? 'agency' : 'pro';
  const site = cleanDomain(String(b.site || '')) || '';
  const now = new Date().toISOString();
  const lang = b.lang === 'zh' ? 'zh' : 'en';
  const rec = { email, plan, site, lang, plugin: !!b.plugin, at: now, country: (request.cf && request.cf.country) || '', host: new URL(request.url).hostname };
  const isNew = !(await env.WAITLIST.get('wl:' + email));
  await env.WAITLIST.put('wl:' + email, JSON.stringify(rec), { metadata: { plan, at: now } });
  if (isNew && env.RESEND_KEY) { try { await sendMail(env, email, confirmEmail(plan, site, lang)); } catch (e) {} }
  return J({ ok: true });
}

/* 联系表单：存 KV（ct:<时间>:<随机>），不存 IP */
async function contact(request, env) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return J({ error: 'method' }, 405);
  if (!env.WAITLIST) return J({ error: 'unavailable' }, 503);
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (env.RL && typeof env.RL.limit === 'function') { try { const { success } = await env.RL.limit({ key: 'ct:' + ip }); if (!success) return J({ error: 'rate_limited' }, 429); } catch (e) {} }
  let b; try { b = await request.json(); } catch (e) { return J({ error: 'bad_json' }, 400); }
  if (b.hp) return J({ ok: true });
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return J({ error: 'bad_email' }, 400);
  const message = String(b.message || '').trim().slice(0, 2000);
  if (!message) return J({ error: 'empty' }, 400);
  const topic = ['question', 'data', 'feedback', 'other'].includes(b.topic) ? b.topic : 'other';
  const now = new Date().toISOString();
  await env.WAITLIST.put('ct:' + now + ':' + Math.random().toString(36).slice(2, 8), JSON.stringify({ email, topic, message, at: now, country: (request.cf && request.cf.country) || '' }), { metadata: { topic, at: now } });
  return J({ ok: true });
}

/* 确认邮件：只有配置了 RESEND_KEY（wrangler secret）才发；发件域 mail.vaksel.com */
export async function sendMail(env, to, m) {
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: m.from || env.MAIL_FROM || 'VAKSEL <hello@mail.vaksel.com>', to: [to], subject: m.subject, text: m.text, html: m.html, reply_to: env.MAIL_REPLY_TO || undefined }) });
}

async function route(request, env, ctx, base) {
    const url = new URL(request.url);
    const f = (u, init) => fetch(u, init);
    const relay = env.RELAY_URL && env.RELAY_KEY ? { url: env.RELAY_URL, key: env.RELAY_KEY } : null;
    const apiDeps = { fetch: f, resolve: makeDohResolver(f), relay, assetsFetch: EMBED && !env.ASSETS ? (p) => embedResponse(p, request) : null };
    if (url.pathname === '/api/waitlist') return waitlist(request, env);
    if (url.pathname === '/api/contact') return contact(request, env);
    if (url.pathname.startsWith('/api/')) return api(request, env, ctx, apiDeps);
    const og = url.pathname.match(/^\/(?:en\/)?og\/([a-z0-9.-]+)\.png$/);
    if (og && (request.method === 'GET' || request.method === 'HEAD')) return ogImage(og[1], request, env, ctx, apiDeps);
    const zhRep = /^\/report\/[^/]+\/?$/.test(url.pathname);
    if ((zhRep || /^\/en\/report\/[^/]+\/?$/.test(url.pathname)) && (request.method === 'GET' || request.method === 'HEAD')) {
      const r = await handleReport(request, {
        lang: zhRep ? 'zh' : 'en',
        template: async () => {
          const tp = zhRep ? '/report/' : '/en/report/';
          const t = env.ASSETS ? await env.ASSETS.fetch(new Request(new URL(tp, url))) : embedResponse(tp + 'index.html', new Request(url));
          return t.text();
        },
        api: (req) => api(req, env, ctx, apiDeps),
        index: env.INDEX_REPORTS === '1',
        base
      }, ctx);
      if (r) return r;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
    if (env.ASSETS) {
      if (url.pathname === '/404' || url.pathname === '/404.html') return secure(await env.ASSETS.fetch(new Request(new URL('/404.html', url), request)), 404);
      const r = await env.ASSETS.fetch(request);
      // 英文站（/en/ 下）用英文 404
      if (r.status === 404 && url.pathname.startsWith('/en/')) return secure(await env.ASSETS.fetch(new Request(new URL('/en/404', url), request)), 404);
      return secure(r);
    }
    if (EMBED) return secure(serveEmbedded(request));
    return new Response('no assets', { status: 500 });
}

