/* worker/lab.js — 公开对照测试集：<slug>-lab.vaksel.com，每个站只改一处。
 * 用途：①任何人都能拿这些站测自己的 AI 可达性工具；②我们引擎的回归测试（scripts/run-lab.mjs）。
 * expect：按 en/grade.js 当前规则，这个站“应该”得到的三层评级 [能不能进, 能不能读, 能不能被引用]。
 * 改这里的行为或预期后：重跑 node scripts/run-lab.mjs（写 data/lab-results.json），再重跑两个 build 脚本。 */

export const LAB_SUFFIX = '-lab.vaksel.com';

const AI_SEARCH = /OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|Claude-SearchBot|Claude-User/i;
const ANY_BOT = /bot|spider|crawl|ChatGPT-User|Perplexity-User|Claude-User/i;
const KNOWN_GOOD = /Googlebot|bingbot|Applebot|Baiduspider/i;

export const FIXTURES = [
  { slug: 'baseline', expect: ['S', 'S', 'S'],
    zh: '对照组：什么都不改。robots 全开、结构化数据齐全、正文不靠 JS。', en: 'Control: nothing changed. robots.txt allows all, full structured data, text without JavaScript.' },
  { slug: 'robots-disallow-all', expect: ['C', 'S', 'S'], robots: 'User-agent: *\nDisallow: /\n',
    zh: 'robots.txt 写 Disallow: /，全站禁止。', en: 'robots.txt says Disallow: / for everyone.' },
  { slug: 'robots-block-oai', expect: ['B', 'S', 'S'], robots: 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n',
    zh: 'robots.txt 只禁止 OAI-SearchBot（ChatGPT 搜索）。', en: 'robots.txt disallows only OAI-SearchBot (ChatGPT search).' },
  { slug: 'robots-block-training', expect: ['S', 'S', 'S'], robots: 'User-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: CCBot\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: *\nAllow: /\n',
    zh: '只禁止训练爬虫（GPTBot、ClaudeBot、CCBot、Google-Extended），搜索爬虫全放行。不该扣分。', en: 'Only training crawlers are disallowed (GPTBot, ClaudeBot, CCBot, Google-Extended); search crawlers are allowed. Should cost nothing.' },
  { slug: 'robots-503', expect: ['C', 'S', 'S'], robotsStatus: 503,
    zh: 'robots.txt 返回 503。按 RFC 9309，爬虫要当作全站禁止。', en: 'robots.txt returns 503. Under RFC 9309 crawlers must treat the site as fully disallowed.' },
  { slug: 'robots-404', expect: ['S', 'S', 'S'], robotsStatus: 404,
    zh: '没有 robots.txt（404）。等于没有限制，不该扣分。', en: 'No robots.txt (404). That means no restrictions and should cost nothing.' },
  { slug: 'fw-ai-403', expect: ['C', 'S', 'S'], fw: 'ai403',
    zh: 'robots.txt 全开，但防火墙对 AI 搜索爬虫的 UA 返回 403，浏览器和 Googlebot 正常。静默拦截。', en: 'robots.txt allows all, but the firewall returns 403 to AI search user agents while browsers and Googlebot get the page. A silent block.' },
  { slug: 'fw-verify-bots', expect: ['A', 'S', 'S'], fw: 'allbots403',
    zh: '防火墙拦所有自称爬虫的请求，包括伪装的 Googlebot。模拟“核验爬虫 IP”的站：真爬虫从官方 IP 来多半能进，只该提示。', en: 'The firewall rejects every request claiming to be a crawler, fake Googlebot included. This mimics a site that verifies crawler IPs, where real crawlers likely get through, so it should only warn.' },
  { slug: 'fw-unknown-bots', expect: ['C', 'S', 'S'], fw: 'unknown403',
    zh: '防火墙放行 Googlebot 等老牌爬虫，拦所有其他爬虫（含 AI 搜索爬虫）。', en: 'The firewall allows Googlebot and other classic crawlers but rejects every other bot, AI search crawlers included.' },
  { slug: 'fw-ai-challenge', expect: ['C', 'S', 'S'], fw: 'aichallenge',
    zh: 'AI 搜索爬虫拿到 200，但内容是“Just a moment...”验证页。状态码看起来正常。', en: 'AI search crawlers get HTTP 200, but the body is a “Just a moment...” challenge page. The status code looks fine.' },
  { slug: 'fw-ai-thin', expect: ['A', 'S', 'S'], fw: 'aithin',
    zh: 'AI 搜索爬虫拿到 200，但正文被删得只剩一句话。', en: 'AI search crawlers get HTTP 200, but the text is cut down to one sentence.' },
  { slug: 'meta-noindex', expect: ['C', 'C', 'S'], page: 'noindex',
    zh: '首页 <meta name="robots" content="noindex">。', en: 'Homepage has <meta name="robots" content="noindex">.' },
  { slug: 'header-noindex', expect: ['C', 'C', 'S'], header: { 'X-Robots-Tag': 'noindex' },
    zh: '页面本身干净，但响应头带 X-Robots-Tag: noindex。', en: 'The HTML is clean, but the response header says X-Robots-Tag: noindex.' },
  { slug: 'nosnippet', expect: ['S', 'C', 'S'], page: 'nosnippet',
    zh: '首页 <meta name="robots" content="nosnippet">。Google 写明 AI 概览只引用能显示摘要的页面。', en: 'Homepage has <meta name="robots" content="nosnippet">. Google says AI Overviews only cite pages eligible for a snippet.' },
  { slug: 'js-only', expect: ['S', 'C', 'S'], page: 'spa',
    zh: '正文全靠 JavaScript 渲染，HTML 里只有空的 <div id="root">。', en: 'All text is rendered by JavaScript; the HTML has only an empty <div id="root">.' },
  { slug: 'llms-html', expect: ['S', 'S', 'S'], llms: 'html',
    zh: '/llms.txt 返回 200 但内容是网页。llms.txt 不该计分，只该提示。', en: '/llms.txt returns 200 with an HTML page. llms.txt should not affect grades, only be flagged.' },
  { slug: 'faq-mismatch', expect: ['S', 'S', 'B'], page: 'faqmismatch',
    zh: 'FAQPage 结构化数据里的问题在页面上看不到。', en: 'The FAQPage structured data lists questions that are not on the page.' },
  { slug: 'jsonld-broken', expect: ['S', 'S', 'B'], page: 'badjson',
    zh: 'JSON-LD 语法错误，解析失败。', en: 'The JSON-LD has a syntax error and fails to parse.' },
  { slug: 'canonical-other-host', expect: ['S', 'A', 'S'], page: 'canonother',
    zh: 'canonical 指向另一个域名。', en: 'The canonical tag points to another domain.' }
];
const BY = Object.fromEntries(FIXTURES.map((f) => [f.slug, f]));

const PARA = 'This page is part of the VAKSEL lab, a public set of test sites. Each site changes exactly one thing from the control, so anyone can check whether an AI visibility tool notices the change. '
  + 'The control has a robots.txt that allows everyone, a sitemap, a canonical tag, Open Graph tags, Organization and WebSite structured data, semantic HTML and enough text to read without JavaScript. ';

function html(f, host) {
  const v = f.page || '';
  const self = 'https://' + host + '/';
  const robots = v === 'noindex' ? '<meta name="robots" content="noindex">' : v === 'nosnippet' ? '<meta name="robots" content="nosnippet">' : '';
  const canon = v === 'canonother' ? 'https://example.com/' : self;
  const name = 'VAKSEL Lab: ' + f.slug;
  let ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', name, url: self, logo: 'https://vaksel.com/icon-512.png' },
    { '@type': 'WebSite', name, url: self }] });
  if (v === 'badjson') ld = ld.replace('"@graph":[', '"@graph":[,');
  let faq = '';
  if (v === 'faqmismatch') faq = '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: 'Does this lab site sell anything?', acceptedAnswer: { '@type': 'Answer', text: 'No.' } },
    { '@type': 'Question', name: 'Is there a hidden discount for AI crawlers?', acceptedAnswer: { '@type': 'Answer', text: 'No.' } }] }) + '</script>';
  const links = ['about', 'method', 'fixtures', 'changelog', 'contact', 'license'].map((p) => `<a href="/${p}/">${p}</a>`).join(' · ');
  const body = v === 'spa'
    ? '<div id="root"></div><script>document.getElementById("root").innerHTML="<main><h1>' + name + '</h1><p>' + PARA.replace(/"/g, '') + '</p></main>"</script>'
    : `<main><h1>${name}</h1><p>${PARA}</p><p>Fixture: ${f.slug}. See https://vaksel.com/research/lab/ for what it changes.</p><p>${PARA}</p><nav>${links}</nav><img src="https://vaksel.com/icon-192.png" alt="VAKSEL fox logo" width="96" height="96"></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} · AI visibility test site</title>
<meta name="description" content="A single-variable test site from the VAKSEL lab (${f.slug}). Each lab site changes one thing so AI visibility tools can be checked.">
${robots}<link rel="canonical" href="${canon}">
<meta property="og:title" content="${name}"><meta property="og:image" content="https://vaksel.com/og/site.png"><meta property="og:site_name" content="${name}">
<script type="application/ld+json">${ld}</script>${faq}</head><body>${body}</body></html>`;
}

const CHALLENGE = '<!doctype html><html><head><title>Just a moment...</title></head><body><p>Checking your browser before accessing the site.</p></body></html>';
const THIN = (f) => `<!doctype html><html><head><title>VAKSEL Lab: ${f.slug}</title></head><body><main><p>Content unavailable.</p></main></body></html>`;

export function isLabHost(h) { return String(h || '').toLowerCase().endsWith(LAB_SUFFIX); }

export function handleLab(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const f = BY[host.slice(0, -LAB_SUFFIX.length)];
  const H = { 'cache-control': 'no-store', 'x-vaksel-lab': f ? f.slug : 'unknown' };
  if (!f) return new Response('Unknown lab site. See https://vaksel.com/research/lab/\n', { status: 404, headers: Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, H) });
  const ua = request.headers.get('user-agent') || '';
  const isAiSearch = AI_SEARCH.test(ua);
  const isBot = ANY_BOT.test(ua);
  const p = url.pathname;

  if (p === '/robots.txt') {
    if (f.robotsStatus) return new Response(f.robotsStatus === 503 ? 'Service Unavailable' : 'Not Found', { status: f.robotsStatus, headers: Object.assign({ 'content-type': 'text/plain' }, H) });
    return new Response((f.robots || 'User-agent: *\nAllow: /\n') + '\nSitemap: https://' + host + '/sitemap.xml\n', { headers: Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, H) });
  }
  if (p === '/sitemap.xml') return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${host}/</loc></url></urlset>`, { headers: Object.assign({ 'content-type': 'application/xml' }, H) });
  if (p === '/llms.txt') {
    if (f.llms === 'html') return new Response(html(f, host), { headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, H) });
    return new Response('Not Found', { status: 404, headers: H });
  }

  /* 防火墙行为（只作用于页面，不作用于 robots.txt） */
  if (f.fw === 'ai403' && isAiSearch) return new Response('Forbidden', { status: 403, headers: H });
  if (f.fw === 'allbots403' && isBot) return new Response('Forbidden', { status: 403, headers: H });
  if (f.fw === 'unknown403' && isBot && !KNOWN_GOOD.test(ua)) return new Response('Forbidden', { status: 403, headers: H });
  if (f.fw === 'aichallenge' && isAiSearch) return new Response(CHALLENGE, { headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, H) });
  if (f.fw === 'aithin' && isAiSearch) return new Response(THIN(f), { headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, H) });

  const hdr = Object.assign({ 'content-type': 'text/html; charset=utf-8' }, H, f.header || {});
  if (p === '/' || p === '/index.html') return new Response(html(f, host), { headers: hdr });
  return new Response(html(f, host), { headers: hdr }); /* 站内链接都回同一页，免得 404 */
}
