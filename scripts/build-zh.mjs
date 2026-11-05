// 生成中文站（cetxt.com，品牌 VAKSEL 中文版）新结构页面：首页、报告页模板、修复指南、AI 爬虫百科、研究方法、监控（早期体验）、隐私/条款/联系、404、sitemap。
// 用法：node scripts/build-zh.mjs（改文案或 data/*.json、scripts/zh-content.mjs 后重跑并提交）。
// 旧页面保留：/tools/（llms.txt 生成器/在线体检/校验器）、/survey/、/faq/、/guide/*。样式共用 /en/app.css。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../en/view.js';
import { zhHome } from './zh-home.mjs';
import { GRADE_VERSION } from '../en/grade.js';
import { FIXTURES, LAB_SUFFIX } from '../worker/lab.js';
const LAB = JSON.parse(readFileSync(new URL('../data/lab-results.json', import.meta.url), 'utf8'));
import { GUIDES_ZH, RESEARCH_ZH, PRIVACY_ZH, TERMS_ZH, CONTACT_ZH, HOME_FAQ_ZH, PRICING_FAQ_ZH, EXAMPLES_ZH } from './zh-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://cetxt.com';
const EN = 'https://vaksel.com';
const UPDATED = '2026-11-03';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const NAV = (active, enPath) => `<a class="skip" href="#main">跳到正文</a>
<nav class="nav" aria-label="主导航"><div class="wrap">
  <a class="logo" href="/" aria-label="VAKSEL 中文版首页"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31"><span class="zhtag">中文版</span></a>
  <div class="links" id="navlinks">
    ${[['guides', '/guides/', '修复指南'], ['bots', '/bots/', 'AI 爬虫'], ['tools', '/tools/', 'llms.txt 工具'], ['survey', '/survey/', '普查报告'], ['pricing', '/pricing/', '监控']].map(([k, h, t]) => `<a class="n${active === k ? ' on' : ''}" href="${h}"${active === k ? ' aria-current="page"' : ''}>${t}</a>`).join('\n    ')}
    <a class="n lang" href="${EN}${enPath || '/'}" hreflang="en" lang="en">EN</a>
  </div>
  <button class="menu" type="button" aria-label="菜单" aria-expanded="false" aria-controls="navlinks"><span></span><span></span></button>
</div></nav>
<script>(()=>{const n=document.currentScript.previousElementSibling,b=n.querySelector('.menu');b.onclick=()=>{const o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&n.classList.contains('open')){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus()}})})()</script>`;

export const FOOT = (enPath) => `<footer><div class="wrap fgrid">
  <div class="fbrand"><a class="logo" href="/"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31" loading="lazy"><span class="zhtag">中文版</span></a><p>AI 搜索到底能不能访问你的网站？免费检测 robots.txt、防火墙和 CDN 拦截。</p></div>
  <div><h2 class="fh">产品</h2><a href="/">可访问性检测</a><a href="/pricing/">监控（早期体验）</a><a href="/research/">研究方法</a><a href="/tools/">llms.txt 工具</a></div>
  <div><h2 class="fh">修复指南</h2><a href="/guides/cloudflare/">Cloudflare</a><a href="/guides/cloudfront/">CloudFront / AWS WAF</a><a href="/guides/wordpress/">WordPress</a><a href="/guides/shopify/">Shopify</a><a href="/guides/edgeone/">腾讯云 EdgeOne</a><a href="/guides/aliyun/">阿里云 ESA</a><a href="/guides/baota/">宝塔面板</a><a href="/guides/baidu/">百度智能云</a></div>
  <div><h2 class="fh">资料</h2><a href="/bots/">AI 爬虫百科</a><a href="/bots/changelog/">爬虫变更日志</a><a href="/survey/">中文大站普查</a><a href="/guide/what-is-llms-txt/">llms.txt 是什么</a><a href="/faq/">常见问题</a></div>
  <div class="fsmall"><span>© 2026 VAKSEL · cetxt.com 是 VAKSEL 中文版</span><a href="/privacy/">隐私</a><a href="/terms/">条款</a><a href="/contact/">联系</a><a href="${EN}${enPath || '/'}" hreflang="en" lang="en">English</a><span>我们不保存你检测的域名和 IP。</span></div>
</div></footer>`;

const HEADX = `<link rel="icon" href="/en/brand/vaksel-favicon.svg" type="image/svg+xml"><link rel="icon" href="/en/brand/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/en/brand/apple-touch-icon.png">
<link rel="preload" href="/en/fonts/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/en/fonts/jetbrains-mono-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/en/app.css">`;

// 内页深色版（2026-11-04，与英文站同一套 home-dark.css + inner.css）；旧页面换壳（.lg 普查页）传 theme: '' 保持浅色
const THEME_BOOT = `<script>try{if(localStorage.getItem('vk-theme')==='light'){document.documentElement.classList.add('lt');document.querySelector('meta[name=theme-color]').content='#ffffff'}}catch(e){}</script>`;
function themeNavZh(html) {
  return html
    .replace(/<img src="\/en\/brand\/vaksel-horizontal-primary.svg"([^>]*)>/, '<img class="lg-d" src="/en/brand/vaksel-horizontal-reverse.svg"$1><img class="lg-l" src="/en/brand/vaksel-horizontal-primary.svg"$1>')
    .replace(/(<a class="n lang"[^>]*>[^<]*<\/a>)/, `$1\n    <button class="n thm" type="button" aria-label="切换外观" title="浅色 / 深色"><svg class="i-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> <svg class="i-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button>`)
    .replace('</script>', `;(()=>{const b=document.querySelector('.thm'),r=document.documentElement,m=document.querySelector('meta[name=theme-color]');const set=l=>{r.classList.toggle('lt',l);b.setAttribute('aria-pressed',l);m&&(m.content=l?'#ffffff':'#0a0a0a');try{localStorage.setItem('vk-theme',l?'light':'dark')}catch(e){}};b.setAttribute('aria-pressed',r.classList.contains('lt'));b.onclick=()=>set(!r.classList.contains('lt'))})()</script>`);
}
const logoSwap = (h) => h.replace(/<img src="\/en\/brand\/vaksel-horizontal-primary.svg"([^>]*)>/, '<img class="lg-d" src="/en/brand/vaksel-horizontal-reverse.svg"$1><img class="lg-l" src="/en/brand/vaksel-horizontal-primary.svg"$1>');
function page({ path, title, desc, body, active, ld, en, type = 'article', head = '', robots = 'noindex', theme = 'dk in' }) {
  const enPath = en === undefined ? path : en;
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}"><meta name="theme-color" content="${theme ? '#0a0a0a' : '#ffffff'}">
<link rel="canonical" href="${SITE}${path}">
${enPath ? `<link rel="alternate" hreflang="zh-CN" href="${SITE}${path}"><link rel="alternate" hreflang="en" href="${EN}${enPath}">` : ''}
<meta property="og:type" content="${type}"><meta property="og:site_name" content="VAKSEL"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
${HEADX}${theme ? '<link rel="stylesheet" href="/en/home-dark.css"><link rel="stylesheet" href="/en/inner.css">' + THEME_BOOT : ''}${head ? '\n' + head : ''}${ld ? `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body class="zh${theme ? ' ' + theme : ''}">
${theme ? logoSwap(themeNavZh(NAV(active, enPath))) : NAV(active, enPath)}
${body.includes('<main') ? body.replace('<main ', '<main id="main" tabindex="-1" ') : '<main id="main" tabindex="-1">' + body + '</main>'}
${theme ? logoSwap(FOOT(enPath)) : FOOT(enPath)}
</body></html>
`;
}
const out = [];
function write(rel, html) { const abs = join(root, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, html); out.push(rel); return rel; }
const crumbs = (items) => '<div class="crumb">' + items.map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join(' <span>/</span> ') + '</div>';
const checkBox = (title = '现在检测你的网站', sub = '免费，无需注册。我们以 18 种不同身份请求你的首页，告诉你每个请求拿到了什么。') => `
<div class="cta mini"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
<form class="field inv" data-check autocomplete="off"><input placeholder="你的域名，例如 example.com" aria-label="域名" spellcheck="false" autocapitalize="off"><button class="btn">检测</button></form></div>`;
const CHECK_JS = `<script>
document.querySelectorAll('[data-check]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let v=(f.querySelector('input').value||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0];if(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v))location.href='/report/'+v;else{f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake')}}));
</script>`;

/* ---------- 报告页模板（Worker SSR 用 <!--HEAD--> 等标记填充） ---------- */
write('report/index.html', `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<!--HEAD--><title>AI 爬虫可访问性报告 · VAKSEL</title>
<meta name="robots" content="noindex"><!--/HEAD--><meta name="theme-color" content="#0a0a0a">
${HEADX}<link rel="stylesheet" href="/en/home-dark.css"><link rel="stylesheet" href="/en/inner.css">${THEME_BOOT}
</head><body class="zh dk in">
${logoSwap(themeNavZh(NAV('', '/report/')))}
<main class="wrap" id="main">
  <div class="rp-head top">
    <div><div class="crumb">AI 爬虫可访问性报告</div><h1 id="dom"><!--DOM-->…<!--/DOM--></h1><div class="meta" id="meta"><!--META--><!--/META--></div></div>
    <form class="rp-search" id="f" autocomplete="off"><div class="field" style="flex:1"><input id="d" placeholder="检测其他域名" aria-label="域名" spellcheck="false" autocapitalize="off"><button class="btn">检测</button></div></form>
  </div>
  <div id="out"><!--OUT--><div class="loading" id="ld"><img class="vava" src="/en/brand/vava/vava3d-searching-mini.webp" width="96" height="121" alt="">正在以 18 种不同身份请求首页…</div><!--/OUT--></div>
</main>
${logoSwap(FOOT('/'))}
<script type="module">
import {renderReport,bindReport,cleanDomain,esc} from '/en/view.js';
const $=s=>document.querySelector(s);
$('#f').addEventListener('submit',e=>{e.preventDefault();const c=cleanDomain($('#d').value);if(c)location.href='/report/'+c});
const out=$('#out');
function show(j){const o=renderReport(j,{lang:'zh',base:'',url:location.origin+'/report/'+j.domain});$('#meta').innerHTML=o.meta;out.innerHTML=o.html;document.title=j.domain+'：'+o.title+' · VAKSEL';bindReport(document,'zh')}
function fail(m){out.innerHTML='<div class="loading">'+esc(m)+'</div>'}
const m=location.pathname.match(/^\\/report\\/([^/]+)\\/?$/);
const qd=new URLSearchParams(location.search).get('d');
const dom=cleanDomain(m?decodeURIComponent(m[1]):qd);
if(qd&&dom&&!m)location.replace('/report/'+dom);
else if(!dom){$('#dom').textContent='输入一个域名';out.innerHTML='<div class="loading"><img class="vava" src="/en/brand/vava/vava3d-sleeping-still.webp" width="112" height="112" alt="">在上面输入域名开始检测。</div>';$('#d').focus()}
else if(out.querySelector('.verdict')||out.querySelector('.loading:not(#ld)'))bindReport(document,'zh');
else{
  $('#dom').textContent=dom;
  fetch('/api/check?access=1&domain='+encodeURIComponent(dom)).then(r=>r.json().then(j=>[r.status,j])).then(([s,j])=>{
    if(s===429)return fail('你所在网络的检测次数太多，请一分钟后再试。');
    if(j.error)return fail(j.error==='bad_domain'?'这看起来不是有效的域名。':'出了点问题，请重试。');
    show(j)
  }).catch(()=>fail('检测超时，对方网站可能很慢或无法访问。'));
}
</script>
</body></html>
`);

/* ---------- 爬虫百科 ---------- */
const DATA = JSON.parse(readFileSync(join(root, 'data/ai-crawlers.json'), 'utf8'));
const CAT = { search: '搜索', user: '用户触发', training: '训练', training_control: '训练控制标记', dataset: '数据集', other: '其他' };
const CAT_DESC = {
  search: '为了让网页能在搜索或 AI 回答里被找到、被引用而建立索引。',
  user: '用户让 AI 助手去看某个网页时，实时抓取一次。',
  training: '收集可能用于训练 AI 模型的内容。',
  training_control: '写在 robots.txt 里的标记，用来控制别的爬虫抓到的内容能否用于 AI。它本身不抓取网页。',
  dataset: '建设公开数据集，供第三方使用，其中包括 AI 训练。',
  other: '为特定产品抓取，例如广告落地页审核、为你自己的网站搭建智能体。不属于搜索，也不用于训练。'
};
const ROBOTS = { yes: '遵守', partial: '不一定', no: '一般不遵守', unverified: '官方未说明' };
const CLASSIC = new Set(['Googlebot', 'Bingbot', 'Applebot', 'Baiduspider', 'YandexBot', 'Yeti']);
const crawlers = DATA.crawlers;
const first = (s) => String(s).split('；')[0].split('。')[0] + '。';
const botCard = (c) => `<a class="bcard" href="/bots/${slug(c.token)}/"><div class="bt">${esc(c.token)}</div><div class="bv">${esc(c.vendor)}${CLASSIC.has(c.token) ? ' · 搜索引擎' : ''}</div><p>${esc(first(c.summary_zh))}</p></a>`;
let groups = '';
for (const [cat, label] of [['search', 'AI 搜索与助手'], ['user', '用户触发的抓取'], ['training', '训练爬虫'], ['training_control', '训练控制标记'], ['dataset', '公开数据集'], ['other', '其他 AI 相关爬虫']]) {
  const list = crawlers.filter((c) => c.category === cat);
  if (list.length) groups += `<section class="sec tight"><h2>${label}</h2><p class="sub">${CAT_DESC[cat]}</p><div class="bgrid">${list.map(botCard).join('')}</div></section>`;
}
write('bots/index.html', page({
  path: '/bots/', active: 'bots', title: 'AI 爬虫百科：UA、用途、屏蔽后果 · VAKSEL',
  desc: `${crawlers.length} 个 AI 与搜索爬虫，从 GPTBot、OAI-SearchBot 到 PerplexityBot、Claude-SearchBot、Bytespider：各自做什么、是否遵守 robots.txt、屏蔽后会怎样。`,
  body: `<main class="wrap doc-head">${crumbs([['/', '首页'], [null, 'AI 爬虫']])}
<h1>AI 爬虫百科</h1>
<p class="lead l">搜索、训练、用户触发是三类不同的爬虫。拦错了，可能训练没拦住，自己却从 AI 回答里消失了。每一条都附运营方官方文档。</p>
${groups}
<section class="sec tight">${checkBox('这些爬虫里，哪些能访问你的网站？', '我们检查 robots.txt，并以上面这些 AI 搜索爬虫的身份实际发出请求。')}</section>
<p class="note">最近有哪些变化，见 <a href="/bots/changelog/">AI 爬虫变更日志</a>。来源：各运营方官方爬虫文档，核对于 ${DATA.crawlers[0].verified_on}。标注“部分核实”的条目，官方文档没有写明全部细节。</p>
</main>${CHECK_JS}`
}));
for (const c of crawlers) {
  const same = crawlers.filter((x) => x.vendor === c.vendor && x.token !== c.token);
  const ctrl = c.category === 'training_control';
  write(`bots/${slug(c.token)}/index.html`, page({
    path: `/bots/${slug(c.token)}/`, active: 'bots',
    ld: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: `${c.token} 是什么，要不要屏蔽`, dateModified: UPDATED, inLanguage: 'zh-CN', citation: c.docs_url },
    title: `${c.token} 是什么？要不要屏蔽 · VAKSEL`,
    desc: c.agent_kind === 'browser' ? `${c.token} 是 ${c.vendor} 的托管浏览器，不是爬虫。${c.block_consequence_zh}`.slice(0, 200) : `${c.token} 是 ${c.vendor} 的${c.category === 'other' ? '' : CAT[c.category] || ''}${ctrl ? '标记' : '爬虫'}。${c.block_consequence_zh}`.slice(0, 200),
    body: `<main class="wrap doc">${crumbs([['/', '首页'], ['/bots/', 'AI 爬虫'], [null, c.token]])}
<h1>${esc(c.token)}</h1>
<div class="facts"><div><span>运营方</span><b>${esc(c.vendor)}</b></div><div><span>用途</span><b>${CAT[c.category] || '其他'}</b></div><div><span>遵守 robots.txt</span><b>${ROBOTS[c.respects_robots] || '–'}</b></div><div><span>来源</span><b><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">官方文档 ↗</a></b></div></div>
<p class="lead l">${esc(c.summary_zh)}</p>
<h2>屏蔽后会怎样</h2><p>${esc(c.block_consequence_zh)}</p>
${c.agent_kind === 'browser' ? `<h2>怎么拦截或放行</h2><p>它不是爬虫：请求来自真实浏览器，UA 是浏览器本身的，只多了一个 <code>${esc(c.token)}</code> 标识。在 CDN 或防火墙里按这个标识匹配，不要匹配整串 UA。Cloudflare 可新建自定义规则，表达式如下、动作选“阻止”；Nginx 用第二段返回 403。</p><pre>${esc(`(http.user_agent contains "${c.token}")`)}</pre><pre>${esc(`if ($http_user_agent ~* "${c.token}") { return 403; }`)}</pre><p>UA 谁都能伪造。信任或放行前，先核对请求是否来自 <a href="${esc(c.ip_url)}" rel="nofollow noopener" target="_blank">${esc(c.ip_url.replace('https://', ''))}</a> 公布的 IP 段；IP 段会变，规则应从这个文件自动更新，不要写死。</p>` : `<h2>robots.txt 写法</h2>
${ctrl ? `<p>为它单独写一组规则。它不改变爬虫抓什么，只决定内容能否被这样使用：</p><pre>User-agent: ${esc(c.token)}\nDisallow: /</pre>` : `<p>屏蔽：</p><pre>User-agent: ${esc(c.token)}\nDisallow: /</pre><p>显式放行（当有更宽的规则拦了其他机器人时有用）：</p><pre>User-agent: ${esc(c.token)}\nAllow: /</pre>`}`}
<h2>官方原文</h2><blockquote>${esc(c.quote)}<cite><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">${esc(c.vendor)} 文档</a>，核对于 ${esc(c.verified_on)}</cite></blockquote>
${c.category === 'search' || c.category === 'user' ? `<h2>robots.txt 允许了，它就真能进来吗？</h2><p>即使 robots.txt 欢迎 ${esc(c.token)}，防火墙或 CDN 规则也可能拒绝它，而后台不会有任何提示。我们的检测会以 ${esc(c.token)} 的身份实际请求，同时用浏览器和 Googlebot 做对照，避免把爬虫 IP 核验误判成拦截。</p>` : ''}
${same.length ? `<h2>${esc(c.vendor)} 的其他爬虫</h2><div class="bgrid s">${same.map(botCard).join('')}</div>` : ''}
<div style="margin-top:28px">${checkBox(c.agent_kind === 'browser' ? 'AI 爬虫能访问你的网站吗？' : `${c.token} 能访问你的网站吗？`)}</div>
</main>${CHECK_JS}`
  }));
}

/* ---------- 修复指南 ---------- */
write('guides/index.html', page({
  path: '/guides/', active: 'guides', title: '修复指南：在 Cloudflare、EdgeOne、阿里云、宝塔等平台放行 AI 搜索爬虫 · VAKSEL',
  desc: '最常拦住 AI 搜索爬虫的几个平台，分步修复，同时保留拒绝 AI 训练的设置。',
  body: `<main class="wrap doc-head">${crumbs([['/', '首页'], [null, '修复指南']])}
<h1>修复指南</h1>
<p class="lead l">既出现在 ChatGPT、Perplexity、Claude 的搜索里，又不让内容被拿去训练。按报告指出的那一层来修。</p>
<div class="bgrid g2">${GUIDES_ZH.map((g) => `<a class="bcard g" href="/guides/${g.slug}/"><div class="bt">${esc(g.name)}</div><p>${esc(g.desc)}</p></a>`).join('')}</div>
<section class="sec tight">${checkBox('不确定拦截出在哪一层？', '报告会写明是哪家 CDN 应答的，并链接对应的指南。')}</section>
<p class="note">也可以看 <a href="/guide/what-is-llms-txt/">llms.txt 入门</a>。</p>
</main>${CHECK_JS}`
}));
for (const g of GUIDES_ZH) {
  write(`guides/${g.slug}/index.html`, page({
    path: `/guides/${g.slug}/`, active: 'guides', ld: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: g.title, dateModified: UPDATED, inLanguage: 'zh-CN' },
    title: g.title + ' · VAKSEL', desc: g.desc,
    body: `<main class="wrap doc">${crumbs([['/', '首页'], ['/guides/', '修复指南'], [null, g.name]])}
<h1>${esc(g.title)}</h1><p class="upd">更新于 ${UPDATED}</p>
${g.body}
<h2>参考来源</h2><ul class="src">${g.sources.map(([u, t]) => `<li><a href="${u}" rel="nofollow noopener" target="_blank">${esc(t)} ↗</a></li>`).join('')}</ul>
<div style="margin-top:28px">${checkBox('修完再测一次')}</div>
<p class="more">其他指南：${GUIDES_ZH.filter((x) => x !== g).map((x) => `<a href="/guides/${x.slug}/">${esc(x.name)}</a>`).join(' · ')}</p>
</main>${CHECK_JS}`
  }));
}

/* ---------- 研究方法 ---------- */
write('research/index.html', page({
  path: '/research/', title: RESEARCH_ZH.title, desc: RESEARCH_ZH.desc,
  body: `<main class="wrap doc">${crumbs([['/', '首页'], [null, '研究方法']])}<h1>${esc(RESEARCH_ZH.h1)}</h1><p class="upd">${esc(RESEARCH_ZH.upd)}</p>${RESEARCH_ZH.body}
<p class="more">报告的三层评级怎么算：<a href="/research/grading/">评分方法 →</a></p>
<p class="more">用来检验任何 AI 可达性工具的公开测试站：<a href="/research/lab/">对照测试集 →</a></p>
<div style="margin-top:28px">${checkBox('检测你自己的网站')}</div></main>${CHECK_JS}`
}));

/* ---------- 评分方法 ---------- */
write('research/grading/index.html', page({
  path: '/research/grading/', title: '评分方法：能不能进、能不能读、能不能被引用 · VAKSEL',
  desc: 'VAKSEL 体检报告的三层 S/A/B/C 评级规则：每条依据、封顶规则、哪些不计分，以及为什么不打总分。规则带版本号。',
  body: `<main class="wrap doc">${crumbs([['/', '首页'], ['/research/', '研究方法'], [null, '评分方法']])}
<h1>评分方法</h1><p class="upd">规则版本 ${GRADE_VERSION}</p>
<p class="lead l">报告分三层评级：能不能进、能不能读、能不能被引用。每层 S、A、B、C 四档，不打总分。</p>
<h2>为什么不打总分</h2>
<p>一个数字会把最要紧的问题藏起来。一个把 AI 爬虫全挡在门外的网站，结构化数据做得再好，加权平均后也能拿到不错的分数。所以三层分开评，第一层不过关，后面再好也帮不上忙。</p>
<h2>只计能验证的事实</h2>
<ul><li>每条检查都标了依据：<b>官方文档</b>（搜索引擎或标准文件写明）、<b>业界常用</b>（普遍做法，有公开实测）、<b>推测</b>（没有官方说法）。</li>
<li>只有“官方文档”和“业界常用”计分。“推测”和“提示”只展示，不影响评级。</li>
<li>llms.txt 不计分。Google 写明出现在 AI 功能里不需要专门的 AI 文件或标记。</li>
<li>训练爬虫（如 GPTBot、ClaudeBot、Google-Extended、CCBot）被拦不扣分。挡训练、放搜索是站长的正当选择。</li></ul>
<h2>能不能进</h2>
<table class="tbl tg"><thead><tr><th>等级</th><th>条件</th></tr></thead><tbody>
<tr><td><b>S</b></td><td>实测所有 AI 搜索爬虫都能进，拿到的页面和浏览器一样</td></tr>
<tr><td><b>A</b></td><td>都能进，但有爬虫遇到验证页或拿到的内容明显变少；或防火墙实测没完成，只能看 robots.txt（最高 A）</td></tr>
<tr><td><b>B</b></td><td>部分 AI 搜索爬虫被 robots.txt 或防火墙拦</td></tr>
<tr><td><b>C</b></td><td>全部被拦；或有高、中可信度的静默拦截（robots.txt 允许，防火墙却拦）；或首页 noindex</td></tr>
</tbody></table>
<p>robots.txt 返回 5xx 或打不开时，按 <a href="https://www.rfc-editor.org/rfc/rfc9309#section-2.3.1.4">RFC 9309 §2.3.1.4</a>，遵守规范的爬虫会当作全站禁止，所以归到 C。robots.txt 返回 404 等 4xx 时等于没有限制，不扣分。</p>
<p>防火墙实测带两个对照组：伪装成 Googlebot 的请求和一个未知爬虫。伪装 Googlebot 也被拦，说明网站在核验爬虫 IP，真正的 AI 爬虫多半能过，这种情况只记低可信度，不判 C。我们的请求不是从各家官方 IP 发出的，结论是“很可能”，不是证明。</p>
<p><b>中文搜索与 AI 引擎</b>（百度、字节、华为、搜狗、360、神马、Kimi）用同样方法实测，但单独显示一行“x/y 能进”，不影响评级。很多海外网站是有意拦它们的，不该算作问题。豆包和腾讯元宝没有公开自己的爬虫，所以我们不单列。</p>
<h2>能不能读</h2>
<table class="tbl tg"><thead><tr><th>等级</th><th>条件</th></tr></thead><tbody>
<tr><td><b>S</b></td><td>官方和常用检查没有待改项</td></tr>
<tr><td><b>A</b></td><td>1 项待改</td></tr>
<tr><td><b>B</b></td><td>2–3 项待改，或有非关键问题（如多个 canonical）</td></tr>
<tr><td><b>C</b></td><td>不能收录或不能显示摘要（noindex、nosnippet、max-snippet:0）；不执行 JavaScript 读不到正文；或 4 项以上待改</td></tr>
</tbody></table>
<p>检查项：页面标题、页面描述、允许收录和摘要、规范网址、不跑 JS 的正文、一级标题、站点地图、站内链接、图片 alt、多语言 hreflang、移动端适配。Google 在 <a href="https://developers.google.com/search/docs/appearance/ai-features">AI features and your website</a> 中写明，AI 概览只引用能被收录、能显示摘要的页面。</p>
<h2>能不能被引用</h2>
<table class="tbl tg"><thead><tr><th>等级</th><th>条件</th></tr></thead><tbody>
<tr><td><b>S</b></td><td>5 个信号全有：结构化数据、机构信息、网站名称、分享卡片、语义标签</td></tr>
<tr><td><b>A</b></td><td>4 个</td></tr>
<tr><td><b>B</b></td><td>2–3 个</td></tr>
<tr><td><b>C</b></td><td>0–1 个</td></tr>
</tbody></table>
<p>封顶：JSON-LD 解析失败，最高 B；FAQPage 标记的问题在页面上找不到，最高 B。Google 的<a href="https://developers.google.com/search/docs/appearance/structured-data/sd-policies">结构化数据通用规则</a>要求标记的内容对用户可见。</p>
<p>这一层衡量的是“让引擎认出你”的信号，不保证一定被引用。有没有被 AI 回答提到，要靠实际查询，不在免费体检范围内。</p>
<h2>规则更新记录</h2>
<ul><li><b>2026-11-02.2</b>：中文搜索与 AI 引擎（Baiduspider、Bytespider、PetalBot、搜狗、360Spider、YisouSpider、Kimi）单独实测、单独列出，不再计入“能不能进”。此前 Bytespider、PetalBot 计入。Kimi-SearchBot、Kimi-User、搜狗、360Spider、YisouSpider 加入实测。</li><li><b>2026-11-02.1</b>：首个公开版本。新增 robots.txt 5xx 视为全禁、FAQ 标记与页面不符封顶 B。</li></ul>
<p>规则改动会加版本号，报告里会写明用的是哪一版，所以不同时间的评级可以对比。</p>
<div style="margin-top:28px">${checkBox('检测你自己的网站')}</div></main>${CHECK_JS}`
}));

/* ---------- 隐私 / 条款 / 联系 ---------- */
for (const [p, d] of [['/privacy/', PRIVACY_ZH], ['/terms/', TERMS_ZH]]) {
  write(p.slice(1) + 'index.html', page({ path: p, title: d.title, desc: d.desc, body: `<main class="wrap doc">${crumbs([['/', '首页'], [null, d.h1]])}<h1>${esc(d.h1)}</h1><p class="upd">最后更新：${UPDATED}</p>${d.body}</main>` }));
}
const C = CONTACT_ZH;
write('contact/index.html', page({
  path: '/contact/', title: C.title, desc: C.desc,
  body: `<main class="wrap doc">${crumbs([['/', '首页'], [null, C.h1]])}<h1>${esc(C.h1)}</h1><p class="lead l">${esc(C.lead)}</p>
<form id="ct" class="ct">
  <label>${C.labels.email}<input type="email" name="email" required autocomplete="email"></label>
  <label>${C.labels.topic}<select name="topic">${Object.entries(C.topics).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  <label>${C.labels.message}<textarea name="message" required rows="6" maxlength="2000"></textarea></label>
  <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
  <button class="btn">${C.labels.send}</button>
</form><p class="wlmsg" id="ctmsg" role="status"></p></main>
<script>
const M=${JSON.stringify(C.msgs)};const ct=document.getElementById('ct'),cm=document.getElementById('ctmsg');
ct.addEventListener('submit',async e=>{e.preventDefault();const b=ct.querySelector('button');b.disabled=true;cm.textContent='';
  try{const r=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(ct)))});const j=await r.json();
    if(r.ok&&j.ok){ct.hidden=true;cm.className='wlmsg ok';cm.textContent=M.ok}else{cm.className='wlmsg bad';cm.textContent=M[j.error]||M.error;b.disabled=false}
  }catch{cm.className='wlmsg bad';cm.textContent=M.network;b.disabled=false}});
</script>`
}));

/* ---------- 监控（早期体验，不写价格） ---------- */
const PLANS = [
  { name: '免费', price: '免费', tag: '现在可用', items: ['不限次数的单次检测', 'robots.txt、防火墙、页面检查', '可分享的报告链接', '对应 CDN 的修复指南'], cta: '<a class="btn ghost" href="/">去检测</a>' },
  { name: '专业版', price: '价格待公布', tag: '早期体验', hi: true, items: ['最多 10 个网站', '每天自动复测', 'AI 爬虫被拦时邮件提醒', '复测确认后才提醒，不误报', '早期用户锁定首发价'], cta: '<a class="btn" href="#join" data-plan="pro">加入早期体验</a>' },
  { name: '代理商版', price: '面议', tag: '早期体验', items: ['多个客户网站', '包含专业版全部功能', '客户报告按你的需要一起做', '价格单独商定'], cta: '<a class="btn ghost" href="/contact/">联系我们</a>' }
];
write('pricing/index.html', page({
  path: '/pricing/', active: 'pricing', title: '监控：AI 爬虫一被拦就通知你（早期体验）· VAKSEL',
  desc: '检测永久免费。监控每天复测，robots.txt、插件或 CDN 默认规则一旦挡住 AI 爬虫就发邮件提醒。现在加入早期体验，价格公布前不收费。',
  body: `<main class="wrap">
<header class="hero s"><h1>AI 搜索哪天<span class="grad">进不来了</span>，第一时间知道</h1>
<p class="lead">检测永久免费。监控每天复测，robots.txt 改动、插件更新或 CDN 默认规则一旦挡住 AI 爬虫，就发邮件告诉你。</p></header>
<div class="plans">${PLANS.map((p) => `<div class="plan${p.hi ? ' hi' : ''}"><div class="ptag">${p.tag}</div><h2 class="pn">${p.name}</h2><div class="pp${p.price.length > 3 ? ' tbd' : ''}">${p.price}</div><ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>${p.cta}</div>`).join('')}</div>
<section class="sec"><div class="alert-wrap"><div class="atext"><h2>提醒邮件长这样</h2><p class="sub">有变化才发一封，附上证据和修法；没变化不打扰。</p></div>
<div class="mail" aria-label="提醒邮件示例"><div class="mh"><img src="/en/brand/vaksel-favicon.svg" width="28" height="28" alt=""><div><b>VAKSEL 提醒</b><span>发给 you@company.com</span></div><time>今天 07:02</time></div>
<div class="ms">example.com 的 OAI-SearchBot 现在被拦了</div>
<div class="mb"><p>昨天 OAI-SearchBot 拿到的页面和浏览器一样。今天早上它从 Cloudflare 收到 <code>403</code>，而浏览器和 Googlebot 仍是 <code>200</code>。</p>
<div class="mrow"><span>OAI-SearchBot</span><span class="tag t-ok">可访问</span><span class="arr">→</span><span class="tag t-bad">静默拦截</span></div>
<div class="mrow"><span>PerplexityBot</span><span class="tag t-ok">可访问</span><span class="arr">→</span><span class="tag t-bad">静默拦截</span></div>
<p><b>可能原因：</b>Cloudflare 的 Search 选项被设成了 <i>Block</i>，或者有条 WAF 规则命中了这些爬虫。</p><span class="mbtn">查看报告和修法</span></div></div></div></section>
<section class="sec" id="join"><div class="join card">
  <img class="vava" src="/en/brand/vava/vava3d-working-mini.webp" width="96" height="100" alt="" loading="lazy">
  <div class="jtext"><h2>加入早期体验</h2><p class="sub">价格公布并经你确认之前不会收费。早期用户锁定首发价。</p>
  <form id="wl" class="wl" autocomplete="on">
    <input type="email" name="email" required placeholder="you@company.com" aria-label="邮箱" autocomplete="email">
    <select name="plan" aria-label="方案"><option value="pro">专业版 · 最多 10 个网站</option><option value="agency">代理商版 · 客户网站</option></select>
    <input name="site" placeholder="主要网站（选填）" aria-label="主要网站（选填）" autocapitalize="off" spellcheck="false">
    <label class="wlplug"><input type="checkbox" name="watch" value="1"> 现在就开始监控这个网站，早期体验期间免费（会先发一封确认邮件）</label>
    <label class="wlplug"><input type="checkbox" name="plugin" value="1"> 我愿意装一个插件或 Worker 片段，查看真实 AI 爬虫的访问记录</label>
    <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <input type="hidden" name="lang" value="zh">
    <button class="btn">加入</button>
  </form><p class="wlmsg" id="wlmsg" role="status"></p></div>
</div></section>
<section class="sec tight"><h2>常见问题</h2><div class="faq">${PRICING_FAQ_ZH.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
</main>
<script>
{const q=new URLSearchParams(location.search),st=q.get('site'),pl=q.get('plan');if(st){document.querySelector('#wl [name=site]').value=st;document.querySelector('#wl [name=watch]').checked=true}if(pl==='agency'||pl==='pro')document.querySelector('#wl [name=plan]').value=pl}
document.querySelectorAll('[data-plan]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#wl [name=plan]').value=a.dataset.plan}));
const wl=document.getElementById('wl'),msg=document.getElementById('wlmsg');
wl.addEventListener('submit',async e=>{e.preventDefault();const b=wl.querySelector('button');b.disabled=true;msg.textContent='';
  const fd=Object.fromEntries(new FormData(wl));
  try{const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fd)});const j=await r.json();
    if(r.ok&&j.ok){wl.hidden=true;msg.className='wlmsg ok';msg.textContent=j.watch&&j.watch.ok?(j.watch.already?'已加入，'+fd.site+' 已经在监控中。':'已加入。点开刚发到 '+fd.email+' 的确认邮件，就开始监控 '+fd.site+'。'):j.watch&&j.watch.error==='limit'?'已加入。早期体验每个邮箱最多监控 3 个网站，这个没有加上。':'已加入。账号准备好后，我们会发邮件到 '+fd.email+'。'}
    else{msg.className='wlmsg bad';msg.textContent=j.error==='bad_email'?'邮箱格式似乎不正确。':j.error==='rate_limited'?'尝试次数过多，请稍等一分钟。':'出了点问题，请重试。';b.disabled=false}
  }catch{msg.className='wlmsg bad';msg.textContent='网络错误，请重试。';b.disabled=false}
});
</script>`
}));

/* ---------- 首页 ---------- */
const FIXT = JSON.parse(readFileSync(join(root, 'data/demo-toyota.json'), 'utf8'));
const demo = renderReport(FIXT, { lang: 'zh', base: '', when: '2026-11-02T18:38:00Z', url: SITE + '/report/toyota.com' });
const ZH_HOME = zhHome({ root, GUIDES_ZH, HOME_FAQ_ZH, EXAMPLES_ZH, DEMO_DATE_ZH: FIXT.checked_on });
write('index.html', page({
  path: '/', type: 'website', title: 'AI 搜索能访问你的网站吗？免费 AI 爬虫可访问性检测 · VAKSEL',
  desc: '检测 ChatGPT、Perplexity、Claude 的搜索爬虫能否真正访问你的网站：robots.txt、防火墙和 CDN 拦截、noindex、只靠 JavaScript 渲染的页面。免费，无需注册。',
  ld: { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': 'https://vaksel.com/#org', name: 'VAKSEL', url: 'https://vaksel.com/', logo: 'https://vaksel.com/brand/icon-512.png' },
    { '@type': 'WebSite', name: 'VAKSEL 中文版', alternateName: 'cetxt', url: SITE + '/', inLanguage: 'zh-CN', publisher: { '@id': 'https://vaksel.com/#org' } },
    { '@type': 'WebApplication', name: 'VAKSEL', alternateName: 'VAKSEL 中文版', url: SITE + '/', inLanguage: 'zh-CN', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web', publisher: { '@id': 'https://vaksel.com/#org' }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' } }
  ] },
  body: ZH_HOME.body, theme: 'dk'
}));

/* ---------- 404 ---------- */
write('404.html', page({
  path: '/404', title: '页面不存在 · VAKSEL', desc: '这个页面不存在。', en: '',
  body: `<main class="wrap nf"><img src="/en/brand/vava/vava3d-searching-mini.webp" width="160" height="202" alt="正在找东西的狐狸 Vava">
<h1>找遍了也没找到</h1><p class="lead">这个页面不存在，或者已经搬走了。试试检测，或者看看下面这些。</p>
<form class="field" data-check autocomplete="off"><input placeholder="你的域名，例如 example.com" aria-label="域名" spellcheck="false" autocapitalize="off"><button class="btn">开始检测</button></form>
<p class="hint"><a href="/guides/">修复指南</a> · <a href="/bots/">AI 爬虫百科</a><a href="/bots/changelog/">爬虫变更日志</a> · <a href="/tools/">llms.txt 工具</a> · <a href="/survey/">普查报告</a></p></main>${CHECK_JS}`
}));


/* ---------- AI 爬虫变更日志（2026-11-04，与英文 /en/bots/changelog/ 同源数据） ---------- */
{
  const CL = JSON.parse(readFileSync(join(root, 'data/crawler-changelog.json'), 'utf8')).entries;
  const W = JSON.parse(readFileSync(join(root, 'data/doc-watch.json'), 'utf8'));
  const known = new Set(crawlers.map((c) => c.token));
  const fmt = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y} 年 ${m} 月 ${dd} 日`; };
  const tok = (t) => (known.has(t) ? `<a href="/bots/${slug(t)}/"><code>${esc(t)}</code></a>` : `<code>${esc(t)}</code>`);
  const items = CL.map((e) => `<li class="cl-i"><time datetime="${e.date}">${e.date}</time><div><span class="cl-k ${e.kind}">${e.kind === 'vendor' ? '官方文档变更' : '目录更新'}</span><p>${esc(e.zh)}</p>${e.quote ? `<blockquote class="cl-q">“${esc(e.quote)}”</blockquote>` : ''}${e.tokens.length ? `<p class="cl-t">${e.tokens.map(tok).join(' ')}</p>` : ''}${e.source ? `<p class="cl-s"><a href="${esc(e.source)}" rel="nofollow noopener" target="_blank">来源 ↗</a></p>` : ''}</div></li>`).join('');
  const docs = Object.entries(W.docs).map(([u, v]) => {
    const host = new URL(u).hostname.replace(/^www\./, '');
    const st = v.js_only ? '人工核对' : v.hash ? '自动比对' : '上次无法访问';
    return `<tr><td>${v.tokens.map(tok).join(' ')}</td><td><a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(host)} ↗</a></td><td>${st}</td></tr>`;
  }).join('');
  write('bots/changelog/index.html', page({
    path: '/bots/changelog/', active: 'bots', en: '/en/bots/changelog/',
    title: 'AI 爬虫变更日志：新 UA 与规则变化 · VAKSEL',
    desc: 'GPTBot、OAI-SearchBot、ClaudeBot、PerplexityBot、Bytespider 等 AI 爬虫官方文档的变化：新增的 UA、改名的爬虫、robots.txt 规则变化，每条附来源。',
    body: `<main class="wrap doc">${crumbs([['/', '首页'], ['/bots/', 'AI 爬虫'], [null, '变更日志']])}
<h1>AI 爬虫变更日志</h1><p class="upd">文档指纹最后记录于 ${fmt(W.checked_at.slice(0, 10))}</p>
<p class="lead l">AI 公司新增爬虫、给爬虫改名、改变 robots.txt 能管的范围时，你的规则不用动也可能失效。我们给每家运营方的爬虫文档做指纹，和线上页面比对，读过原文后才在这里记一条。</p>
<ol class="cl">${items}</ol>
<h2>我们比对的页面</h2>
<p>${Object.keys(W.docs).length} 个官方页面，覆盖 ${crawlers.length} 个爬虫。页面有变化，读过之后才会记入日志；与爬虫无关的排版和措辞改动不记。</p>
<div class="tscroll" style="overflow-x:auto"><table class="tbl clw"><thead><tr><th>爬虫</th><th>官方页面</th><th>方式</th></tr></thead><tbody>${docs}</tbody></table></div>
<section class="sec tight">${checkBox('你的规则还跟得上吗？', '我们用最新的爬虫清单检查你的 robots.txt 和防火墙。')}</section>
</main>${CHECK_JS}`
  }));
}

/* ---------- sitemap ---------- */

/* ---------- 对照测试集 ---------- */
{
  const byLab = Object.fromEntries(LAB.results.map((r) => [r.slug, r]));
  const g3 = (a) => a.map((x) => x || '–').join('/');
  const rows = FIXTURES.map((f) => { const r = byLab[f.slug] || {}; const d = f.slug + LAB_SUFFIX;
    return `<tr><td><a href="https://${d}/" rel="nofollow">${d}</a></td><td>${esc(f.zh)}</td><td style="white-space:nowrap">${g3(f.expect)}${f.cn === 'all_blocked' ? '<br>中文引擎：全拦' : ''}</td><td style="white-space:nowrap">${r.got ? g3(r.got) + (r.ok ? ' ✓' : ' ✗') : '–'}</td><td><a href="/report/${d}">报告</a></td></tr>`; }).join('');
  const nOk = LAB.results.filter((r) => r.ok).length;
  write('research/lab/index.html', page({
    path: '/research/lab/', title: 'VAKSEL 对照测试集：给 AI 可达性工具用的公开测试站 · VAKSEL',
    desc: '20 个公开测试站，每个只改一处（防火墙 403、robots.txt 503、假 llms.txt、FAQ 标记与页面不符等），可以用来检验任何 AI 可达性工具，包括我们自己的。',
    body: `<main class="wrap doc">${crumbs([['/', '首页'], ['/research/', '研究方法'], [null, '对照测试集']])}
<h1>对照测试集</h1><p class="upd">最近一次运行 ${new Date(LAB.run_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })} · 规则版本 ${LAB.rules}</p>
<p class="lead l">${FIXTURES.length} 个公开测试站，每个和对照组相比只改一处，用来看 AI 可达性工具能不能发现问题。任何工具都可以拿来测，包括我们自己的。</p>
<h2>怎么用</h2>
<ul><li>先测 <b>baseline${LAB_SUFFIX}</b>，正确的工具应该报告没有问题。</li>
<li>再测其他站。每行写了改了什么、正确的工具应该给出什么结果。</li>
<li>防火墙类测试站按 User-Agent 判断，和多数真实防火墙一样，对任何 IP 都给同样的响应。</li></ul>
<h2>测试站</h2>
<p>等级依次为能不能进 / 能不能读 / 能不能被引用，规则见<a href="/research/grading/">评分方法</a>。</p>
<div class="tscroll" style="overflow-x:auto"><table class="tbl tg"><thead><tr><th>测试站</th><th>改了什么</th><th>应得</th><th>VAKSEL</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
<p>最近一次运行，VAKSEL 结果与预期一致 ${nOk}/${LAB.results.length}。</p>
<h2>它在我们自己的引擎里找到了什么</h2>
<p>第一次运行（当时 19 个站）只对了 3 个。测试集找出四个问题，现已修复：</p>
<ul><li>爬虫名单里漏了华为 PetalBot，导致 robots.txt 全站禁止的站被评成 B 而不是 C。robots.txt 返回 503 的情况也被同一个问题掩盖。</li>
<li>经备用服务器抓取时，响应头里的 X-Robots-Tag: noindex 没有读到。</li>
<li>站点拒绝我们直接请求时，站点地图检查没有走备用服务器，被误报为缺失。</li>
<li>页面里只是提到“Just a moment”，就被误判成验证页。我们改了测试站；真实的验证页判断仍结合页面大小。</li></ul>
<h2>局限</h2>
<p>测试站模拟的是常见配置，不能复现真实厂商的 IP 核验、需要浏览器执行的 JavaScript 验证或限频。“应得”等级按我们公开的规则给出，其他工具用不同的说法也可能是对的。</p>
</main>`
  }));
}

const urls = ['/', '/research/', '/research/grading/', '/research/lab/', '/pricing/', '/guides/', ...GUIDES_ZH.map((g) => `/guides/${g.slug}/`), '/bots/', '/bots/changelog/', ...crawlers.map((c) => `/bots/${slug(c.token)}/`), '/tools/', '/survey/', '/faq/', '/guide/what-is-llms-txt/', '/guide/how-to-write-llms-txt/', '/llms.txt', '/privacy/', '/terms/', '/contact/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log('zh pages:', out.length);

/* ---------- 旧文字页迁入新模板（11-02）：源文件在 legacy/，正文原样保留，旧样式转浅色并限定在 .lg 内 ---------- */
export function darkCss(css) {
  // 旧版深色调色板（暖白 + 荧光黄）→ 现站深色（#0a0a0a 底、#f5f5f7 字、绿色强调）
  return css
    .replace(/rgba\(244,\s*241,\s*233,\s*([\d.]+)\)/g, (m, x) => `rgba(255,255,255,${x})`)
    .replace(/rgba\(210,\s*255,\s*0,\s*([\d.]+)\)/g, (m, x) => `rgba(62,224,122,${x})`)
    .replace(/#0c0c0e\b/gi, '#0a0a0a').replace(/#121214\b/gi, '#151515').replace(/#17171a\b/gi, '#1c1c1e').replace(/#08080a\b/gi, '#0a0a0a')
    .replace(/#f4f1e9\b/gi, '#f5f5f7').replace(/#d8d5cc\b/gi, '#c7c7cc').replace(/#97958d\b/gi, '#a1a1a6').replace(/#85837c\b/gi, '#86868b')
    .replace(/#d2ff00\b/gi, '#3ee07a')
    .replace(/"Noto Serif SC",\s*"Songti SC",\s*serif|"Noto Serif SC",\s*serif/g, '"Inter",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif')
    .replace(/"Noto Sans SC",\s*sans-serif/g, '"Inter",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif')
    .replace(/font-weight:\s*900/g, 'font-weight:700');
}
export function lightCss(css) {
  const a = (r, g, b) => (m, x) => `rgba(${r},${g},${b},${x})`;
  return css
    .replace(/rgba\(244,\s*241,\s*233,\s*([\d.]+)\)/g, (m, x) => `rgba(0,0,0,${Math.min(1, +x * 0.7).toFixed(3)})`)
    .replace(/rgba\(210,\s*255,\s*0,\s*([\d.]+)\)/g, a(22, 163, 74))
    .replace(/rgba\(255,\s*107,\s*107,\s*([\d.]+)\)/g, a(215, 0, 21))
    .replace(/rgba\(255,\s*176,\s*32,\s*([\d.]+)\)/g, a(178, 106, 0))
    .replace(/rgba\(12,\s*12,\s*14,\s*\.72\)/g, 'rgba(255,255,255,.82)').replace(/rgba\(8,\s*8,\s*10,\s*\.7\)/g, 'rgba(255,255,255,.78)')
    .replace(/rgba\(0,0,0,\.55\)/g, 'rgba(0,0,0,.14)').replace(/rgba\(0,0,0,\.4\)/g, 'rgba(0,0,0,.12)')
    .replace(/#0c0c0e\b/gi, '#ffffff').replace(/#121214\b/gi, '#f5f5f7').replace(/#17171a\b/gi, '#ececf0').replace(/#08080a\b/gi, '#fafafa')
    .replace(/#f4f1e9\b/gi, '#1d1d1f').replace(/#d8d5cc\b/gi, '#333336').replace(/#97958d\b/gi, '#6e6e73').replace(/#85837c\b/gi, '#86868b')
    .replace(/#d2ff00\b/gi, '#16a34a').replace(/#ff6b6b\b|#ff8080\b/gi, '#d70015').replace(/#ffb020\b/gi, '#b26a00')
    .replace(/"Noto Serif SC",\s*"Songti SC",\s*serif|"Noto Serif SC",\s*serif/g, '"Inter",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif')
    .replace(/"Noto Sans SC",\s*sans-serif/g, '"Inter",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif')
    .replace(/"JetBrains Mono",\s*(ui-monospace,)?/g, 'ui-monospace,')
    .replace(/font-weight:\s*900/g, 'font-weight:700');
}
function scopeCss(css, sc) {
  const sel = (s) => s.split(',').map((x) => { x = x.trim(); if (!x) return x;
    if (x === ':root' || x === 'body' || x === 'html') return sc;
    if (/^(html|body)\b/.test(x)) return sc + x.replace(/^(html|body)/, '');
    return sc + ' ' + x; }).join(',');
  let out = '', i = 0;
  while (i < css.length) {
    const b = css.indexOf('{', i); if (b < 0) break;
    const head = css.slice(i, b).trim();
    if (head.startsWith('@media') || head.startsWith('@supports')) {
      let d = 1, j = b + 1; while (j < css.length && d) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
      out += head + '{' + scopeCss(css.slice(b + 1, j - 1), sc) + '}\n'; i = j; continue;
    }
    const e = css.indexOf('}', b);
    if (head.startsWith('@')) out += head + '{' + css.slice(b + 1, e) + '}\n';
    else out += sel(head.replace(/\/\*[\s\S]*?\*\//g, '')) + '{' + css.slice(b + 1, e) + '}\n';
    i = e + 1;
  }
  return out;
}
const fixLinks = (h) => h.replace(/href="\/#check"/g, 'href="/"').replace(/href="\/#(gen|val|robots)"/g, 'href="/tools/#$1"').replace(/>去 cetxt\.com 测一下 →</g, '>免费检测我的网站 →<');
// 旧页面并入深色内页：去掉旧页自带的背景，标题字距按中文排版
const LG_FIX = `.lg{background:transparent!important;padding-bottom:24px}.lg a:hover{text-decoration:none}
body.zh .lg h1,body.zh .lg h2,body.zh .lg h3{letter-spacing:0!important}
body.zh .lg h1{font-size:clamp(30px,4vw,48px)!important;line-height:1.25!important;font-weight:600!important}
body.zh .lg p,body.zh .lg li{line-height:1.75}
`;
const TOOLS_FIX = `.lg .grain,.lg #cur,.lg #curR,.lg #loader,.lg .announce{display:none!important}
.lg,.lg *{cursor:auto}.lg a,.lg button,.lg [role=tab],.lg label{cursor:pointer}
.lg .topbar{position:relative!important;top:auto!important;background:transparent!important;backdrop-filter:none!important;border-bottom:1px solid var(--line,rgba(255,255,255,.09))}
.lg .stage main{padding-top:0!important}
.lg .hero{padding:clamp(40px,6vw,72px) 0 clamp(28px,4vw,48px)!important}
body.zh .lg .hero h1{font-size:clamp(32px,4.6vw,56px)!important;line-height:1.2!important;font-weight:600!important;letter-spacing:0!important}
.lg .spot{display:none}
.lg .tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.lg .tabs::-webkit-scrollbar{display:none}.lg .tabs>*{white-space:nowrap;flex:none}
@media (max-width:720px){.lg .brand span{display:none}.lg .top-actions,.lg .gh{display:none!important}}
`;
const LEGACY_TEXT = [['faq/index.html', '/faq/'], ['guide/what-is-llms-txt/index.html', '/guide/what-is-llms-txt/'], ['guide/how-to-write-llms-txt/index.html', '/guide/how-to-write-llms-txt/'], ['survey/index.html', '/survey/']];
for (const [rel, path] of LEGACY_TEXT) {
  const src = readFileSync(join(root, 'legacy', rel), 'utf8');
  const title = src.match(/<title>([^<]*)<\/title>/)[1].replace(/ · cetxt$/, ' · VAKSEL');
  const desc = (src.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
  const style = src.match(/<style>([\s\S]*?)<\/style>/)[1];
  const lds = [...src.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/"name": "cetxt"/g, '"name": "VAKSEL 中文版"')).join('\n');
  const umami = (src.match(/<script defer src="https:\/\/umami[^>]*><\/script>/) || [''])[0];
  let body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>'));
  body = body.replace(/\s*<div class="topbar">[\s\S]*?<\/div>\n/, '\n')
    .replace(/\s*<div class="foot">[\s\S]*?<\/div>\n/, '\n')
    .replace(/\s*<footer>[\s\S]*?<\/footer>\n/, '\n');
  body = fixLinks(body);
  const css = scopeCss(darkCss(style), 'html:not(.lt) .lg') + scopeCss(lightCss(style), 'html.lt .lg') + LG_FIX;
  const fixed = readFileSync(join(root, rel), 'utf8');
  write(rel, page({ path, title, desc, active: rel.startsWith('survey') ? 'survey' : '', en: rel.startsWith('survey') ? '/research/' : '/',
    robots: 'index,follow', head: `<style>${css}</style>\n${lds}\n${umami}`, body: `<main class="lg">${body}</main>` }));
}

/* ---------- /tools/：从 legacy/tools 取正文与脚本，套深色内页外壳（导航、页脚、主题切换与全站一致） ---------- */
{
  const src = readFileSync(join(root, 'legacy/tools/index.html'), 'utf8');
  const title = src.match(/<title>([^<]*)<\/title>/)[1].replace(/ · cetxt$/, ' · VAKSEL');
  const desc = (src.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
  const lds = [...src.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/"name": "cetxt"/g, '"name": "VAKSEL 中文版"')).join('\n');
  const umami = (src.match(/<script defer src="https:\/\/umami[^>]*><\/script>/) || [''])[0];
  let body = src.slice(src.search(/<body[^>]*>/), src.lastIndexOf('</body>')).replace(/^<body[^>]*>/, '');
  body = body.replace(/\n<footer>\n  <div class="foot-in">[\s\S]*?<\/footer>\n/, '\n')
    .replace('<a class="brand" id="brandHome"><b>ce<em>txt</em></b><span>AI 爬虫与训练规则检测</span></a>', '<a class="brand" id="brandHome"><b>llms<em>.txt</em></b><span>生成 · 校验 · robots 规则</span></a>')
    .replace('<main>', '<main id="main" tabindex="-1">');
  body = fixLinks(body);
  // 跳过旧版开屏动画与顶部公告条（脚本仍需要这些元素存在）
  body = body.replace('<script src="/js/app.js"></script>', "<script>try{sessionStorage.setItem('cetxt_seen','1');localStorage.setItem('cetxt_announce','off')}catch(e){}</script>\n<script src=\"/js/app.js\"></script>");
  const raw = readFileSync(join(root, 'css/site.css'), 'utf8') + '\n' + readFileSync(join(root, 'css/audit.css'), 'utf8');
  writeFileSync(join(root, 'css/tools-zh.css'), '/* 由 build-zh.mjs 从 site.css + audit.css 生成，勿手改 */\n' + scopeCss(darkCss(raw), 'html:not(.lt) .lg') + scopeCss(lightCss(raw), 'html.lt .lg') + LG_FIX + TOOLS_FIX);
  write('tools/index.html', page({ path: '/tools/', title, desc, active: 'tools', en: '/', type: 'website', robots: 'index,follow',
    head: `<link rel="stylesheet" href="/css/tools-zh.css">\n${lds}\n${umami}`, body: `<div class="lg tools">${body}</div>` }));
}
for (const c of ['site', 'audit']) writeFileSync(join(root, `css/${c}-light.css`), '/* 由 build-zh.mjs 从 ' + c + '.css 自动生成的浅色版，勿手改 */\n' + lightCss(readFileSync(join(root, `css/${c}.css`), 'utf8')));
console.log('legacy pages rebuilt');
