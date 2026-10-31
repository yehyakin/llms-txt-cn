/* worker/index.js — cetxt Worker 入口
 * - 静态页：优先用 Workers Static Assets（env.ASSETS，wrangler 部署）；
 *   没有 ASSETS 绑定时用构建时内嵌的文件（scripts/build-worker.mjs --embed），行为对齐 auto-trailing-slash + 404-page
 * - /api/check?domain=  一次返回 llms.txt + robots.txt 两部分结果 */
import { ROBOTS, AIAUDIT } from './_libs.js';
import { EMBED } from './_assets.js';
import { createApi, makeDohResolver } from './check.js';

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
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const f = (u, init) => fetch(u, init);
      return api(request, env, ctx, { fetch: f, resolve: makeDohResolver(f), assetsFetch: EMBED && !env.ASSETS ? (p) => embedResponse(p, request) : null });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
    if (env.ASSETS) {
      if (url.pathname === '/404' || url.pathname === '/404.html') return secure(await env.ASSETS.fetch(new Request(new URL('/404.html', url), request)), 404);
      return secure(await env.ASSETS.fetch(request));
    }
    if (EMBED) return secure(serveEmbedded(request));
    return new Response('no assets', { status: 500 });
  }
};
