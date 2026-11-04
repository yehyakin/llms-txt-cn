// 生成英文站（VAKSEL）的静态页：统一导航/页脚、定价、指南、爬虫百科、404、sitemap。
// 用法：node scripts/build-en.mjs   （改了文案或 data/*.json 后重跑，再提交生成结果）
// 页面里的链接都写 /en/...；在 vaksel.com 上由 Worker 改写成根路径。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, VENDOR_EN } from '../en/view.js';
import { GRADE_VERSION } from '../en/grade.js';
import { FIXTURES, LAB_SUFFIX } from '../worker/lab.js';
const LAB = JSON.parse(readFileSync(new URL('../data/lab-results.json', import.meta.url), 'utf8'));

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://vaksel.com';
const UPDATED = '2026-11-03';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const canon = (p) => SITE + p.replace(/^\/en/, '');

// 生产 cetxt.com 仍是旧站，只有首页存在（2026-11-04 核实 /bots/ /pricing/ 均 404）。中文新站上线后改 ZH_LIVE = true，链接与 hreflang 恢复逐页对应。
const ZH_LIVE = false;
const zhHref = (path) => 'https://cetxt.com' + (ZH_LIVE && path && path !== '/en/404' ? path.replace(/^\/en/, '') : '/');
export const NAV = (active, path) => `<a class="skip" href="#main">Skip to content</a>
<nav class="nav" aria-label="Main"><div class="wrap">
  <a class="logo" href="/en/" aria-label="VAKSEL home"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31"></a>
  <div class="links" id="navlinks">
    <a class="n${active === 'guides' ? ' on' : ''}" href="/en/guides/"${active === 'guides' ? ' aria-current="page"' : ''}>Fix guides</a>
    <a class="n${active === 'bots' ? ' on' : ''}" href="/en/bots/"${active === 'bots' ? ' aria-current="page"' : ''}>AI crawlers</a>
    <a class="n${active === 'pricing' ? ' on' : ''}" href="/en/pricing/"${active === 'pricing' ? ' aria-current="page"' : ''}>Pricing</a>
    <a class="n lang" href="${zhHref(path)}" hreflang="zh" lang="zh">中文</a>
  </div>
  <button class="menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="navlinks"><span></span><span></span></button>
</div></nav>
<script>(()=>{const n=document.currentScript.previousElementSibling,b=n.querySelector('.menu');b.onclick=()=>{const o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&n.classList.contains('open')){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus()}})})()</script>`;

export const FOOT = `<footer><div class="wrap fgrid">
  <div class="fbrand"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31" loading="lazy"><p>Can AI search actually reach your site? Free checks for robots.txt, firewall and CDN blocks.</p></div>
  <div><h2 class="fh">Product</h2><a href="/en/">Access check</a><a href="/en/pricing/">Pricing &amp; monitoring</a><a href="/en/research/">Research</a></div>
  <div><h2 class="fh">Fix guides</h2><a href="/en/guides/cloudflare/">Cloudflare</a><a href="/en/guides/cloudfront/">CloudFront / AWS WAF</a><a href="/en/guides/wordpress/">WordPress</a><a href="/en/guides/shopify/">Shopify</a></div>
  <div><h2 class="fh">AI crawlers</h2><a href="/en/bots/oai-searchbot/">OAI-SearchBot</a><a href="/en/bots/perplexitybot/">PerplexityBot</a><a href="/en/bots/claude-searchbot/">Claude-SearchBot</a><a href="/en/bots/">All crawlers</a><a href="/en/bots/changelog/">Changelog</a></div>
  <div class="fsmall"><span>© 2026 VAKSEL</span><a href="/en/privacy/">Privacy</a><a href="/en/terms/">Terms</a><a href="/en/contact/">Contact</a><a href="https://cetxt.com/" hreflang="zh" lang="zh">中文版 cetxt.com</a><span>We don't store the domains you check or your IP address.</span></div>
</div></footer>`;

export const HEADX = `<link rel="icon" href="/en/brand/vaksel-favicon.svg" type="image/svg+xml"><link rel="icon" href="/en/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/en/apple-touch-icon.png"><link rel="manifest" href="/en/site.webmanifest">
<link rel="preload" href="/en/fonts/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/en/fonts/jetbrains-mono-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/en/app.css">`;

// 深色页的浅色模式（2026-11-04，参考 atypica 菜单里的“外观”切换）：默认深色，用户切换后存在 localStorage 'vk-theme'。
const THEME_BOOT = `<script>try{if(localStorage.getItem('vk-theme')==='light'){document.documentElement.classList.add('lt');document.querySelector('meta[name=theme-color]').content='#ffffff'}}catch(e){}</script>`;
function themeNav(html) {
  return html
    .replace(/<img src="\/en\/brand\/vaksel-horizontal-primary.svg"([^>]*)>/, '<img class="lg-d" src="/en/brand/vaksel-horizontal-reverse.svg"$1><img class="lg-l" src="/en/brand/vaksel-horizontal-primary.svg"$1>')
    .replace(/(<a class="n lang"[^>]*>[^<]*<\/a>)/, `$1\n    <button class="n thm" type="button" aria-label="Switch appearance" title="Light / dark"><svg class="i-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> <svg class="i-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></button>`)
    .replace('</script>', `;(()=>{const b=document.querySelector('.thm'),r=document.documentElement,m=document.querySelector('meta[name=theme-color]');const set=l=>{r.classList.toggle('lt',l);b.setAttribute('aria-pressed',l);m&&(m.content=l?'#ffffff':'#0a0a0a');try{localStorage.setItem('vk-theme',l?'light':'dark')}catch(e){}};b.setAttribute('aria-pressed',r.classList.contains('lt'));b.onclick=()=>set(!r.classList.contains('lt'))})()</script>`);
}
function page({ path, title, desc, body, active, ld, type = 'article', theme = '' }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex"><meta name="theme-color" content="${theme ? '#0a0a0a' : '#ffffff'}">
<link rel="canonical" href="${canon(path)}">
<link rel="alternate" hreflang="en" href="${canon(path)}">${ZH_LIVE || path === '/en/' ? `<link rel="alternate" hreflang="zh-CN" href="${zhHref(path)}">` : ''}
<meta property="og:type" content="${type}"><meta property="og:site_name" content="VAKSEL"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon(path)}"><meta property="og:image" content="${SITE}/og/site.png"><meta name="twitter:card" content="summary_large_image">
${HEADX}${theme ? '<link rel="stylesheet" href="/en/home-dark.css">' + THEME_BOOT : ''}${ld ? `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body${theme ? ` class="${theme}"` : ''}>
${theme ? themeNav(NAV(active, path)) : NAV(active, path)}
${body.includes('<main') ? body.replace('<main ', '<main id="main" tabindex="-1" ') : '<main id="main" tabindex="-1">' + body + '</main>'}
${theme ? FOOT.replace(/<img src="\/en\/brand\/vaksel-horizontal-primary.svg"([^>]*)>/, '<img class="lg-d" src="/en/brand/vaksel-horizontal-reverse.svg"$1><img class="lg-l" src="/en/brand/vaksel-horizontal-primary.svg"$1>') : FOOT}
</body></html>
`;
}
// 生成页统一 noindex；正式上线时由 Worker 在 INDEX_REPORTS=1 时改成 index,follow。

function write(rel, html) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, html);
  return rel;
}

const crumbs = (items) => '<div class="crumb">' + items.map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join(' <span>/</span> ') + '</div>';
const checkBox = (title = 'Check your site now', sub = 'Free, no sign-up. We request your homepage as 18 different clients and show what each one gets.') => `
<div class="cta mini"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
<form class="field inv" data-check autocomplete="off"><input placeholder="yourdomain.com" aria-label="Domain" spellcheck="false" autocapitalize="off"><button class="btn">Check</button></form></div>`;
const CHECK_JS = `<script>
document.querySelectorAll('[data-check]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let v=(f.querySelector('input').value||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0];if(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v))location.href='/en/report/'+v;else{f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake')}}));
</script>`;

/* ---------- 数据 ---------- */
const DATA = JSON.parse(readFileSync(join(root, 'data/ai-crawlers.json'), 'utf8'));
for (const c of DATA.crawlers) c.vendor = VENDOR_EN[c.vendor] || c.vendor; // 英文页显示英文运营方名
const EN = JSON.parse(readFileSync(join(root, 'data/crawlers-en.json'), 'utf8')).bots;
const CAT = { search: 'Search', user: 'User-triggered', training: 'Training', training_control: 'Training control token', dataset: 'Dataset' };
const CAT_DESC = {
  search: 'Indexes pages so they can be found and cited in search or AI answers.',
  user: 'Fetches a page in real time because a user asked the assistant to.',
  training: 'Collects content that may be used to train AI models.',
  training_control: 'A robots.txt token that controls AI use of content another crawler fetched. It never fetches pages itself.',
  dataset: 'Builds an open dataset that third parties use, including for AI training.'
};
const ROBOTS = { yes: 'Yes', partial: 'Not always', no: 'Generally no', unverified: 'Not documented' };
const CLASSIC = new Set(['Googlebot', 'Bingbot', 'Applebot', 'Baiduspider', 'YandexBot', 'Yeti']);
const crawlers = DATA.crawlers.filter((c) => EN[c.token]);
const missing = DATA.crawlers.filter((c) => !EN[c.token]).map((c) => c.token);
if (missing.length) throw new Error('crawlers-en.json 缺少: ' + missing.join(', '));

const out = [];

/* ---------- 爬虫百科 ---------- */
const groupOrder = [['search', 'AI search & assistants'], ['user', 'User-triggered fetchers'], ['training', 'Training crawlers'], ['training_control', 'Training control tokens'], ['dataset', 'Open datasets']];
function botCard(c) {
  return `<a class="bcard" href="/en/bots/${slug(c.token)}/"><div class="bt">${esc(c.token)}</div><div class="bv">${esc(VENDOR_EN[c.vendor] || c.vendor)}${CLASSIC.has(c.token) ? ' · search engine' : ''}</div><p>${esc(EN[c.token].summary.split('. ')[0].replace(/\.$/, ''))}.</p></a>`;
}
let groups = '';
for (const [cat, label] of groupOrder) {
  const list = crawlers.filter((c) => c.category === cat);
  if (!list.length) continue;
  groups += `<section class="sec tight"><h2>${label}</h2><p class="sub">${CAT_DESC[cat]}</p><div class="bgrid">${list.map(botCard).join('')}</div></section>`;
}
out.push(write('en/bots/index.html', page({
  path: '/en/bots/', active: 'bots',
  title: 'AI crawler directory: user agents, purposes and what blocking does · VAKSEL',
  desc: `${crawlers.length} AI and search crawlers, from GPTBot and OAI-SearchBot to PerplexityBot and Claude-SearchBot: what each one does, whether it follows robots.txt, and what happens when you block it.`,
  body: `<main class="wrap doc-head">${crumbs([['/en/', 'Home'], [null, 'AI crawlers']])}
<h1>AI crawler directory</h1>
<p class="lead l">Search, training and user-triggered crawlers are separate agents. Blocking the wrong one can take you out of AI answers without stopping training. Every entry links the operator's own documentation.</p>
${groups}
<section class="sec tight">${checkBox('Which of these can reach your site?', 'We test robots.txt and send live requests as the AI search crawlers above.')}</section>
<p class="note">See what changed recently in the <a href="/en/bots/changelog/">AI crawler changelog</a>. Sources: each operator's official crawler documentation, checked ${DATA.crawlers[0].verified_on}. Entries marked “partial” rely on documentation that doesn't state every detail.</p>
</main>${CHECK_JS}`
})));

for (const c of crawlers) {
  const e = EN[c.token];
  const same = crawlers.filter((x) => x.vendor === c.vendor && x.token !== c.token);
  const robotsLine = `User-agent: ${c.token}\nDisallow: /`;
  const allowLine = `User-agent: ${c.token}\nAllow: /`;
  const ld = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: `${c.token}: what it is and how to block or allow it`, dateModified: UPDATED, author: { '@type': 'Organization', name: 'VAKSEL' }, about: c.token, citation: c.docs_url };
  out.push(write(`en/bots/${slug(c.token)}/index.html`, page({
    path: `/en/bots/${slug(c.token)}/`, active: 'bots', ld,
    title: `${c.token}: what it is, and should you block it? · VAKSEL`,
    desc: `${c.token} is ${c.vendor}'s ${CAT[c.category].toLowerCase()} ${c.category === 'training_control' ? 'token' : 'crawler'}. ${e.block}`.slice(0, 300),
    body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], ['/en/bots/', 'AI crawlers'], [null, c.token]])}
<h1>${esc(c.token)}</h1>
<div class="facts"><div><span>Operator</span><b>${esc(VENDOR_EN[c.vendor] || c.vendor)}</b></div><div><span>Purpose</span><b>${CAT[c.category]}</b></div><div><span>Follows robots.txt</span><b>${ROBOTS[c.respects_robots] || '–'}</b></div><div><span>Source</span><b><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">Official docs ↗</a></b></div></div>
<p class="lead l">${esc(e.summary)}</p>
<h2>What happens if you block it</h2><p>${esc(e.block)}</p>
<h2>Our take</h2><p>${esc(e.advice)}</p>
${c.category === 'training_control' ? '' : `<h2>robots.txt</h2><p>To block it:</p><pre>${esc(robotsLine)}</pre><p>To allow it explicitly (useful when a wider rule blocks other bots):</p><pre>${esc(allowLine)}</pre>`}
${c.category === 'training_control' ? `<h2>robots.txt</h2><p>Add a group for the token; it doesn't change what the crawler fetches, only how the content may be used:</p><pre>${esc(robotsLine)}</pre>` : ''}
<h2>The operator's own words</h2><blockquote>${esc(c.quote)}<cite><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">${esc(c.vendor)} documentation</a>, checked ${esc(c.verified_on)}</cite></blockquote>
${c.category === 'search' || c.category === 'user' ? `<h2>robots.txt allows it, but is it really getting through?</h2><p>A firewall or CDN rule can reject ${esc(c.token)} even when robots.txt welcomes it, and nothing in your CMS shows it. Our check sends a live request as ${esc(c.token)} alongside a normal browser and a Googlebot control, so a bot-verification rule isn't mistaken for a block.</p>` : ''}
${same.length ? `<h2>Other ${esc(c.vendor)} agents</h2><div class="bgrid s">${same.map(botCard).join('')}</div>` : ''}
<div style="margin-top:28px">${checkBox(`Can ${c.token} reach your site?`)}</div>
</main>${CHECK_JS}`
  })));
}

/* ---------- 修复指南 ---------- */
const GUIDES = [
  {
    slug: 'cloudflare', name: 'Cloudflare', title: 'Cloudflare is blocking AI crawlers: how to fix it (2026 controls)',
    desc: 'Since September 15, 2026 Cloudflare has separate Search, Training and Agent controls. Here is how to stay in ChatGPT, Perplexity and Claude search while opting out of training.',
    body: `
<p class="lead l">Cloudflare replaced its single “Block AI bots” switch with three controls on September 15, 2026. A setting that used to be harmless can now block search crawlers, including Googlebot, Bingbot and Applebot.</p>
<div class="callout"><b>The short version.</b> In <b>Security → Settings</b>, set <b>Search</b> to <i>Allow</i>, <b>Training</b> to <i>Disallow AI Training</i>, and <b>Agent</b> to whatever you prefer. Don't use <i>Block</i> for Training unless you're happy to leave Google, Bing and Apple search too.</div>
<h2>1. Check the three AI bot controls</h2>
<p>Cloudflare now classifies bots by behavior. Each control has its own setting:</p>
<table class="tbl"><thead><tr><th>Control</th><th>What it covers</th><th>Setting we recommend</th></tr></thead><tbody>
<tr><td><b>Search</b></td><td>Crawlers that index content to answer questions later, such as OAI-SearchBot, PerplexityBot and Claude-SearchBot.</td><td>Allow</td></tr>
<tr><td><b>Training</b></td><td>Crawlers that collect content to train models, including mixed-use crawlers that do both search and training.</td><td>Disallow AI Training</td></tr>
<tr><td><b>Agent</b></td><td>User-directed fetches, such as ChatGPT-User, Claude-User and browser-use agents.</td><td>Allow, or Block on pages with ads</td></tr>
</tbody></table>
<p>Options are <i>Allow</i>, <i>Block on pages with ads</i> and <i>Block</i>; Training also offers <i>Disallow AI Training</i>.</p>
<h2>2. Understand what “Block” means now</h2>
<p>From September 15, 2026, <i>Block</i> and <i>Block on pages with ads</i> apply to mixed-use crawlers too. Cloudflare's own announcement says selecting Block for Training “will stop Applebot, Bingbot, and Googlebot from reaching your site, search included.”</p>
<p><i>Disallow AI Training</i> is the search-safe option: Cloudflare publishes a no-training preference in your robots.txt, keeps crawlers it designates “Accountable” (Apple, Google, Microsoft) allowed for search, and blocks training-only crawlers such as GPTBot, ClaudeBot, Meta-ExternalAgent and Amazonbot.</p>
<h2>3. Check what Cloudflare migrated for you</h2>
<p>Existing sites were migrated automatically. If you had the old <i>Block AI bots</i> switch on, you now have Search <i>Allow</i>, Training <i>Disallow AI Training</i>, Agent <i>Block on pages with ads</i>. New domains on ad-supported sites get the same preset. That Agent setting can block ChatGPT-User and Claude-User on pages that show ads.</p>
<h2>4. Look for custom rules and Bot Fight Mode</h2>
<ol><li><b>Security rules / WAF custom rules</b>: search for expressions using <code>cf.verified_bot_category</code>, <code>http.user_agent</code> or bot names like <code>GPTBot</code>. An old rule written before the new controls may still block AI search crawlers.</li>
<li><b>Bot Fight Mode / Super Bot Fight Mode</b>: these can challenge automated traffic. If AI crawlers get challenge pages, review these settings and allow verified bots.</li>
<li><b>AI Crawl Control</b> (formerly AI Audit): shows which AI crawlers hit your site and lets you allow or block individual crawlers. Check that the search crawlers you want aren't set to Block there.</li></ol>
<h2>5. Re-test</h2>
<p>Cloudflare settings apply within seconds. Run the check again and confirm the AI search rows say <i>Reachable</i>.</p>`,
    sources: [['https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers', 'Cloudflare blog: Have it both ways (Sep 15, 2026)'], ['https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/', 'Cloudflare docs: Block AI Bots'], ['https://developers.cloudflare.com/ai-crawl-control/', 'Cloudflare docs: AI Crawl Control']]
  },
  {
    slug: 'cloudfront', name: 'CloudFront / AWS WAF', title: 'CloudFront or AWS WAF is blocking AI crawlers: how to fix it',
    desc: "AWS WAF Bot Control's CategoryAI rule blocks verified AI crawlers too. Here is how to keep blocking AI training while letting AI search crawlers in.",
    body: `
<p class="lead l">If your report says CloudFront is answering with 403s to AI crawlers, the usual cause is the <b>AWS WAF Bot Control</b> managed rule group on the web ACL attached to your distribution.</p>
<div class="callout"><b>Why it happens.</b> Most Bot Control category rules only block <i>unverified</i> bots. <code>CategoryAI</code> is different: AWS documents that it “applies the action to all matches, regardless of whether the bots are verified or unverified.” So OAI-SearchBot and PerplexityBot get blocked along with training crawlers.</div>
<h2>1. Find the rule</h2>
<ol><li>Open <b>AWS WAF → Web ACLs</b> (or protection packs), and pick the one associated with your CloudFront distribution.</li>
<li>Find the managed rule group <code>AWSManagedRulesBotControlRuleSet</code>.</li>
<li>In <b>Sampled requests</b> or your WAF logs, look for matches on <code>CategoryAI</code> with the label <code>awswaf:managed:aws:bot-control:bot:category:ai</code>.</li></ol>
<h2>2. Switch CategoryAI to Count</h2>
<p>Edit the rule group and set a <b>rule action override</b> for <code>CategoryAI</code> to <i>Count</i>. Requests still get labeled, but nothing is blocked by this rule.</p>
<h2>3. Re-add the block you actually want</h2>
<p>Add your own rule <b>after</b> the Bot Control group that matches the label <code>awswaf:managed:aws:bot-control:bot:category:ai</code>, and exclude the crawlers you want to allow. Use the bot name labels that appear in your logs (<code>awswaf:managed:aws:bot-control:bot:name:…</code>) for OAI-SearchBot, PerplexityBot, Claude-SearchBot and the other search agents. Training crawlers such as GPTBot and ClaudeBot stay blocked.</p>
<p>If you'd rather not maintain a WAF rule, leave CategoryAI on Count and opt out of training with robots.txt instead:</p>
<pre>User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /</pre>
<h2>4. Watch the other signals</h2>
<p><code>SignalKnownBotDataCenter</code> and <code>SignalNonBrowserUserAgent</code> only act on requests that aren't from verified bots. If real crawlers are getting through but our data-center test still shows a block, the report marks it as lower confidence for that reason.</p>
<h2>5. Re-test</h2>
<p>WAF changes take effect within a minute or so. Run the check again.</p>`,
    sources: [['https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-bot.html', 'AWS WAF docs: Bot Control rule group']]
  },
  {
    slug: 'wordpress', name: 'WordPress', title: 'WordPress site invisible to ChatGPT or Perplexity? Five places to check',
    desc: 'A WordPress setting, an SEO plugin, a security plugin or your host can each block AI crawlers. How to find which one, and fix it without allowing AI training.',
    body: `
<p class="lead l">On WordPress, an AI crawler can be shut out at five different layers. Work down this list; the report tells you whether the block is in robots.txt or in a live request.</p>
<h2>1. “Discourage search engines from indexing this site”</h2>
<p>In <b>Settings → Reading</b>, this checkbox asks search engines not to index the site. Staging sites often go live with it still on. Untick it if the report shows <i>noindex</i>.</p>
<h2>2. Your SEO plugin's robots.txt editor</h2>
<p>WordPress serves a virtual robots.txt, and SEO plugins such as Yoast SEO and Rank Math let you edit it from the dashboard. If the report says robots.txt disallows an AI search crawler, look there first, or check for a physical <code>robots.txt</code> file in your web root, which overrides the virtual one.</p>
<p>To opt out of training but stay in AI search, keep the training crawlers blocked and the search crawlers allowed:</p>
<pre>User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: OAI-SearchBot
User-agent: PerplexityBot
User-agent: Claude-SearchBot
Allow: /</pre>
<h2>3. Security plugins</h2>
<p>Wordfence, Sucuri, All-In-One Security and similar plugins can block by user agent, rate-limit crawlers, or block “fake” bots. If the live request is blocked but robots.txt allows it, check their blocklists and bot rules for AI user agents.</p>
<h2>4. “Block AI” plugins</h2>
<p>Some plugins add every AI agent to robots.txt or block them outright, without separating search from training. If you use one, check whether it lets you allow search crawlers separately.</p>
<h2>5. Your host or CDN</h2>
<p>Managed WordPress hosts often run their own bot protection, and many sites sit behind Cloudflare. If the report says the request was answered by a CDN, follow the <a href="/en/guides/cloudflare/">Cloudflare guide</a>, or ask your host whether they block AI user agents at the edge.</p>`,
    sources: [['https://developers.google.com/search/docs/crawling-indexing/robots/intro', 'Google: Introduction to robots.txt']]
  },
  {
    slug: 'shopify', name: 'Shopify', title: 'Shopify and AI crawlers: robots.txt.liquid and what you can control',
    desc: "How to change which AI crawlers can access a Shopify store with robots.txt.liquid, keep product pages in AI search, and what to do when the block isn't yours.",
    body: `
<p class="lead l">Shopify gives you two layers of control over AI crawlers: the robots.txt file, which you can customize, and the network layer, which Shopify manages for you.</p>
<div class="callout"><b>Selling through ChatGPT or Copilot?</b> Shopify syndicates product data to agentic storefronts through Shopify Catalog, independently of robots.txt. Blocking crawlers affects only open-web discoverability, not those channels.</div>
<h2>1. Customize robots.txt with robots.txt.liquid</h2>
<ol><li>From your Shopify admin, go to <b>Online Store</b>.</li>
<li>For your published theme, click <b>⋯ → Edit code</b>.</li>
<li>Click <b>Add a new template</b>, select <b>robots</b>, then <b>Create template</b>. This creates <code>robots.txt.liquid</code> containing Shopify's default rules.</li>
<li>Add your own rule groups and keep the default ones, then save.</li></ol>
<p>Shopify recommends adding directives with Liquid rather than replacing the template with plain text, so its default rules keep updating. A plain-text example of groups to add, which opts out of training while keeping AI search:</p>
<pre>User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /</pre>
<p>Shopify treats this as an unsupported customization: its support team can't help with edits, and it warns that incorrect use can result in loss of all traffic. Re-test after every change.</p>
<h2>2. When the live request is blocked</h2>
<p>Shopify handles bot management at the network layer for every store, and it doesn't recommend or support a proxy such as Cloudflare in front of Shopify. If robots.txt allows a crawler but our live request is blocked, remove any proxy you added, check apps that add bot protection or geo-blocking, and if it persists, raise it with Shopify using the report link.</p>
<h2>3. Make product pages readable</h2>
<p>Most AI crawlers don't run JavaScript. If the report shows little text without JavaScript, check that product titles, prices and descriptions are in the theme's HTML rather than injected by apps after the page loads.</p>`,
    sources: [['https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt', 'Shopify Help: Editing robots.txt.liquid']]
  }
];
const guideCards = GUIDES.map((g) => `<a class="bcard g" href="/en/guides/${g.slug}/"><div class="bt">${esc(g.name)}</div><p>${esc(g.desc)}</p></a>`).join('');
out.push(write('en/guides/index.html', page({
  path: '/en/guides/', active: 'guides',
  title: 'Fix guides: unblock AI search crawlers on Cloudflare, CloudFront, WordPress and Shopify · VAKSEL',
  desc: 'Step-by-step fixes for the platforms that most often block AI search crawlers, without giving up your AI training opt-out.',
  body: `<main class="wrap doc-head">${crumbs([['/en/', 'Home'], [null, 'Fix guides']])}
<h1>Fix guides</h1>
<p class="lead l">Stay in ChatGPT, Perplexity and Claude search while keeping your content out of AI training. Pick the layer your report points to.</p>
<div class="bgrid g2">${guideCards}</div>
<section class="sec tight">${checkBox('Not sure where the block is?', 'The report names the CDN that answered and links the right guide.')}</section>
</main>${CHECK_JS}`
})));
for (const g of GUIDES) {
  const ld = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: g.title, dateModified: UPDATED, author: { '@type': 'Organization', name: 'VAKSEL' } };
  out.push(write(`en/guides/${g.slug}/index.html`, page({
    path: `/en/guides/${g.slug}/`, active: 'guides', ld,
    title: g.title + ' · VAKSEL', desc: g.desc,
    body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], ['/en/guides/', 'Fix guides'], [null, g.name]])}
<h1>${esc(g.title)}</h1><p class="upd">Updated ${UPDATED}</p>
${g.body}
<h2>Sources</h2><ul class="src">${g.sources.map(([u, t]) => `<li><a href="${u}" rel="nofollow noopener" target="_blank">${esc(t)} ↗</a></li>`).join('')}</ul>
<div style="margin-top:28px">${checkBox('Re-test your site')}</div>
<p class="more">Other guides: ${GUIDES.filter((x) => x !== g).map((x) => `<a href="/en/guides/${x.slug}/">${esc(x.name)}</a>`).join(' · ')}</p>
</main>${CHECK_JS}`
  })));
}

/* ---------- 定价 ---------- */
const PLANS = [
  { id: 'free', name: 'Free', price: '$0', unit: '', tag: 'Available now', items: ['Unlimited one-off checks', 'robots.txt, firewall and page checks', 'Shareable report link', 'Fix guides for your CDN'], cta: '<a class="btn ghost" href="/en/">Run a check</a>' },
  { id: 'pro', name: 'Pro', price: '$19', unit: '/month', tag: 'Early access', hi: true, items: ['Up to 10 sites', 'Daily re-checks', 'Email alert when a crawler gets cut off', 'Re-tested before we alert, so no false alarms', 'Founding price locked for life'], cta: '<a class="btn" href="#join" data-plan="pro">Join early access</a>' },
  { id: 'agency', name: 'Agency', price: 'Let’s talk', unit: '', tag: 'Early access', items: ['Many client sites', 'Everything in Pro', 'Client reporting built with you', 'Pricing agreed with you'], cta: '<a class="btn ghost" href="/en/contact/">Contact us</a>' }
];
const FAQ = [
  ['What does monitoring check?', 'The same three layers as the free check (robots.txt, live requests as each AI search crawler with control groups, and page readability) on a daily schedule. You get an email when a result changes, for example when a CDN update starts blocking OAI-SearchBot.'],
  ['When does it launch?', 'Monitoring is in early access. Join the list and we will email you when your account is ready. You pay nothing until then.'],
  ['Why would my site start blocking AI crawlers by itself?', 'CDN defaults change (Cloudflare changed its AI bot controls on September 15, 2026), security plugins update their bot lists, and robots.txt gets edited during redesigns. None of these tell you.'],
  ['Do you test from the crawlers’ real IP addresses?', 'No one outside those companies can. We test from a data center with each crawler’s user agent and compare against a normal browser, Googlebot and an unknown bot. That tells a targeted AI block apart from a general bot-verification rule, and the report shows the confidence for each result.']
];
out.push(write('en/pricing/index.html', page({
  path: '/en/pricing/', active: 'pricing',
  title: 'Pricing: free AI crawler checks, monitoring from $19/month · VAKSEL',
  desc: 'Free one-off AI crawler access checks. Daily monitoring and alerts for up to 10 sites for $19/month. Agencies: contact us.',
  body: `<main class="wrap">
<header class="hero s"><h1>Know the day AI search <span class="grad">stops reaching you</span></h1>
<p class="lead">Checks are free. Monitoring re-tests every day and emails you when a robots.txt edit, a plugin or a CDN default cuts off an AI crawler.</p></header>
<div class="plans">${PLANS.map((p) => `<div class="plan${p.hi ? ' hi' : ''}"><div class="ptag">${p.tag}</div><h2 class="pn">${p.name}</h2><div class="pp">${p.price}<small>${p.unit}</small></div><ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>${p.cta}</div>`).join('')}</div>
<section class="sec"><div class="alert-wrap"><div class="atext"><h2>What an alert looks like</h2><p class="sub">One email when something changes, with the evidence and the fix. Nothing when it doesn't.</p></div>
<div class="mail" aria-label="Example alert email"><div class="mh"><img src="/en/brand/vaksel-favicon.svg" width="28" height="28" alt=""><div><b>VAKSEL alerts</b><span>to you@company.com</span></div><time>Today 07:02</time></div>
<div class="ms">OAI-SearchBot is now blocked on example.com</div>
<div class="mb"><p>Yesterday OAI-SearchBot got the same page a browser gets. This morning it got <code>403</code> from Cloudflare, while a browser and Googlebot still get <code>200</code>.</p>
<div class="mrow"><span>OAI-SearchBot</span><span class="tag t-ok">Reachable</span><span class="arr">→</span><span class="tag t-bad">Silent block</span></div>
<div class="mrow"><span>PerplexityBot</span><span class="tag t-ok">Reachable</span><span class="arr">→</span><span class="tag t-bad">Silent block</span></div>
<p><b>Likely cause:</b> Cloudflare's Search control was set to <i>Block</i>, or a WAF rule now matches these crawlers.</p><span class="mbtn">View report and fix</span></div></div></div></section>
<section class="sec" id="join"><div class="join card">
  <img class="vava" src="/en/brand/vava/vava3d-working-mini.webp" width="96" height="100" alt="" loading="lazy">
  <div class="jtext"><h2>Join early access</h2><p class="sub">Founding members keep the launch price for as long as they stay subscribed. No card needed today.</p>
  <form id="wl" class="wl" autocomplete="on">
    <input type="email" name="email" required placeholder="you@company.com" aria-label="Email" autocomplete="email">
    <select name="plan" aria-label="Plan"><option value="pro">Pro · up to 10 sites</option><option value="agency">Agency · client sites</option></select>
    <input name="site" placeholder="Main site (optional)" aria-label="Main site (optional)" autocapitalize="off" spellcheck="false">
    <label class="wlplug"><input type="checkbox" name="watch" value="1"> Start monitoring this site now, free during early access (we’ll email you a link to confirm)</label>
    <label class="wlplug"><input type="checkbox" name="plugin" value="1"> I’d install a plugin or Worker snippet to see real AI crawler visits</label>
    <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <button class="btn">Join the list</button>
  </form><p class="wlmsg" id="wlmsg" role="status"></p></div>
</div></section>
<section class="sec tight"><h2>Questions</h2><div class="faq">${FAQ.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
</main>
<script>
{const q=new URLSearchParams(location.search),st=q.get('site'),pl=q.get('plan');if(st){document.querySelector('#wl [name=site]').value=st;document.querySelector('#wl [name=watch]').checked=true}if(pl==='agency'||pl==='pro')document.querySelector('#wl [name=plan]').value=pl}
document.querySelectorAll('[data-plan]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#wl [name=plan]').value=a.dataset.plan}));
const wl=document.getElementById('wl'),msg=document.getElementById('wlmsg');
wl.addEventListener('submit',async e=>{e.preventDefault();const b=wl.querySelector('button');b.disabled=true;msg.textContent='';
  const fd=Object.fromEntries(new FormData(wl));
  try{const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fd)});const j=await r.json();
    if(r.ok&&j.ok){wl.hidden=true;msg.className='wlmsg ok';msg.textContent=j.watch&&j.watch.ok?(j.watch.already?'You’re on the list, and '+fd.site+' is already being monitored.':'You’re on the list. To start monitoring '+fd.site+', click the link we just sent to '+fd.email+'.'):j.watch&&j.watch.error==='limit'?'You’re on the list. Early access monitors up to 3 sites per email, so we didn’t add this one.':'You’re on the list. We’ll email '+fd.email+' when your account is ready.'}
    else{msg.className='wlmsg bad';msg.textContent=j.error==='bad_email'?'That email doesn’t look right.':j.error==='rate_limited'?'Too many tries. Please wait a minute.':'Something went wrong. Please try again.';b.disabled=false}
  }catch{msg.className='wlmsg bad';msg.textContent='Network error. Please try again.';b.disabled=false}
});
</script>`
})));

/* ---------- 404 ---------- */
out.push(write('en/404.html', page({
  path: '/en/404', title: 'Page not found · VAKSEL', desc: 'This page does not exist.', index: false,
  body: `<main class="wrap nf"><img src="/en/brand/vava/vava3d-searching-mini.webp" width="160" height="202" alt="Vava the fox searching">
<h1>We looked everywhere</h1><p class="lead">This page doesn't exist, or it moved. Try the access check, or one of these.</p>
<form class="field" data-check autocomplete="off"><input placeholder="yourdomain.com" aria-label="Domain" spellcheck="false" autocapitalize="off"><button class="btn">Check access</button></form>
<p class="hint"><a href="/en/guides/">Fix guides</a> · <a href="/en/bots/">AI crawler directory</a> · <a href="/en/pricing/">Pricing</a></p></main>${CHECK_JS}`
})));

/* ---------- 首页 ---------- */
const FIXT = JSON.parse(readFileSync(join(root, 'data/demo-toyota.json'), 'utf8'));
const demo = renderReport(FIXT, { base: '/en', when: '2026-11-02T18:38:00Z', url: SITE + '/report/toyota.com' });
const EXAMPLES = [
  ['toyota.com', 'Silent block', 'v-bad', 'CloudFront rejects OAI-SearchBot and three user-triggered crawlers that robots.txt allows. A browser and Googlebot get through.'],
  ['smithsonianmag.com', 'All blocked', 'v-bad', 'Cloudflare turns away all 6 AI search and user-triggered crawlers we sent.'],
  ['torontosun.com', 'Silent block', 'v-bad', 'OpenAI and Perplexity crawlers get a 403 while robots.txt lets them in. Claude’s get through.']
];
const HOME_FAQ = [
  ['Isn’t robots.txt enough?', 'robots.txt is only a request. Your CDN, firewall or a security plugin decides what actually gets through, and it can reject a crawler that robots.txt welcomes. That is the silent block we test for.'],
  ['Will allowing AI search let my content be used for training?', 'No. OpenAI and Anthropic use separate crawlers for search and training, and Apple and Google give training its own robots.txt name (Applebot-Extended, Google-Extended). Perplexity says PerplexityBot isn’t used to train models. So you can allow OAI-SearchBot and block GPTBot, for example. Our guides show how on each platform.'],
  ['How accurate is a test from a data center?', 'Real crawlers come from their own IP ranges, which we can’t use. So every test runs with control groups (a normal browser, Googlebot and an unknown bot) and each result carries a confidence level.']
];
const TB = FIXT.access.bots.filter((b) => !b.region);
const labOk = LAB.results.filter((r) => r.ok).length;
const MARK = (n, cls = '') => readFileSync(join(root, `data/marks/${n}.svg`), 'utf8').replace('<svg ', `<svg class="mk ${cls}" aria-hidden="true" fill="currentColor" `).replace(/<title>.*?<\/title>/, '');
const VEND = { OpenAI: 'openai', Anthropic: 'anthropic', Perplexity: 'perplexity' };
const ROLE = { search: 'Search', user: 'User', training: 'Training' };
const DOES = {
  'OAI-SearchBot': 'Indexes pages for ChatGPT search results.',
  'ChatGPT-User': 'Fetches a page when a ChatGPT user asks about it.',
  'PerplexityBot': 'Indexes pages for Perplexity answers.',
  'Perplexity-User': 'Fetches a page during a Perplexity question.',
  'Claude-SearchBot': 'Indexes pages for Claude’s web search.',
  'Claude-User': 'Fetches a page when a Claude user asks.',
  'GPTBot': 'Collects pages to train OpenAI models.',
  'ClaudeBot': 'Collects pages to train Anthropic models.'
};
const RB = { allow: ['allow', 'ok'], partial: ['partial', 'mid'], blocked: ['disallow', 'bad'] };
const agentCard = (b, live) => {
  const r = RB[b.robots] || ['—', 'mid'];
  const st = live ? `<span class="st ${b.effective === 'open' ? 'ok' : 'no'}">${b.status}</span>` : '<span class="st q">queued</span>';
  return `<div class="ag${live && b.silent ? ' sil' : ''}"><div class="agh">${MARK(VEND[b.vendor])}<div><b>${esc(b.token)}</b><span>${esc(b.vendor)}</span></div><em>${ROLE[b.category]}</em></div><p>${esc(DOES[b.token] || '')}</p><div class="agf"><span class="rb ${r[1]}">robots: ${r[0]}</span>${st}</div></div>`;
};
const AGENTS_Q = TB.map((b) => agentCard(b, false)).join('');
const AGENTS_L = TB.map((b) => agentCard(b, true)).join('');
const silentN = TB.filter((b) => b.silent).length;
const LOG = (n) => {
  const L = [['exec', 'fetch robots.txt', '200 · 1 redirect'], ['exec', 'probe 8 AI agents', '7 × 403 · 1 × 200'], ['exec', 'control: browser, Googlebot, unknown bot', '3 × 200'], ['detect', 'CDN', 'CloudFront'], ['match', 'fix guide', 'CloudFront / AWS WAF']];
  return `<div class="log"><p class="lh">Process</p>${L.map(([k, a, r], i) => `<div class="ll${i < n ? ' done' : i === n ? ' run' : ''}"><i></i><code>${k}</code><span>${a}</span>${i < n ? `<small>${r}</small>` : ''}</div>`).join('')}</div>`;
};
const LABCAT = (slug) => slug.startsWith('robots-') || slug === 'baseline' ? 0 : slug.startsWith('fw-') ? 1 : /noindex|nosnippet/.test(slug) ? 2 : 3;
const ROBOTS_ONLY_WRONG = new Set(['robots-503', 'fw-ai-403', 'fw-verify-bots', 'fw-unknown-bots', 'fw-ai-challenge', 'fw-ai-thin', 'meta-noindex', 'header-noindex']);
const LABROWS = ['Robots.txt rules', 'Firewall and CDN', 'Page directives', 'Rendering and markup'].map((n, c) => {
  const rs = LAB.results.filter((r) => LABCAT(r.slug) === c);
  const pct = (k) => Math.round((k / rs.length) * 100);
  return [n, rs.length, pct(rs.filter((r) => r.ok).length), pct(rs.filter((r) => !ROBOTS_ONLY_WRONG.has(r.slug)).length)];
});
const LABRO = LAB.results.filter((r) => !ROBOTS_ONLY_WRONG.has(r.slug)).length;
const DEMO = JSON.parse(readFileSync(new URL('../data/demo-toyota.json', import.meta.url), 'utf8'));
const FIXT_DATE = new Date(DEMO.checked_on + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const FIXT_LONG = new Date(DEMO.checked_on + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const SAMPLE = [
  ['toyota.com', 'Silent block', 'CloudFront', 'CloudFront rejects OAI-SearchBot and three user-triggered crawlers that robots.txt allows. A browser and Googlebot get through.'],
  ['smithsonianmag.com', 'All blocked', 'Cloudflare', 'Cloudflare turns away all 6 AI search and user-triggered crawlers we sent.'],
  ['torontosun.com', 'Silent block', 'istio-envoy', 'OpenAI and Perplexity crawlers get a 403 while robots.txt lets them in. Claude’s get through.']
];
const homeBody = `<header class="hero"><div class="hbg" aria-hidden="true"><div class="sl on" style="background-image:url(/en/img/hero-1.webp)"><video muted playsinline disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" preload="auto" tabindex="-1" data-src="/en/img/hero-1.mp4"></video></div><div class="sl" style="background-image:url(/en/img/hero-2.webp)"><video muted playsinline disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" preload="none" tabindex="-1" data-src="/en/img/hero-2.mp4"></video></div><div class="sl" style="background-image:url(/en/img/hero-3.webp)"><video muted playsinline disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" preload="none" tabindex="-1" data-src="/en/img/hero-3.mp4"></video></div><div class="sl" style="background-image:url(/en/img/hero-4.webp)"><video muted playsinline disablepictureinpicture disableremoteplayback x-webkit-airplay="deny" preload="none" tabindex="-1" data-src="/en/img/hero-4.mp4"></video></div></div>
<div class="reti" id="rt" style="left:63%;top:29%" aria-hidden="true"><i></i></div>
<div class="wrap hin"><div class="hcopy">
  <h1>See what AI search actually gets from your site.</h1>
  <p class="lead">Your robots.txt may say yes while your firewall says no. VAKSEL requests your page as ChatGPT, Perplexity and Claude, checks it against a browser and Googlebot, and shows what each one got back.</p>
  <form class="field hf" id="f" autocomplete="off" role="search">
    <input id="d" name="d" placeholder="yourdomain.com" inputmode="url" autocapitalize="off" spellcheck="false" aria-label="Your domain">
    <button class="go" type="submit" aria-label="Check access"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  </form>
  <p class="hint">Try <button type="button" data-d="toyota.com">toyota.com</button><button type="button" data-d="github.com">github.com</button><button type="button" data-d="shopify.com">shopify.com</button><span>Free, no sign-up</span></p>
</div></div>
<div class="icard" id="rc" style="left:57%;top:37%" aria-live="off">
  <p class="ik">toyota.com · CloudFront</p>
  <h3>Silent block</h3>
  <p class="ix">robots.txt lets OAI-SearchBot in. The firewall answers 403.</p>
  <span class="ichip"><i></i>Googlebot · 200</span>
</div>
<div class="hdots" id="hd" aria-hidden="true"><b class="on"></b><b></b><b></b><b></b></div>
</header>

<section class="strip" aria-label="Crawlers we test"><div class="wrap">
  <p class="kick c">We test the crawlers behind</p>
  <div class="marq"><div class="mtrack">${(() => { const one = [['openai', 'OpenAI'], ['anthropic', 'Anthropic'], ['google', 'Google'], ['microsoft', 'Microsoft'], ['apple', 'Apple'], ['meta', 'Meta'], ['amazon', 'Amazon'], ['perplexity', 'Perplexity'], ['duckduckgo', 'DuckDuckGo'], ['mistralai', 'Mistral AI'], ['', 'You.com'], ['', 'Common Crawl'], ['yandex', 'Yandex'], ['naver', 'Naver']].map(([k, n]) => `<span>${k ? MARK(k) : ''}${n}</span>`).join(''); return `<div class="mset">${one}</div><div class="mset" aria-hidden="true">${one}</div>`; })()}</div></div>
</div></section>

<section class="prod gridbg" id="checks"><div class="wrap pgrid">
  <div class="pl">
    <div class="phead"><p class="kick">Product</p><h2>AI crawler access, tested for real.</h2><p class="sub">Most checkers read robots.txt and stop. VAKSEL sends live requests through your CDN and firewall, with control groups, and tells you which layer said no.</p></div>
    <div class="step cur" data-s="0"><div class="num">01</div><h3>Enter your domain</h3><p>One field, no sign-up. We read robots.txt for 20+ AI agents and keep search, user-triggered and training crawlers apart.</p><p class="tags"><span>Domain</span><span>Agents</span><span>robots.txt</span></p><div class="pm"></div></div>
    <div class="step" data-s="1"><div class="num">02</div><h3>We request as each crawler</h3><p>Live requests as OAI-SearchBot, PerplexityBot, Claude-SearchBot and the rest, next to a normal browser and Googlebot, so a bot check isn’t mistaken for a block.</p><p class="tags"><span>Firewall</span><span>CDN</span><span>Control groups</span></p><div class="pm"></div></div>
    <div class="step" data-s="2"><div class="num">03</div><h3>Fix it, then keep watching</h3><p>Each finding names the layer that rejected the crawler and links the guide for your platform. Turn on monitoring and we email you when a rule change cuts one off.</p><p class="tags"><span>Fix guide</span><span>Re-checks</span><span>Alerts</span></p><div class="pm"></div></div>
  </div>
  <div class="pr"><div class="app tk">
    <div class="abar"><i></i><i></i><i></i><span class="aurl">vaksel.com/report/toyota.com</span></div>
    <div class="pane on" data-p="0"><div class="pbody">${LOG(0)}<div class="pmain">
      <div class="phd"><span>New check</span><small>8 agents · 3 controls</small></div>
      <div class="pin"><span class="mono">https://</span><b>toyota.com</b><em>Check access</em></div>
      <div class="ags">${AGENTS_Q}</div></div></div></div>
    <div class="pane" data-p="1"><div class="pbody">${LOG(3)}<div class="pmain">
      <div class="phd"><span>toyota.com · served by CloudFront</span><small>${silentN} silent blocks</small></div>
      <div class="ctrl"><span><i></i>Browser<b>200</b></span><span><i></i>Googlebot<b>200</b></span><span><i></i>Unknown bot<b>200</b></span></div>
      <div class="ags">${AGENTS_L}</div></div></div></div>
    <div class="pane" data-p="2"><div class="pbody">${LOG(5)}<div class="pmain">
      <div class="phd"><span>Fix · CloudFront / AWS WAF</span><small>Guide</small></div>
      <div class="fix tk"><p class="fk">AWS WAF · Bot Control rule group</p><ol><li><span>Category</span><code>AI</code></li><li><span>OAI-SearchBot</span><code>Block</code><b>→ Allow</b></li><li><span>ChatGPT-User</span><code>Block</code><b>→ Allow</b></li><li><span>PerplexityBot</span><code>Block</code><b>→ Allow</b></li><li><span>GPTBot</span><code>Block</code><em>keep</em></li></ol></div>
      <div class="mail tk"><div class="mh"><img src="/en/brand/vaksel-favicon.svg" alt="" width="22" height="22"><div><b>VAKSEL alerts</b><span>Sample alert</span></div></div><p class="ms">OAI-SearchBot can no longer reach example.com</p><p class="mb">Re-checked twice, 15 minutes apart: <code>200 → 403</code> at the firewall. robots.txt unchanged.</p></div>
    </div></div></div>
  </div></div>
</div></section>

<section class="sec eval" id="data"><div class="wrap">
  <p class="kick">Evaluation</p><h2>Checked against sites with known answers.</h2>
  <div class="ecards">
    <div class="ec"><a class="evf" href="/en/img/fig-lab.webp" target="_blank" rel="noopener"><img src="/en/img/fig-lab-card.webp" width="1200" height="750" alt="Access verdict accuracy on 20 lab sites: VAKSEL compared with a robots.txt-only reading, by configuration type" loading="lazy" decoding="async"></a>
      <h3>${labOk} of ${LAB.results.length} lab verdicts right</h3><p>Sites we configured ourselves, re-run whenever the rules change. Reading robots.txt alone gets ${LABRO} of ${LAB.results.length} right; the misses are mostly firewall and CDN blocks.</p><a href="/en/research/lab/">See the lab →</a></div>
    <div class="ec"><a class="evf" href="/en/img/fig-toyota.webp" target="_blank" rel="noopener"><img src="/en/img/fig-toyota-card.webp" width="1200" height="750" alt="toyota.com: crawlers robots.txt allows compared with crawlers actually served, by group" loading="lazy" decoding="async"></a>
      <h3>Control groups on every check</h3><p>A data-center IP isn’t a crawler’s real IP. So each result is compared with a browser, Googlebot and an unknown bot, and carries a confidence level.</p><a href="/en/research/grading/">How grading works →</a></div>
    <div class="ec"><a class="evf" href="/en/img/fig-sample.webp" target="_blank" rel="noopener"><img src="/en/img/fig-sample-card.webp" width="1200" height="750" alt="Sample funnel: 600 Tranco domains, 362 reachable, 45 rejected an AI search user agent, 13 aimed at AI" loading="lazy" decoding="async"></a>
      <h3>Measured on real sites</h3><p>13 of 362 reachable sites silently block AI search crawlers while robots.txt allows them and Googlebot gets through.</p><a href="/en/research/">Read the study →</a></div>
  </div>
</div></section>

<section class="sec rep" aria-label="Example report"><div class="wrap rgrid">
  <div>
    <p class="kick">From check to report</p><h2>A clear verdict.<br>Evidence for every line.<br>One report to share.</h2>
    <p class="sub">Every check ends in a report you can send to your CDN team or a client: what each crawler got back, which layer decided it, and how to fix it.</p>
    <ul class="ticks"><li>Verdict for each AI agent</li><li>The layer that blocked it</li><li>Status codes from live requests</li><li>A fix guide for your platform</li></ul>
    <a class="more" href="/en/report/toyota.com">Open a real report <span>→</span></a>
  </div>
  <div class="rstage"><div class="rsh" aria-hidden="true"></div><div class="rcard"><div class="rscroll" tabindex="0" aria-label="Example report, scroll to read">
    <img src="/en/img/report-cover.webp" width="1448" height="1086" alt="Cover of a VAKSEL AI crawler access report for toyota.com, ${FIXT_LONG}">
    <img src="/en/img/report-p2.webp" width="1448" height="3016" alt="Report pages: verdict silent block, results for 8 AI agents, blocking layer CloudFront, AWS WAF fix guide" loading="lazy" decoding="async">
  </div></div></div>
</div></section>

<section class="sec found gridbg"><div class="wrap">
  <p class="lab">Found in our sample</p><p class="lsub">Sites where robots.txt and the firewall disagree. Each card runs a fresh check.</p>
  <div class="qcards">${SAMPLE.map(([d, t, cdn, w], i) => `<a class="qc tk${i === 1 ? ' g2' : ''}" href="/en/report/${d}"><div class="qh"><b>${d}</b><span>${t}</span></div><p>${w}</p><div class="qf"><span>${cdn}</span><span>Nov 1, 2026</span></div></a>`).join('')}</div>
  <p class="lab" style="margin-top:56px">Fix guides</p><p class="lsub">Fix it where the block is.</p>
  <div class="qcards g4">${GUIDES.map((g, i) => `<a class="qc tk gd${i === 2 ? ' g2' : ''}" href="/en/guides/${g.slug}/"><div class="gmk">${MARK({ cloudfront: 'amazonwebservices' }[g.slug] || g.slug)}</div><div class="qh"><b>${esc(g.name)}</b><span>Guide</span></div><p>${esc(g.desc.split('. ')[0].replace(/\.$/, ''))}.</p><div class="qf"><span>Read the guide →</span></div></a>`).join('')}</div>
</div></section>

<section class="sec tight faqs"><div class="wrap fqg"><div><p class="kick">FAQ</p><h2>Questions</h2><p class="sub">How the check works, and what it can’t see.</p></div><div class="faq">${HOME_FAQ.map(([q, a], i) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>

<section class="final" id="monitor"><div class="wrap">
  <h2>See what AI crawlers really get.</h2>
  <p>Check in seconds. Monitoring emails you when a CDN, plugin or robots.txt change cuts one off.</p>
  <div class="fbox">
    <span class="fl a">${MARK('openai')}<b>OAI-SearchBot</b><em>403 · CloudFront</em></span>
    <span class="fl b"><i class="dot"></i><b>robots.txt</b><em>allows AI search</em></span>
    <span class="fl c">${MARK('google')}<b>Googlebot</b><em>control · 200</em></span>
    <span class="fl d"><i class="dot"></i><b>Monitoring</b><em>re-checked daily</em></span>
    <form class="field ff" id="f2" autocomplete="off" role="search"><input id="d2" placeholder="Is ChatGPT blocked on my site?" aria-label="Your domain" inputmode="url" autocapitalize="off" spellcheck="false"><button class="wb" type="submit">Check access <span>›</span></button></form>
  </div>
  <p class="hint c"><a href="/en/pricing/">See monitoring plans →</a></p>
</div></section>

<form class="dock" id="dock" autocomplete="off" role="search" aria-hidden="true"><input id="d3" placeholder="yourdomain.com" aria-label="Your domain" inputmode="url" autocapitalize="off" spellcheck="false" tabindex="-1"><button class="wb" type="submit" tabindex="-1">Check access <span>›</span></button></form>

<script>
const f=document.getElementById('f'),d=document.getElementById('d');
function clean(v){v=(v||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0].replace(/\\.$/,'');return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v)?v:null}
function go(v,fm,inp){const c=clean(v);fm=fm||f;inp=inp||d;if(!c){fm.classList.remove('shake');void fm.offsetWidth;fm.classList.add('shake');inp.focus();return}location.href='/en/report/'+c}
[['f','d'],['f2','d2'],['dock','d3']].forEach(([a,b])=>{const fm=document.getElementById(a),i=document.getElementById(b);fm.addEventListener('submit',e=>{e.preventDefault();go(i.value,fm,i)})});
document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>go(b.dataset.d));
(()=>{document.querySelectorAll('.gridbg,.final,.eval').forEach((s,j)=>{for(let i=0;i<7;i++){const p=document.createElement('i');p.className='px';p.style.left=((i*37+j*23)%97)+'%';p.style.top=((i*53+j*31)%89+5)+'%';p.style.animationDelay=(i*.9+j*.4)+'s';s.appendChild(p)}});
const panes=[...document.querySelectorAll('.app .pane')],steps=[...document.querySelectorAll('.step')];
steps.forEach((s,i)=>{const c=panes[i].cloneNode(true);c.classList.add('on');s.querySelector('.pm').appendChild(c)});
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const k=+e.target.dataset.s;panes.forEach((p,i)=>p.classList.toggle('on',i===k));steps.forEach((s,i)=>s.classList.toggle('cur',i===k))}}),{rootMargin:'-45% 0px -45% 0px'});
steps.forEach(s=>io.observe(s));
const dock=document.getElementById('dock'),hero=document.querySelector('.hero'),fin=document.querySelector('.final');let hv=true,fv=false;
const sync=()=>{const on=!hv&&!fv;dock.classList.toggle('show',on);dock.setAttribute('aria-hidden',on?'false':'true');dock.querySelectorAll('input,button').forEach(x=>x.tabIndex=on?0:-1)};
new IntersectionObserver(([e])=>{hv=e.isIntersecting;sync()}).observe(hero);
const vis=new Map();const io=new IntersectionObserver(es=>{es.forEach(e=>vis.set(e.target,e.isIntersecting));fv=[...vis.values()].some(Boolean);sync()});[fin,document.querySelector('footer')].forEach(x=>x&&io.observe(x))})();
(()=>{const S=[
 ['toyota.com · CloudFront','Silent block','robots.txt lets OAI-SearchBot in. The firewall answers 403.','Googlebot · 200',0,[63,29],[57,37]],
 ['smithsonianmag.com · Cloudflare','All blocked','Cloudflare turns away all 6 AI search and user-triggered crawlers we sent.','6 of 6 rejected',0,[84,40],[66,48]],
 ['torontosun.com · istio-envoy','Silent block','OpenAI and Perplexity crawlers get a 403. Claude’s get through.','Claude-SearchBot · 200',0,[64,46],[58,54]],
 ['shopify.com · Cloudflare','Open','Every AI crawler we sent got the page, same as Googlebot.','8 of 8 got in',1,[76,64],[60,34]]];
const L=[...document.querySelectorAll('.hbg .sl')];const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(IOS)L.forEach(l=>{const v=l.querySelector('video'),i=document.createElement('img');i.alt='';i.dataset.src=v.dataset.src;i.decoding='async';i.play=()=>Promise.resolve();l.replaceChild(i,v)});const V=L.map(l=>l.querySelector('video,img'));V.forEach(v=>{v.addEventListener(IOS?'load':'playing',()=>v.classList.add('pl'));if(!IOS)v.addEventListener('webkitbeginfullscreen',()=>{try{v.webkitExitFullscreen()}catch(e){}V.forEach(x=>{x.pause&&x.pause();x.classList.remove('pl');x.removeAttribute('src')})})}),rc=document.getElementById('rc'),rt=document.getElementById('rt'),dots=document.querySelectorAll('#hd b');let k=0;
const wide=matchMedia('(min-width:861px)').matches;
const place=()=>{const s=S[k];if(wide){rt.style.left=s[5][0]+'%';rt.style.top=s[5][1]+'%';rc.style.left=s[6][0]+'%';rc.style.top=s[6][1]+'%'}};place();
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const play=!(navigator.connection&&navigator.connection.saveData);
const load=v=>{if(play&&!v.getAttribute('src')){v.src=v.dataset.src;v.load&&v.load()}};
const card=()=>{const s=S[k];rc.classList.add('sw');rt.classList.add('sw');setTimeout(()=>{rc.querySelector('.ik').textContent=s[0];rc.querySelector('h3').textContent=s[1];rc.querySelector('.ix').textContent=s[2];rc.querySelector('.ichip').innerHTML='<i></i>'+s[3];rc.classList.toggle('good',!!s[4]);rt.classList.toggle('good',!!s[4]);place();dots.forEach((x,i)=>x.classList.toggle('on',i===k));rc.classList.remove('sw');rt.classList.remove('sw')},450)};
let t;const next=()=>{clearTimeout(t);L[k].classList.remove('on');k=(k+1)%S.length;const v=V[k];L[k].classList.add('on');card();load(V[(k+1)%V.length]);if(play&&!IOS){v.currentTime=0;v.play().catch(()=>{})}t=setTimeout(next,6000)};
if(play){load(V[0]);load(V[1]);V[0].play().catch(()=>{})}t=setTimeout(next,6000)})();
</script>`;
const homeLd = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'Organization', '@id': SITE + '/#org', name: 'VAKSEL', url: SITE + '/', logo: SITE + '/brand/icon-512.png' },
  { '@type': 'WebSite', '@id': SITE + '/#site', name: 'VAKSEL', url: SITE + '/', publisher: { '@id': SITE + '/#org' } },
  { '@type': 'WebApplication', name: 'VAKSEL', url: SITE + '/', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web', description: 'Checks whether AI search crawlers can reach a website through robots.txt, firewalls and CDNs.', publisher: { '@id': SITE + '/#org' }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }
] };
out.push(write('en/index.html', page({
  path: '/en/', title: 'Can AI search reach your site? Free AI crawler access check · VAKSEL',
  desc: 'Test whether ChatGPT, Perplexity and Claude search crawlers can actually reach your site: robots.txt, firewall and CDN blocks, noindex and JavaScript-only pages. Free, no sign-up.',
  body: homeBody, ld: homeLd, type: 'website', theme: 'dk'
})));


/* ---------- Grading method ---------- */
out.push(write('en/research/grading/index.html', page({
  path: '/en/research/grading/', title: 'How we grade: get in, read, cite · VAKSEL',
  desc: 'The rules behind VAKSEL’s three S/A/B/C grades: the basis for each check, the caps, what doesn’t count, and why there’s no overall score. Versioned.',
  body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], ['/en/research/', 'Research'], [null, 'How we grade']])}
<h1>How we grade</h1><p class="upd">Rules version ${GRADE_VERSION}</p>
<p class="lead l">Every report gets three grades: can AI crawlers get in, can they read the page, and can they cite it. Each is S, A, B or C. There’s no overall score.</p>
<h2>Why no overall score</h2>
<p>One number hides the problem that matters most. A site that turns every AI crawler away can still post a decent weighted average if its markup is tidy. So each layer is graded on its own: if crawlers can’t get in, nothing after that helps.</p>
<h2>Only facts you can verify</h2>
<ul><li>Every check is labelled by its basis: <b>Official docs</b> (a search engine or standard says so), <b>Common practice</b> (widely used, with public tests), or <b>Hypothesis</b> (no official statement).</li>
<li>Only official and common checks count. Hypotheses and notes are shown but never affect a grade.</li>
<li>llms.txt doesn’t count. Google says no special AI files or markup are needed to appear in its AI features.</li>
<li>Blocking training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot and the like) costs nothing. Blocking training while allowing search is a legitimate choice.</li></ul>
<h2>Can they get in</h2>
<table class="tbl tg"><thead><tr><th>Grade</th><th>When</th></tr></thead><tbody>
<tr><td><b>S</b></td><td>Every AI search crawler got in during the live test and received the same page as a browser</td></tr>
<tr><td><b>A</b></td><td>All got in, but some hit a challenge or a noticeably thinner page; or the live test didn’t finish and only robots.txt was checked (A at most)</td></tr>
<tr><td><b>B</b></td><td>Some AI search crawlers are blocked by robots.txt or the firewall</td></tr>
<tr><td><b>C</b></td><td>All are blocked; or a high- or medium-confidence silent block was found (robots.txt allows, the firewall rejects); or the homepage is noindex</td></tr>
</tbody></table>
<p>A robots.txt that returns 5xx or can’t be reached counts as C: under <a href="https://www.rfc-editor.org/rfc/rfc9309#section-2.3.1.4">RFC 9309 §2.3.1.4</a>, compliant crawlers must then assume everything is disallowed. A 404 or other 4xx means no restrictions and costs nothing.</p>
<p>The firewall test runs two controls: a request claiming to be Googlebot and one from an unknown bot. If the fake Googlebot is rejected too, the site is verifying crawler IP addresses and the real AI crawlers will likely get through, so we record low confidence and don’t grade it C. Our requests don’t come from the vendors’ own IP ranges, so a result means “likely”, not proof.</p>
<p><b>China search and AI engines</b> (Baidu, ByteDance, Huawei, Sogou, 360, Shenma, Kimi) are tested the same way but shown as a separate line, “x of y can get in”, and don’t affect the grade. Many sites outside China block them on purpose, and that shouldn’t read as a failure. Doubao and Tencent Yuanbao publish no crawler of their own, so we don’t list one.</p>
<h2>Can they read it</h2>
<table class="tbl tg"><thead><tr><th>Grade</th><th>When</th></tr></thead><tbody>
<tr><td><b>S</b></td><td>No official or common check needs work</td></tr>
<tr><td><b>A</b></td><td>One item needs work</td></tr>
<tr><td><b>B</b></td><td>Two or three items, or a non-critical problem such as several canonical tags</td></tr>
<tr><td><b>C</b></td><td>Indexing or snippets are blocked (noindex, nosnippet, max-snippet:0); the text can’t be read without JavaScript; or four or more items need work</td></tr>
</tbody></table>
<p>Checks: title, meta description, indexing and snippets, canonical URL, text without JavaScript, H1, sitemap, internal links, image alt text, hreflang, viewport. Google’s <a href="https://developers.google.com/search/docs/appearance/ai-features">AI features and your website</a> says pages must be indexed and eligible for a snippet to appear in AI Overviews.</p>
<h2>Can they cite it</h2>
<table class="tbl tg"><thead><tr><th>Grade</th><th>When</th></tr></thead><tbody>
<tr><td><b>S</b></td><td>All five signals: structured data, organization, site name, share card, semantic tags</td></tr>
<tr><td><b>A</b></td><td>Four</td></tr>
<tr><td><b>B</b></td><td>Two or three</td></tr>
<tr><td><b>C</b></td><td>One or none</td></tr>
</tbody></table>
<p>Caps: a JSON-LD parse error, or FAQPage markup whose questions aren’t on the page, holds this grade at B. Google’s <a href="https://developers.google.com/search/docs/appearance/structured-data/sd-policies">structured data guidelines</a> require marked-up content to be visible to users.</p>
<p>This layer measures the signals that help engines recognise you. It doesn’t promise citations. Whether AI answers actually mention you takes live queries, which the free check doesn’t run.</p>
<h2>Changelog</h2>
<ul><li><b>2026-11-02.2</b>: China search and AI engines (Baiduspider, Bytespider, PetalBot, Sogou, 360Spider, YisouSpider, Kimi) are tested and listed on their own and no longer count toward “Can they get in”. Before this, Bytespider and PetalBot counted. Kimi-SearchBot, Kimi-User, Sogou, 360Spider and YisouSpider join the live test.</li><li><b>2026-11-02.1</b>: first public version. Adds robots.txt 5xx as “disallow everything” and caps cite at B for FAQ markup that doesn’t match the page.</li></ul>
<p>Every rule change bumps the version, and each report says which version it used, so grades from different dates can be compared.</p>
<div style="margin-top:28px">${checkBox('Check your own site')}</div></main>${CHECK_JS}`
})));

/* ---------- 研究方法 ---------- */
out.push(write('en/research/index.html', page({
  path: '/en/research/', title: 'How often do firewalls silently block AI search crawlers? November 2026 sample · VAKSEL',
  desc: '362 reachable sites from a random 600 of the Tranco top 20k: 45 rejected AI search crawler user agents that robots.txt allowed; 13 did so in a way aimed at AI crawlers specifically. Method, definitions and limits.',
  body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], [null, 'Research']])}
<h1>How often do firewalls silently block AI search crawlers?</h1><p class="upd">Sample run November 1, 2026</p>
<p class="lead l">In a random sample of popular sites, about 1 in 28 reachable sites rejected AI search crawler user agents at the firewall in a way aimed at AI crawlers specifically, while robots.txt allowed them.</p>
<div class="facts"><div><span>Sampled</span><b>600 sites</b></div><div><span>Reachable</span><b>362</b></div><div><span>Rejected at least one AI search UA</span><b>45 (12.4%)</b></div><div><span>Aimed at AI crawlers</span><b>13 (3.6%)</b></div></div>
<h2>Sample</h2>
<p>600 domains drawn at random from the Tranco top-20,000 list. A site counted as <b>reachable</b> when a normal browser request to its homepage returned HTTP 200 from our server: 362 of 600. The other 238 were excluded because even the browser request didn't get a normal page: 125 failed to connect or timed out (many are CDN, ad or API domains with no public website), 80 returned 403/401/503 or a challenge, and 33 returned another status such as 404. For those, nothing can be said about crawlers specifically.</p>
<h2>Step 1: user-agent requests</h2>
<p>For each reachable site we fetched robots.txt and requested the homepage with the user agents of four AI search and user-triggered crawlers: OAI-SearchBot, ChatGPT-User, PerplexityBot and Claude-SearchBot. A request counted as <b>rejected</b> when it got a 4xx/5xx status or a challenge page while the browser request got 200.</p>
<p>45 sites (12.4% of reachable) rejected at least one of the four while their robots.txt allowed it. We call this a <b>silent block</b>: nothing in robots.txt warns the site owner. 26 of the 45 were served by Cloudflare.</p>
<h2>Step 2: control groups</h2>
<p>We re-tested the 45 the same day with two controls: a request using Googlebot's user agent, and a request from an unknown bot. This separates three different causes:</p>
<table class="tbl"><thead><tr><th>What the controls showed</th><th>Likely cause</th><th>Sites</th></tr></thead><tbody>
<tr><td>Googlebot user agent rejected too</td><td>The site verifies crawler IP addresses and rejects anyone claiming a crawler name from the wrong network. The real AI crawlers may well get through.</td><td>29</td></tr>
<tr><td>Unknown bot rejected, Googlebot allowed</td><td>A general bot rule</td><td>1</td></tr>
<tr><td>Not reproduced on re-test</td><td>Rate limiting or a transient rule</td><td>2</td></tr>
<tr><td>Browser, Googlebot and unknown bot allowed; AI search UA rejected</td><td>A rule aimed at AI crawlers</td><td><b>13</b></td></tr>
</tbody></table>
<p>The 13 are 3.6% of reachable sites, about 1 in 28. Examples include toyota.com, smithsonianmag.com and torontosun.com; 7 of the 13 were served by Cloudflare.</p>
<h2>Limits</h2>
<ul><li>All requests came from one data-center server. Real crawlers come from their operators' own IP ranges, which no outside tester can use. A rule that allows verified crawler IPs would let the real crawler through even when our request was rejected; the control groups exist to flag those cases, but can't rule them out completely.</li>
<li>We tested the homepage only. A site can treat other paths differently.</li>
<li>Rules change. A result describes the site on November 1, 2026; the links on our homepage run a fresh check.</li>
<li>600 is a small sample. Treat 12.4% and 3.6% as estimates with a margin of a few percentage points.</li></ul>
<h2>Asian sites</h2>
<p>We ran the same test on 1,000 popular Chinese-language sites. Silent blocks were rarer: 3.7% of reachable sites at step 1 and about 0.8% at step 2.</p>
<p class="more">How the report’s three grades work: <a href="/en/research/grading/">Grading method →</a></p>
<p class="more">Open test sites for checking any AI visibility tool: <a href="/en/research/lab/">VAKSEL Lab →</a></p>
<div style="margin-top:28px">${checkBox('Test your own site')}</div>
</main>${CHECK_JS}`
})));

/* ---------- 隐私 / 条款 / 联系 ---------- */
const legal = (path, title, desc, h1, html) => out.push(write(path.slice(1) + 'index.html', page({ path, title, desc, body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], [null, h1]])}<h1>${h1}</h1><p class="upd">Last updated ${UPDATED}</p>${html}</main>` })));
legal('/en/privacy/', 'Privacy policy · VAKSEL', 'What VAKSEL collects when you run a check or join the early-access list, and what it does not.', 'Privacy policy', `
<p class="lead l">We collect as little as we can. Running a check needs no account, sets no cookies and uses no analytics or ad trackers.</p>
<h2>When you check a domain</h2>
<ul><li>Our servers request public files from that domain: <code>robots.txt</code>, <code>llms.txt</code> and the homepage. Those requests come from us, not from your browser.</li>
<li>We don't store the domains you check or your IP address. Your IP address is used for a moment to rate-limit requests, then discarded.</li>
<li>Each result is cached for about five minutes, keyed by the domain, so repeat checks don't hit the site again. Share images for reports are cached for up to an hour.</li></ul>
<h2>When you join the early-access list or contact us</h2>
<ul><li>We store the email address, plan and site you enter, the message if you send one, and the country your request came from (as reported by our hosting provider). We don't store your IP address.</li>
<li>We use this only to tell you when your account is ready and to reply to you. We don't sell it or share it for marketing.</li>
<li>To have your details deleted, send a request through the <a href="/en/contact/">contact form</a> from the same email address. We delete it within 30 days.</li></ul>
<h2>When you turn on monitoring</h2>
<ul><li>We store your email address, the site you asked us to watch, your language, and a short summary of the latest re-test: the three grades and which AI crawlers were blocked. We don't store your IP address.</li>
<li>If you don't confirm, the request is deleted after two days.</li>
<li>Monitoring starts only after you click the link in the confirmation email. We use the email address only to send alerts about that site.</li>
<li>Every alert has a stop link. Stopping deletes the site, its summary and the link between them and your email straight away.</li>
<li>Re-tests run the same way as a normal check, including through our own server when needed.</li></ul>
<h2>Service providers</h2>
<p>The site runs on Cloudflare (hosting, caching and storage). Some checks are sent through our own server when a site blocks Cloudflare's network. Cloudflare processes requests under its <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener" target="_blank">privacy policy</a>. Confirmation and alert emails are sent through <a href="https://resend.com/legal/privacy-policy" rel="noopener" target="_blank">Resend</a>.</p>
<h2>Changes</h2>
<p>If this policy changes, we'll update the date at the top. If we start collecting something new, we'll say so here first.</p>`);
legal('/en/terms/', 'Terms of use · VAKSEL', 'The terms for using VAKSEL’s AI crawler access checks.', 'Terms of use', `
<h2>Using the checks</h2>
<ul><li>Check sites you own, manage, or have a legitimate reason to look at. Don't use VAKSEL to load-test, scan or attack a site.</li>
<li>Checks are rate-limited. Don't try to get around the limits with automation or multiple networks.</li></ul>
<h2>What the results mean</h2>
<p>Results are our best reading at the time of the check. We test from data-center IP addresses with each crawler's user agent, not from the crawlers' own networks, so a site that verifies crawler IP addresses may treat the real crawler differently. Each result shows a confidence level for this reason. Crawler descriptions follow each operator's public documentation as of the date shown.</p>
<h2>No warranty</h2>
<p>The service is provided “as is”, without warranties of any kind. We're not liable for decisions made from a report, or for any loss arising from use of the service, to the extent the law allows.</p>
<h2>Paid plans</h2>
<p>Monitoring plans are in early access. Joining the list doesn't commit you to pay. When paid plans open, their terms and prices will be shown before you subscribe.</p>
<h2>Changes and contact</h2>
<p>We may update these terms; the date at the top shows the latest version. Questions: use the <a href="/en/contact/">contact form</a>.</p>`);
out.push(write('en/contact/index.html', page({
  path: '/en/contact/', title: 'Contact · VAKSEL', desc: 'Questions, data requests or feedback for VAKSEL.',
  body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], [null, 'Contact']])}<h1>Contact us</h1>
<p class="lead l">Questions about a report, a data deletion request, or a crawler we should add. We reply by email.</p>
<form id="ct" class="ct">
  <label>Your email<input type="email" name="email" required autocomplete="email"></label>
  <label>Topic<select name="topic"><option value="question">Question about a report</option><option value="data">Delete my data</option><option value="feedback">Feedback or a crawler to add</option><option value="other">Something else</option></select></label>
  <label>Message<textarea name="message" required rows="6" maxlength="2000"></textarea></label>
  <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
  <button class="btn">Send</button>
</form><p class="wlmsg" id="ctmsg" role="status"></p></main>
<script>
const ct=document.getElementById('ct'),cm=document.getElementById('ctmsg');
ct.addEventListener('submit',async e=>{e.preventDefault();const b=ct.querySelector('button');b.disabled=true;cm.textContent='';
  try{const r=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(ct)))});const j=await r.json();
    if(r.ok&&j.ok){ct.hidden=true;cm.className='wlmsg ok';cm.textContent='Thanks. We’ll reply by email.'}
    else{cm.className='wlmsg bad';cm.textContent=j.error==='bad_email'?'That email doesn’t look right.':j.error==='rate_limited'?'Too many tries. Please wait a minute.':j.error==='empty'?'Please write a message.':'Something went wrong. Please try again.';b.disabled=false}
  }catch{cm.className='wlmsg bad';cm.textContent='Network error. Please try again.';b.disabled=false}});
</script>`
})));
write('en/site.webmanifest', JSON.stringify({ name: 'VAKSEL', short_name: 'VAKSEL', start_url: '/', display: 'browser', background_color: '#ffffff', theme_color: '#0C63F1', icons: [{ src: '/en/brand/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/en/brand/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');

/* ---------- sitemap ---------- */

/* ---------- Lab: public single-variable test sites ---------- */
{
  const byLab = Object.fromEntries(LAB.results.map((r) => [r.slug, r]));
  const g3 = (a) => a.map((x) => x || '–').join('/');
  const rows = FIXTURES.map((f) => { const r = byLab[f.slug] || {}; const d = f.slug + LAB_SUFFIX;
    return `<tr><td><a href="https://${d}/" rel="nofollow">${d}</a></td><td>${esc(f.en)}</td><td style="white-space:nowrap">${g3(f.expect)}${f.cn === 'all_blocked' ? '<br>China engines: blocked' : ''}</td><td style="white-space:nowrap">${r.got ? g3(r.got) + (r.ok ? ' ✓' : ' ✗') : '–'}</td><td><a href="/en/report/${d}">Report</a></td></tr>`; }).join('');
  const nOk = LAB.results.filter((r) => r.ok).length;
  out.push(write('en/research/lab/index.html', page({
    path: '/en/research/lab/', title: 'VAKSEL Lab: open test sites for AI visibility tools · VAKSEL',
    desc: 'Twenty public test sites, each changing one thing (a firewall 403, a robots.txt 503, a fake llms.txt, mismatched FAQ markup). Use them to check any AI visibility tool, ours included.',
    body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], ['/en/research/', 'Research'], [null, 'Lab']])}
<h1>VAKSEL Lab</h1><p class="upd">Last run ${new Date(LAB.run_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })} · rules ${LAB.rules}</p>
<p class="lead l">${FIXTURES.length} public test sites. Each one changes exactly one thing from the control, so you can see whether an AI visibility tool notices. Point any tool at them, ours included.</p>
<h2>How to use it</h2>
<ul><li>Run your tool on <b>baseline${LAB_SUFFIX}</b> first. It should come back clean.</li>
<li>Then run it on the others. Each row says what changed and what a correct tool should report.</li>
<li>The firewall sites decide by user agent, the way most real firewalls do. They answer the same way to every IP address.</li></ul>
<h2>The sites</h2>
<p>Grades are Get in / Read / Cite, as described in <a href="/en/research/grading/">How we grade</a>.</p>
<div class="tscroll" style="overflow-x:auto"><table class="tbl tg"><thead><tr><th>Site</th><th>What changes</th><th>Expected</th><th>VAKSEL</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
<p>VAKSEL matches ${nOk} of ${LAB.results.length} on the latest run.</p>
<h2>What it caught in our own engine</h2>
<p>Our first run, on the first 19 sites, matched 3. The lab found four bugs, now fixed:</p>
<ul><li>Huawei’s PetalBot wasn’t in our crawler list, so a site that blocked everyone in robots.txt was graded B instead of C. The same bug hid a robots.txt 503.</li>
<li>An X-Robots-Tag: noindex header was missed when we fetched through our fallback server.</li>
<li>When a site refused our direct request, its sitemap was reported missing, because the sitemap check had no fallback server.</li>
<li>A page that merely mentioned “Just a moment” was mistaken for a challenge page. We changed the test site; real challenge detection still uses page size.</li></ul>
<h2>Limits</h2>
<p>The sites simulate common setups. They don’t reproduce IP-based verification by real vendors, JavaScript challenges that need a browser, or rate limits. Expected grades follow our published rules; another tool may use different labels and still be right.</p>
</main>`
  })));
}


/* ---------- AI 爬虫变更日志（2026-11-04 草稿，公开前需 KiN 审） ---------- */
{
  const CL = JSON.parse(readFileSync(join(root, 'data/crawler-changelog.json'), 'utf8')).entries;
  const W = JSON.parse(readFileSync(join(root, 'data/doc-watch.json'), 'utf8'));
  const known = new Set(crawlers.map((c) => c.token));
  const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const tok = (t) => (known.has(t) ? `<a href="/en/bots/${slug(t)}/"><code>${esc(t)}</code></a>` : `<code>${esc(t)}</code>`);
  const items = CL.map((e) => `<li class="cl-i"><time datetime="${e.date}">${fmt(e.date)}</time><div><span class="cl-k ${e.kind}">${e.kind === 'vendor' ? 'Operator docs changed' : 'Directory update'}</span><p>${esc(e.en)}</p>${e.quote ? `<blockquote class="cl-q">“${esc(e.quote)}”</blockquote>` : ''}${e.tokens.length ? `<p class="cl-t">${e.tokens.map(tok).join(' ')}</p>` : ''}${e.source ? `<p class="cl-s"><a href="${esc(e.source)}" rel="nofollow noopener" target="_blank">Source ↗</a></p>` : ''}</div></li>`).join('');
  const docs = Object.entries(W.docs).map(([u, v]) => {
    const host = new URL(u).hostname.replace(/^www\./, '');
    const st = v.js_only ? 'By hand' : v.hash ? 'Watched' : 'Unreachable';
    return `<tr><td>${v.tokens.map(tok).join(' ')}</td><td><a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(host)} ↗</a></td><td>${st}</td></tr>`;
  }).join('');
  const last = W.checked_at.slice(0, 10);
  out.push(write('en/bots/changelog/index.html', page({
    path: '/en/bots/changelog/', active: 'bots',
    title: 'AI crawler changelog: new user agents and policy changes · VAKSEL',
    desc: 'Changes to the official documentation of AI crawlers like GPTBot, OAI-SearchBot, ClaudeBot and PerplexityBot: new user agents, renamed bots and robots.txt policy changes, each with its source.',
    body: `<main class="wrap doc">${crumbs([['/en/', 'Home'], ['/en/bots/', 'AI crawlers'], [null, 'Changelog']])}
<h1>AI crawler changelog</h1><p class="upd">Pages last fingerprinted ${fmt(last)}</p>
<p class="lead l">When an AI company adds a crawler, renames one or changes what robots.txt controls, your rules can go stale without you touching them. We fingerprint each operator's crawler page, compare it with the live page, and log a change here only after reading the source.</p>
<ol class="cl">${items}</ol>
<h2>Pages we compare</h2>
<p>${Object.keys(W.docs).length} official pages covering ${crawlers.length} crawlers. A change on a page only becomes an entry here after we read it; layout and wording edits that don't affect crawlers are left out.</p>
<div class="tscroll" style="overflow-x:auto"><table class="tbl clw"><thead><tr><th>Crawlers</th><th>Official page</th><th>Status</th></tr></thead><tbody>${docs}</tbody></table></div>
<section class="sec tight">${checkBox('Do your rules still match?', 'We test your robots.txt and firewall against the current list of crawlers.')}</section>
</main>${CHECK_JS}`
  })));
}

const urls = ['/en/', '/en/research/', '/en/research/grading/', '/en/research/lab/', '/en/pricing/', '/en/privacy/', '/en/terms/', '/en/contact/', '/en/guides/', ...GUIDES.map((g) => `/en/guides/${g.slug}/`), '/en/bots/', '/en/bots/changelog/', ...crawlers.map((c) => `/en/bots/${slug(c.token)}/`)];
write('en/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${canon(u)}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('en/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

/* ---------- 首页和报告页：替换导航与页脚 ---------- */
for (const f of ['en/report/index.html']) {
  let s = readFileSync(join(root, f), 'utf8');
  s = s.replace(/(<a class="skip"[^>]*>[^<]*<\/a>\n)?<nav class="nav"[\s\S]*?<\/nav>(\n<script>\(\(\)=>\{const n=[\s\S]*?<\/script>)?/, NAV(''));
  s = s.replace(/<link rel="icon"[\s\S]*?<link rel="stylesheet" href="\/en\/app.css">/, HEADX);
  s = s.replace(/<footer>[\s\S]*?<\/footer>/, FOOT);
  s = s.replace('<main class="wrap">', '<main class="wrap" id="main">');
  writeFileSync(join(root, f), s);
}
console.log('en pages:', out.length, '+ 404, sitemap; crawlers:', crawlers.length);
