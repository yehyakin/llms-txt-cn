/* worker/report.js — /en/report/<domain> 服务端渲染
 * - 分享预览/搜索爬虫（UA 判断）：等检测结果，整页一次返回，<head> 带结论（title/description/og）。
 * - 普通访客：先流式返回页头 + 加载动画，结果出来后在同一响应里续写报告（无需前端再请求）。
 * - 结果走 /api/check?access=1 同一套限频与 5 分钟缓存。 */
import { renderReport, cleanDomain, esc } from '../en/view.js';

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|slack|discord|telegram|whatsapp|linkedin|skype|pinterest|vkshare|quora|redditbot|applebot|bingpreview|google-inspectiontool|chatgpt|perplexity|claude/i;

export function isPreviewBot(ua) { return BOT_UA.test(ua || ''); }

function cut(tpl, name) {
  const a = tpl.indexOf('<!--' + name + '-->'), b = tpl.indexOf('<!--/' + name + '-->');
  if (a < 0 || b < 0) throw new Error('template marker ' + name);
  return [tpl.slice(0, a), tpl.slice(b + name.length + 8)];
}
function fill(tpl, name, html) { const [x, y] = cut(tpl, name); return x + html + y; }

export function headFor(domain, origin, opts) {
  const o = opts || {};
  const url = origin + '/en/report/' + domain;
  const title = o.title ? domain + ': ' + o.title + ' · cetxt' : domain + ' AI crawler access report · cetxt';
  const desc = o.summary || ('Can ChatGPT, Perplexity and Claude reach ' + domain + '? Live robots.txt, firewall and page checks for 10 AI crawlers.');
  return '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n' +
    '<meta name="robots" content="' + (o.index ? 'index,follow' : 'noindex') + '">\n<link rel="canonical" href="' + esc(url) + '">\n' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="cetxt">\n' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">\n' +
    '<meta property="og:url" content="' + esc(url) + '"><meta property="og:image" content="' + esc(origin) + '/og.png">\n' +
    '<meta name="twitter:card" content="summary_large_image">';
}

function errorText(status, j) {
  if (status === 429) return 'Too many checks from your network. Try again in a minute.';
  if (j && j.error === 'bad_domain') return 'That doesn’t look like a valid domain.';
  return 'Something went wrong. Please try again.';
}

async function runCheck(api, request, domain) {
  const u = new URL(request.url);
  const req = new Request(u.origin + '/api/check?access=1&domain=' + encodeURIComponent(domain), { headers: request.headers });
  try {
    const r = await api(req);
    const j = await r.json();
    return { status: r.status, j };
  } catch (e) { return { status: 500, j: null }; }
}

/* deps: { template: async () => string, api: async (Request) => Response, index: bool, now?: () => string } */
export async function handleReport(request, deps, ctx) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/en\/report\/([^/]+)\/?$/);
  let raw = m ? m[1] : '';
  try { raw = decodeURIComponent(raw); } catch (e) {}
  const domain = cleanDomain(raw);
  if (!domain) return null;
  if (m[1] !== domain) return Response.redirect(url.origin + '/en/report/' + domain, 301);

  const tpl0 = await deps.template();
  const tpl = fill(tpl0, 'DOM', esc(domain));
  const now = deps.now || (() => new Date().toISOString());
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
  const shareUrl = url.origin + '/en/report/' + domain;

  const renderInto = (res) => {
    if (res.status !== 200 || !res.j || res.j.error) return { meta: '', html: '<div class="loading">' + esc(errorText(res.status, res.j)) + '</div>', head: null };
    const o = renderReport(res.j, { url: shareUrl, when: now() });
    return { meta: o.meta, html: o.html, title: o.title, summary: o.summary };
  };

  if (request.method === 'HEAD') return new Response(null, { headers });

  if (isPreviewBot(request.headers.get('user-agent'))) {
    const res = await runCheck(deps.api, request, domain);
    const o = renderInto(res);
    let page = fill(tpl, 'HEAD', headFor(domain, url.origin, { title: o.title, summary: o.summary, index: deps.index && res.status === 200 }));
    page = fill(page, 'META', o.meta);
    page = fill(page, 'OUT', o.html);
    return new Response(page, { status: res.status === 429 ? 429 : 200, headers });
  }

  // 访客：流式。先发到加载动画为止，再续写结果和余下模板。
  let page = fill(tpl, 'HEAD', headFor(domain, url.origin, { index: deps.index }));
  page = fill(page, 'META', '');
  const [before, after] = cut(page, 'OUT');
  const loader = '<div class="loading" id="ld"><div class="spin"></div>Requesting the homepage as 13 different clients…<div class="steps">robots.txt · firewall · page content</div></div>';
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  const enc = new TextEncoder();
  const work = (async () => {
    try {
      await w.write(enc.encode(before + loader));
      const res = await runCheck(deps.api, request, domain);
      const o = renderInto(res);
      let tail = '<style>#ld{display:none}</style>' + o.html;
      const js = [];
      if (o.meta) js.push('document.getElementById("meta").innerHTML=' + JSON.stringify(o.meta).replace(/</g, '\\u003c') + ';');
      if (o.title) js.push('document.title=' + JSON.stringify(domain + ': ' + o.title + ' · cetxt').replace(/</g, '\\u003c') + ';');
      if (js.length) tail += '<script>' + js.join('') + '</script>';
      await w.write(enc.encode(tail + after));
    } catch (e) {
      try { await w.write(enc.encode('<div class="loading">Something went wrong.</div>' + after)); } catch (e2) {}
    } finally { try { await w.close(); } catch (e) {} }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(work);
  return new Response(readable, { status: 200, headers });
}
