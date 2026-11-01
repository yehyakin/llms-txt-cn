// 生成中文站（cetxt.com，品牌 VAKSEL 中文版）新结构页面：首页、报告页模板、修复指南、AI 爬虫百科、研究方法、监控（早期体验）、隐私/条款/联系、404、sitemap。
// 用法：node scripts/build-zh.mjs（改文案或 data/*.json、scripts/zh-content.mjs 后重跑并提交）。
// 旧页面保留：/tools/（llms.txt 生成器/在线体检/校验器）、/survey/、/faq/、/guide/*。样式共用 /en/app.css。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../en/view.js';
import { GUIDES_ZH, RESEARCH_ZH, PRIVACY_ZH, TERMS_ZH, CONTACT_ZH, HOME_FAQ_ZH, PRICING_FAQ_ZH, EXAMPLES_ZH } from './zh-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://cetxt.com';
const EN = 'https://vaksel.com';
const UPDATED = '2026-11-01';
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
  <div><h2 class="fh">修复指南</h2><a href="/guides/cloudflare/">Cloudflare</a><a href="/guides/cloudfront/">CloudFront / AWS WAF</a><a href="/guides/wordpress/">WordPress</a><a href="/guides/shopify/">Shopify</a></div>
  <div><h2 class="fh">资料</h2><a href="/bots/">AI 爬虫百科</a><a href="/survey/">中文大站普查</a><a href="/guide/what-is-llms-txt/">llms.txt 是什么</a><a href="/faq/">常见问题</a></div>
  <div class="fsmall"><span>© 2026 VAKSEL · cetxt.com 是 VAKSEL 中文版</span><a href="/privacy/">隐私</a><a href="/terms/">条款</a><a href="/contact/">联系</a><a href="${EN}${enPath || '/'}" hreflang="en" lang="en">English</a><span>我们不保存你检测的域名和 IP。</span></div>
</div></footer>`;

const HEADX = `<link rel="icon" href="/en/brand/vaksel-favicon.svg" type="image/svg+xml"><link rel="icon" href="/en/brand/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/en/brand/apple-touch-icon.png">
<link rel="preload" href="/en/fonts/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/en/app.css">`;

function page({ path, title, desc, body, active, ld, en, type = 'article', head = '', robots = 'noindex' }) {
  const enPath = en === undefined ? path : en;
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}"><meta name="theme-color" content="#ffffff">
<link rel="canonical" href="${SITE}${path}">
${enPath ? `<link rel="alternate" hreflang="zh-CN" href="${SITE}${path}"><link rel="alternate" hreflang="en" href="${EN}${enPath}">` : ''}
<meta property="og:type" content="${type}"><meta property="og:site_name" content="VAKSEL"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${SITE}/og.png"><meta name="twitter:card" content="summary_large_image">
${HEADX}${head ? '\n' + head : ''}${ld ? `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body class="zh">
${NAV(active, enPath)}
${body.includes('<main') ? body.replace('<main ', '<main id="main" tabindex="-1" ') : '<main id="main" tabindex="-1">' + body + '</main>'}
${FOOT(enPath)}
</body></html>
`;
}
const out = [];
function write(rel, html) { const abs = join(root, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, html); out.push(rel); return rel; }
const crumbs = (items) => '<div class="crumb">' + items.map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join(' <span>/</span> ') + '</div>';
const checkBox = (title = '现在检测你的网站', sub = '免费，无需注册。我们以 13 种不同身份请求你的首页，告诉你每个请求拿到了什么。') => `
<div class="cta mini"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
<form class="field inv" data-check autocomplete="off"><input placeholder="你的域名，例如 example.com" aria-label="域名" spellcheck="false" autocapitalize="off"><button class="btn">检测</button></form></div>`;
const CHECK_JS = `<script>
document.querySelectorAll('[data-check]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let v=(f.querySelector('input').value||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0];if(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v))location.href='/report/'+v;else{f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake')}}));
</script>`;

/* ---------- 报告页模板（Worker SSR 用 <!--HEAD--> 等标记填充） ---------- */
write('report/index.html', `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<!--HEAD--><title>AI 爬虫可访问性报告 · VAKSEL</title>
<meta name="robots" content="noindex"><!--/HEAD--><meta name="theme-color" content="#ffffff">
${HEADX}
</head><body class="zh">
${NAV('', '/report/')}
<main class="wrap" id="main">
  <div class="rp-head top">
    <div><div class="crumb">AI 爬虫可访问性报告</div><h1 id="dom"><!--DOM-->…<!--/DOM--></h1><div class="meta" id="meta"><!--META--><!--/META--></div></div>
    <form class="rp-search" id="f" autocomplete="off"><div class="field" style="flex:1"><input id="d" placeholder="检测其他域名" aria-label="域名" spellcheck="false" autocapitalize="off"><button class="btn">检测</button></div></form>
  </div>
  <div id="out"><!--OUT--><div class="loading" id="ld"><img class="vava" src="/en/brand/vava/vava3d-searching-mini.webp" width="96" height="121" alt="">正在以 13 种不同身份请求首页…</div><!--/OUT--></div>
</main>
${FOOT('/')}
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
const CAT = { search: '搜索', user: '用户触发', training: '训练', training_control: '训练控制标记', dataset: '数据集' };
const CAT_DESC = {
  search: '为了让网页能在搜索或 AI 回答里被找到、被引用而建立索引。',
  user: '用户让 AI 助手去看某个网页时，实时抓取一次。',
  training: '收集可能用于训练 AI 模型的内容。',
  training_control: '写在 robots.txt 里的标记，用来控制别的爬虫抓到的内容能否用于 AI。它本身不抓取网页。',
  dataset: '建设公开数据集，供第三方使用，其中包括 AI 训练。'
};
const ROBOTS = { yes: '遵守', partial: '不一定', no: '一般不遵守', unverified: '官方未说明' };
const CLASSIC = new Set(['Googlebot', 'Bingbot', 'Applebot', 'Baiduspider']);
const crawlers = DATA.crawlers;
const first = (s) => String(s).split('；')[0].split('。')[0] + '。';
const botCard = (c) => `<a class="bcard" href="/bots/${slug(c.token)}/"><div class="bt">${esc(c.token)}</div><div class="bv">${esc(c.vendor)}${CLASSIC.has(c.token) ? ' · 搜索引擎' : ''}</div><p>${esc(first(c.summary_zh))}</p></a>`;
let groups = '';
for (const [cat, label] of [['search', 'AI 搜索与助手'], ['user', '用户触发的抓取'], ['training', '训练爬虫'], ['training_control', '训练控制标记'], ['dataset', '公开数据集']]) {
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
<p class="note">来源：各运营方官方爬虫文档，核对于 ${DATA.crawlers[0].verified_on}。标注“部分核实”的条目，官方文档没有写明全部细节。</p>
</main>${CHECK_JS}`
}));
for (const c of crawlers) {
  const same = crawlers.filter((x) => x.vendor === c.vendor && x.token !== c.token);
  const ctrl = c.category === 'training_control';
  write(`bots/${slug(c.token)}/index.html`, page({
    path: `/bots/${slug(c.token)}/`, active: 'bots',
    ld: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: `${c.token} 是什么，要不要屏蔽`, dateModified: UPDATED, inLanguage: 'zh-CN', citation: c.docs_url },
    title: `${c.token} 是什么？要不要屏蔽 · VAKSEL`,
    desc: `${c.token} 是 ${c.vendor} 的${CAT[c.category] || ''}${ctrl ? '标记' : '爬虫'}。${c.block_consequence_zh}`.slice(0, 200),
    body: `<main class="wrap doc">${crumbs([['/', '首页'], ['/bots/', 'AI 爬虫'], [null, c.token]])}
<h1>${esc(c.token)}</h1>
<div class="facts"><div><span>运营方</span><b>${esc(c.vendor)}</b></div><div><span>用途</span><b>${CAT[c.category] || '其他'}</b></div><div><span>遵守 robots.txt</span><b>${ROBOTS[c.respects_robots] || '–'}</b></div><div><span>来源</span><b><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">官方文档 ↗</a></b></div></div>
<p class="lead l">${esc(c.summary_zh)}</p>
<h2>屏蔽后会怎样</h2><p>${esc(c.block_consequence_zh)}</p>
<h2>robots.txt 写法</h2>
${ctrl ? `<p>为它单独写一组规则。它不改变爬虫抓什么，只决定内容能否被这样使用：</p><pre>User-agent: ${esc(c.token)}\nDisallow: /</pre>` : `<p>屏蔽：</p><pre>User-agent: ${esc(c.token)}\nDisallow: /</pre><p>显式放行（当有更宽的规则拦了其他机器人时有用）：</p><pre>User-agent: ${esc(c.token)}\nAllow: /</pre>`}
<h2>官方原文</h2><blockquote>${esc(c.quote)}<cite><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">${esc(c.vendor)} 文档</a>，核对于 ${esc(c.verified_on)}</cite></blockquote>
${c.category === 'search' || c.category === 'user' ? `<h2>robots.txt 允许了，它就真能进来吗？</h2><p>即使 robots.txt 欢迎 ${esc(c.token)}，防火墙或 CDN 规则也可能拒绝它，而后台不会有任何提示。我们的检测会以 ${esc(c.token)} 的身份实际请求，同时用浏览器和 Googlebot 做对照，避免把爬虫 IP 核验误判成拦截。</p>` : ''}
${same.length ? `<h2>${esc(c.vendor)} 的其他爬虫</h2><div class="bgrid s">${same.map(botCard).join('')}</div>` : ''}
<div style="margin-top:28px">${checkBox(`${c.token} 能访问你的网站吗？`)}</div>
</main>${CHECK_JS}`
  }));
}

/* ---------- 修复指南 ---------- */
write('guides/index.html', page({
  path: '/guides/', active: 'guides', title: '修复指南：在 Cloudflare、CloudFront、WordPress、Shopify 上放行 AI 搜索爬虫 · VAKSEL',
  desc: '最常拦住 AI 搜索爬虫的几个平台，分步修复，同时保留拒绝 AI 训练的设置。',
  body: `<main class="wrap doc-head">${crumbs([['/', '首页'], [null, '修复指南']])}
<h1>修复指南</h1>
<p class="lead l">既出现在 ChatGPT、Perplexity、Claude 的搜索里，又不让内容被拿去训练。按报告指出的那一层来修。</p>
<div class="bgrid g2">${GUIDES_ZH.map((g) => `<a class="bcard g" href="/guides/${g.slug}/"><div class="bt">${esc(g.name)}</div><p>${esc(g.desc)}</p></a>`).join('')}</div>
<section class="sec tight">${checkBox('不确定拦截出在哪一层？', '报告会写明是哪家 CDN 应答的，并链接对应的指南。')}</section>
<p class="note">国内 CDN（阿里云、腾讯云 EdgeOne、百度智能云）与宝塔面板的指南正在整理。也可以看 <a href="/guide/what-is-llms-txt/">llms.txt 入门</a>。</p>
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
  { name: '专业版', price: '价格待公布', tag: '早期体验', hi: true, items: ['最多 10 个网站', '每天自动复测', 'AI 爬虫被拦时邮件提醒', '每个爬虫 90 天历史', '早期用户锁定首发价'], cta: '<a class="btn" href="#join" data-plan="pro">加入早期体验</a>' },
  { name: '代理商版', price: '价格待公布', tag: '早期体验', items: ['最多 50 个客户网站', '包含专业版全部功能', '白标 PDF 报告', '每周客户摘要', '优先支持'], cta: '<a class="btn" href="#join" data-plan="agency">加入早期体验</a>' }
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
<p><b>可能原因：</b>Cloudflare 的 Training 选项被设成了 <i>Block</i>，它现在也会拦搜索爬虫。</p><span class="mbtn">查看报告和修法</span></div></div></div></section>
<section class="sec" id="join"><div class="join card">
  <img class="vava" src="/en/brand/vava/vava3d-working-mini.webp" width="96" height="100" alt="" loading="lazy">
  <div class="jtext"><h2>加入早期体验</h2><p class="sub">价格公布并经你确认之前不会收费。早期用户锁定首发价。</p>
  <form id="wl" class="wl" autocomplete="on">
    <input type="email" name="email" required placeholder="you@company.com" aria-label="邮箱" autocomplete="email">
    <select name="plan" aria-label="方案"><option value="pro">专业版 · 最多 10 个网站</option><option value="agency">代理商版 · 最多 50 个网站</option></select>
    <input name="site" placeholder="主要网站（选填）" aria-label="主要网站（选填）" autocapitalize="off" spellcheck="false">
    <label class="wlplug"><input type="checkbox" name="plugin" value="1"> 我愿意装一个插件或 Worker 片段，查看真实 AI 爬虫的访问记录</label>
    <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <input type="hidden" name="lang" value="zh">
    <button class="btn">加入</button>
  </form><p class="wlmsg" id="wlmsg" role="status"></p></div>
</div></section>
<section class="sec tight"><h2>常见问题</h2><div class="faq">${PRICING_FAQ_ZH.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
</main>
<script>
{const q=new URLSearchParams(location.search),st=q.get('site'),pl=q.get('plan');if(st)document.querySelector('#wl [name=site]').value=st;if(pl==='agency'||pl==='pro')document.querySelector('#wl [name=plan]').value=pl}
document.querySelectorAll('[data-plan]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#wl [name=plan]').value=a.dataset.plan}));
const wl=document.getElementById('wl'),msg=document.getElementById('wlmsg');
wl.addEventListener('submit',async e=>{e.preventDefault();const b=wl.querySelector('button');b.disabled=true;msg.textContent='';
  const fd=Object.fromEntries(new FormData(wl));
  try{const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fd)});const j=await r.json();
    if(r.ok&&j.ok){wl.hidden=true;msg.className='wlmsg ok';msg.textContent='已加入。账号准备好后，我们会发邮件到 '+fd.email+'。'}
    else{msg.className='wlmsg bad';msg.textContent=j.error==='bad_email'?'邮箱格式似乎不正确。':j.error==='rate_limited'?'尝试次数过多，请稍等一分钟。':'出了点问题，请重试。';b.disabled=false}
  }catch{msg.className='wlmsg bad';msg.textContent='网络错误，请重试。';b.disabled=false}
});
</script>`
}));

/* ---------- 首页 ---------- */
const FIXT = JSON.parse(readFileSync(join(root, 'tests/fixture-toyota.json'), 'utf8'));
const demo = renderReport(FIXT, { lang: 'zh', base: '', when: '2026-11-01T09:12:00Z', url: SITE + '/report/toyota.com' });
write('index.html', page({
  path: '/', type: 'website', title: 'AI 搜索能访问你的网站吗？免费 AI 爬虫可访问性检测 · VAKSEL',
  desc: '检测 ChatGPT、Perplexity、Claude 的搜索爬虫能否真正访问你的网站：robots.txt、防火墙和 CDN 拦截、noindex、只靠 JavaScript 渲染的页面。免费，无需注册。',
  ld: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'VAKSEL', alternateName: 'VAKSEL 中文版', url: SITE + '/', inLanguage: 'zh-CN', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' } },
  body: `<header class="hero"><div class="wrap">
  <span class="eyebrow"><b></b>免费 · 无需注册 · 几秒出结果</span>
  <h1>AI 搜索<span class="grad">真的能访问</span>你的网站吗？</h1>
  <p class="lead">robots.txt 写着欢迎，防火墙却可能把它挡在门外。我们用 ChatGPT、Perplexity、Claude 爬虫的身份请求你的页面，再和浏览器、Googlebot 对照，告诉你每个请求拿到了什么。</p>
  <form class="field" id="f" autocomplete="off" role="search">
    <input id="d" name="d" placeholder="你的域名，例如 example.com" inputmode="url" autocapitalize="off" spellcheck="false" aria-label="你的域名">
    <button class="btn" type="submit">开始检测</button>
  </form>
  <p class="hint">试试 <button type="button" data-d="toyota.com">toyota.com</button>·<button type="button" data-d="github.com">github.com</button>·<button type="button" data-d="shopify.com">shopify.com</button></p>
</div></header>

<section class="sec demo-sec" aria-label="报告示例"><div class="wrap">
  <div class="win"><div class="bar"><i></i><i></i><i></i><span>cetxt.com/report/toyota.com</span></div>
    <div class="wbody" inert><div class="rp-head"><div><div class="crumb">AI 爬虫可访问性报告</div><h2 class="dh">toyota.com</h2><div class="meta">${demo.meta}</div></div></div>${demo.html}</div>
    <a class="wopen" href="/report/toyota.com">打开实时报告 →</a></div>
  <p class="cap">2026 年 11 月 1 日的真实报告。丰田的 robots.txt 欢迎 AI 搜索爬虫，防火墙却把它们挡在了外面。</p>
</div></section>

<section class="sec" id="checks"><div class="wrap">
  <h2>三层检查，都是实测</h2>
  <p class="sub">大多数检测工具只读 robots.txt。我们还会实际发请求，并设对照组，避免把爬虫 IP 核验误判成拦截。</p>
  <div class="grid3">
    <div class="card c1"><div class="ic" aria-hidden="true">1</div><h3>robots.txt 规则</h3><p>20 多个 AI 爬虫逐个给结论，搜索和训练分开看：可以拒绝训练，同时不从 AI 回答里消失。</p></div>
    <div class="card c2"><div class="ic" aria-hidden="true">2</div><h3>防火墙与 CDN</h3><p>以 OAI-SearchBot、PerplexityBot、Claude-SearchBot 等身份实际请求，并标出是哪家 CDN 应答：Cloudflare、CloudFront、Akamai 等。</p></div>
    <div class="card c3"><div class="ic" aria-hidden="true">3</div><h3>页面可读性</h3><p>检查 noindex、nosnippet，以及不执行 JavaScript 时页面还有没有内容。大多数 AI 爬虫不跑 JavaScript。</p></div>
  </div>
</div></section>

<section class="sec" id="data"><div class="wrap">
  <div class="stat">
    <div class="card dark" style="padding:30px">
      <p class="k1">2026 年 11 月热门网站抽样</p>
      <div class="big grad">1 / 28</div>
      <p class="k2">的可访问网站在防火墙层面静默拦截 AI 搜索爬虫：robots.txt 允许，Googlebot 也能进。</p>
      <p class="k3">Tranco 前 2 万中随机 600 个网站，其中 362 个可访问，13 个命中。中文大站同样测了 1000 个，静默拦截约 0.8%。</p>
    </div>
    <div class="card" style="padding:26px">
      <h3 style="margin-top:0;font-size:19px">抽样里发现的例子</h3>
      <ul class="ex">${EXAMPLES_ZH.map(([d, t, c, w]) => `<li><a href="/report/${d}"><b>${d}</b><span class="tag ${c === 'v-bad' ? 't-bad' : 't-warn'}">${t}</span></a><p>${w}</p></li>`).join('')}</ul>
      <p class="note" style="margin-top:8px">2026 年 11 月 1 日的结果，点开会重新检测。<a href="/research/">看测量方法 →</a></p>
    </div>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <h2>哪一层拦的，就修哪一层</h2>
  <p class="sub">每份报告都会写明是哪一层拒绝了爬虫，并链接对应的指南。</p>
  <div class="bgrid g4">${GUIDES_ZH.map((g) => `<a class="bcard g" href="/guides/${g.slug}/"><div class="bt">${esc(g.name)}</div><p>${esc(String(g.desc).split('。')[0])}。</p></a>`).join('')}</div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="stat">
    <div class="card" style="padding:26px"><h3 style="margin-top:0;font-size:19px">llms.txt 工具</h3><p>生成、校验 llms.txt，还有 robots.txt 规则生成器。原来的工具都还在。</p><p style="margin-top:12px"><a class="btn ghost" href="/tools/">打开工具</a></p></div>
    <div class="card" style="padding:26px"><h3 style="margin-top:0;font-size:19px">中文大站普查</h3><p>1000 个中文网站的 AI 爬虫规则与 llms.txt 现状。</p><p style="margin-top:12px"><a class="btn ghost" href="/survey/">看普查报告</a></p></div>
  </div>
</div></section>

<section class="sec" id="monitor"><div class="wrap">
  <div class="cta">
    <div><h3>规则会变，变了要有人告诉你</h3><p>每天复测，CDN 更新、插件或 robots.txt 改动一旦挡住 AI 爬虫就发邮件。代理商可管理多个客户网站。</p></div>
    <a class="btn" href="/pricing/">了解监控</a>
  </div>
</div></section>

<section class="sec tight"><div class="wrap"><h2>常见问题</h2><div class="faq">${HOME_FAQ_ZH.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>

<script>
const f=document.getElementById('f'),d=document.getElementById('d');
function clean(v){v=(v||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0].replace(/\\.$/,'');return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v)?v:null}
function go(v){const c=clean(v);if(!c){f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake');d.focus();return}location.href='/report/'+c}
f.addEventListener('submit',e=>{e.preventDefault();go(d.value)});
document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>go(b.dataset.d));
</script>`
}));

/* ---------- 404 ---------- */
write('404.html', page({
  path: '/404', title: '页面不存在 · VAKSEL', desc: '这个页面不存在。', en: '',
  body: `<main class="wrap nf"><img src="/en/brand/vava/vava3d-searching-mini.webp" width="160" height="202" alt="正在找东西的狐狸 Vava">
<h1>找遍了也没找到</h1><p class="lead">这个页面不存在，或者已经搬走了。试试检测，或者看看下面这些。</p>
<form class="field" data-check autocomplete="off"><input placeholder="你的域名，例如 example.com" aria-label="域名" spellcheck="false" autocapitalize="off"><button class="btn">开始检测</button></form>
<p class="hint"><a href="/guides/">修复指南</a> · <a href="/bots/">AI 爬虫百科</a> · <a href="/tools/">llms.txt 工具</a> · <a href="/survey/">普查报告</a></p></main>${CHECK_JS}`
}));

/* ---------- sitemap ---------- */
const urls = ['/', '/research/', '/pricing/', '/guides/', ...GUIDES_ZH.map((g) => `/guides/${g.slug}/`), '/bots/', ...crawlers.map((c) => `/bots/${slug(c.token)}/`), '/tools/', '/survey/', '/faq/', '/guide/what-is-llms-txt/', '/guide/how-to-write-llms-txt/', '/llms.txt', '/privacy/', '/terms/', '/contact/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);
console.log('zh pages:', out.length);

/* ---------- 旧文字页迁入新模板（11-02）：源文件在 legacy/，正文原样保留，旧样式转浅色并限定在 .lg 内 ---------- */
export function lightCss(css) {
  const a = (r, g, b) => (m, x) => `rgba(${r},${g},${b},${x})`;
  return css
    .replace(/rgba\(244,\s*241,\s*233,\s*([\d.]+)\)/g, (m, x) => `rgba(0,0,0,${Math.min(1, +x * 0.7).toFixed(3)})`)
    .replace(/rgba\(210,\s*255,\s*0,\s*([\d.]+)\)/g, a(12, 99, 241))
    .replace(/rgba\(255,\s*107,\s*107,\s*([\d.]+)\)/g, a(215, 0, 21))
    .replace(/rgba\(255,\s*176,\s*32,\s*([\d.]+)\)/g, a(178, 106, 0))
    .replace(/rgba\(12,\s*12,\s*14,\s*\.72\)/g, 'rgba(255,255,255,.82)').replace(/rgba\(8,\s*8,\s*10,\s*\.7\)/g, 'rgba(255,255,255,.78)')
    .replace(/rgba\(0,0,0,\.55\)/g, 'rgba(0,0,0,.14)').replace(/rgba\(0,0,0,\.4\)/g, 'rgba(0,0,0,.12)')
    .replace(/#0c0c0e\b/gi, '#ffffff').replace(/#121214\b/gi, '#f5f5f7').replace(/#17171a\b/gi, '#ececf0').replace(/#08080a\b/gi, '#fafafa')
    .replace(/#f4f1e9\b/gi, '#1d1d1f').replace(/#d8d5cc\b/gi, '#333336').replace(/#97958d\b/gi, '#6e6e73').replace(/#85837c\b/gi, '#86868b')
    .replace(/#d2ff00\b/gi, '#0C63F1').replace(/#ff6b6b\b|#ff8080\b/gi, '#d70015').replace(/#ffb020\b/gi, '#b26a00')
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
  const css = scopeCss(lightCss(style), '.lg') + '.lg{background:#fff;padding-bottom:24px}.lg a:hover{text-decoration:none}\n';
  const fixed = readFileSync(join(root, rel), 'utf8');
  write(rel, page({ path, title, desc, active: rel.startsWith('survey') ? 'survey' : '', en: rel.startsWith('survey') ? '/research/' : '/',
    robots: 'index,follow', head: `<style>${css}</style>\n${lds}\n${umami}`, body: `<main class="lg">${body}</main>` }));
}

/* ---------- 旧页面换壳：只换导航、页脚、图标和标题后缀，正文与网址不动（幂等） ---------- */
const LEGACY = [['tools/index.html', 'tools', '/']];
for (const [rel, active, enPath] of LEGACY) {
  const abs = join(root, rel);
  let h = readFileSync(abs, 'utf8');
  h = h.replace(/<!--VXS-NAV-->[\s\S]*?<!--\/VXS-NAV-->\n?/, '').replace(/<!--VXS-FOOT-->[\s\S]*?<!--\/VXS-FOOT-->\n?/, '');
  h = h.replace('href="/css/site.css"', 'href="/css/site-light.css"').replace('href="/css/audit.css"', 'href="/css/audit-light.css"').replace('<meta name="theme-color" content="#0c0c0e">', '<meta name="theme-color" content="#ffffff">').replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '').replace(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"( crossorigin)?>\n?/g, '').replace(/cetxt · 给 AI 的网站说明书/g, 'llms.txt 中文生成器与校验器 · VAKSEL');
  h = h.replace(/ · cetxt<\/title>/, ' · VAKSEL</title>').replace(/(<meta property="og:title" content="[^"]*?) · cetxt"/, '$1 · VAKSEL"').replace(/<meta property="og:site_name" content="[^"]*">/, '<meta property="og:site_name" content="VAKSEL">');
  h = h.replace('<link rel="icon" type="image/svg+xml" href="/favicon.svg">', '<link rel="icon" type="image/svg+xml" href="/en/brand/vaksel-favicon.svg">').replace('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">', '<link rel="icon" href="/en/brand/favicon.ico" sizes="16x16 32x32 48x48">').replace('<link rel="apple-touch-icon" href="/apple-touch-icon.png">', '<link rel="apple-touch-icon" href="/en/brand/apple-touch-icon.png">');
  if (!h.includes('/en/shell.css')) h = h.replace('</head>', '<link rel="stylesheet" href="/en/shell.css">\n</head>');
  if (rel.startsWith('tools/') && !h.includes('id="vxs-fix"')) h = h.replace('</head>', '<style id="vxs-fix">.announce{position:relative!important}.topbar{position:sticky!important;top:0!important}main,body.has-ann main{padding-top:28px!important}html{scroll-padding-top:70px}</style>\n</head>');
  // 去掉旧的“← cetxt.com”顶栏和旧页脚
  h = h.replace(/\n\s*<div class="topbar">(?:<span>[^<]*<\/span>)?<a href="\/">← cetxt\.com<\/a>(?:<a href="\/survey\/">调查报告<\/a>)?<\/div>\n/, '\n');
  h = h.replace(/\n\s*<div class="foot"><span>cetxt\.com — 给 AI 的网站说明书<\/span><a href="\/">回首页<\/a><\/div>\n/, '\n');
  h = h.replace(/\n\s*<footer>\s*<span>CETXT\.COM 出品 · 数据备查<\/span>[\s\S]*?<\/footer>\n/, '\n');
  h = h.replace(/\n<footer>\n  <div class="foot-in">[\s\S]*?<\/footer>\n/, '\n');
  h = h.replace('<a class="brand" id="brandHome"><b>ce<em>txt</em></b><span>AI 爬虫与训练规则检测</span></a>', '<a class="brand" id="brandHome"><b>llms<em>.txt</em></b><span>生成 · 校验 · robots 规则</span></a>');
  const nav = '<!--VXS-NAV--><div class="vxs' + (rel.startsWith('tools/') ? '' : ' top') + '">' + NAV(active, enPath) + '</div><!--/VXS-NAV-->\n';
  const foot = '<!--VXS-FOOT--><div class="vxs">' + FOOT(enPath) + '</div><!--/VXS-FOOT-->\n';
  h = h.replace(/<body([^>]*)>\n?/, (m) => m.trimEnd() + '\n' + nav);
  const i = h.lastIndexOf('</body>');
  // 页脚放在页面脚本之前（tools 的脚本紧跟原页脚）
  const j = rel.startsWith('tools/') ? h.indexOf('<script src="/llms.js"></script>') : i;
  h = h.slice(0, j) + foot + h.slice(j);
  writeFileSync(abs, h);
}
for (const c of ['site', 'audit']) writeFileSync(join(root, `css/${c}-light.css`), '/* 由 build-zh.mjs 从 ' + c + '.css 自动生成的浅色版，勿手改 */\n' + lightCss(readFileSync(join(root, `css/${c}.css`), 'utf8')));
console.log('legacy reshelled:', LEGACY.length);
