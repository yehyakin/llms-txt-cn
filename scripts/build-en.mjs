// 生成英文站（VAKSEL）的静态页：统一导航/页脚、定价、指南、爬虫百科、404、sitemap。
// 用法：node scripts/build-en.mjs   （改了文案或 data/*.json 后重跑，再提交生成结果）
// 页面里的链接都写 /en/...；在 vaksel.com 上由 Worker 改写成根路径。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from '../en/view.js';
import { GRADE_VERSION } from '../en/grade.js';
import { FIXTURES, LAB_SUFFIX } from '../worker/lab.js';
const LAB = JSON.parse(readFileSync(new URL('../data/lab-results.json', import.meta.url), 'utf8'));

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://vaksel.com';
const UPDATED = '2026-11-01';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const canon = (p) => SITE + p.replace(/^\/en/, '');

export const NAV = (active, path) => `<a class="skip" href="#main">Skip to content</a>
<nav class="nav" aria-label="Main"><div class="wrap">
  <a class="logo" href="/en/" aria-label="VAKSEL home"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31"></a>
  <div class="links" id="navlinks">
    <a class="n${active === 'guides' ? ' on' : ''}" href="/en/guides/"${active === 'guides' ? ' aria-current="page"' : ''}>Fix guides</a>
    <a class="n${active === 'bots' ? ' on' : ''}" href="/en/bots/"${active === 'bots' ? ' aria-current="page"' : ''}>AI crawlers</a>
    <a class="n${active === 'pricing' ? ' on' : ''}" href="/en/pricing/"${active === 'pricing' ? ' aria-current="page"' : ''}>Pricing</a>
    <a class="n lang" href="https://cetxt.com${path && path !== '/en/404' ? path.replace(/^\/en/, '') : '/'}" hreflang="zh" lang="zh">中文</a>
  </div>
  <button class="menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="navlinks"><span></span><span></span></button>
</div></nav>
<script>(()=>{const n=document.currentScript.previousElementSibling,b=n.querySelector('.menu');b.onclick=()=>{const o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&n.classList.contains('open')){n.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus()}})})()</script>`;

export const FOOT = `<footer><div class="wrap fgrid">
  <div class="fbrand"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31" loading="lazy"><p>Can AI search actually reach your site? Free checks for robots.txt, firewall and CDN blocks.</p></div>
  <div><h2 class="fh">Product</h2><a href="/en/">Access check</a><a href="/en/pricing/">Pricing &amp; monitoring</a><a href="/en/research/">Research</a></div>
  <div><h2 class="fh">Fix guides</h2><a href="/en/guides/cloudflare/">Cloudflare</a><a href="/en/guides/cloudfront/">CloudFront / AWS WAF</a><a href="/en/guides/wordpress/">WordPress</a><a href="/en/guides/shopify/">Shopify</a></div>
  <div><h2 class="fh">AI crawlers</h2><a href="/en/bots/oai-searchbot/">OAI-SearchBot</a><a href="/en/bots/perplexitybot/">PerplexityBot</a><a href="/en/bots/claude-searchbot/">Claude-SearchBot</a><a href="/en/bots/">All crawlers</a></div>
  <div class="fsmall"><span>© 2026 VAKSEL</span><a href="/en/privacy/">Privacy</a><a href="/en/terms/">Terms</a><a href="/en/contact/">Contact</a><a href="https://cetxt.com/" hreflang="zh" lang="zh">中文版 cetxt.com</a><span>We don't store the domains you check or your IP address.</span></div>
</div></footer>`;

export const HEADX = `<link rel="icon" href="/en/brand/vaksel-favicon.svg" type="image/svg+xml"><link rel="icon" href="/en/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/en/apple-touch-icon.png"><link rel="manifest" href="/en/site.webmanifest">
<link rel="preload" href="/en/fonts/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/en/app.css">`;

function page({ path, title, desc, body, active, ld, type = 'article' }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex"><meta name="theme-color" content="#ffffff">
<link rel="canonical" href="${canon(path)}">
<link rel="alternate" hreflang="en" href="${canon(path)}"><link rel="alternate" hreflang="zh-CN" href="https://cetxt.com${path.replace(/^\/en/, '') || '/'}">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="VAKSEL"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon(path)}"><meta property="og:image" content="${SITE}/og/site.png"><meta name="twitter:card" content="summary_large_image">
${HEADX}${ld ? `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body>
${NAV(active, path)}
${body.includes('<main') ? body.replace('<main ', '<main id="main" tabindex="-1" ') : '<main id="main" tabindex="-1">' + body + '</main>'}
${FOOT}
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
const checkBox = (title = 'Check your site now', sub = 'Free, no sign-up. We request your homepage as 13 different clients and show what each one gets.') => `
<div class="cta mini"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>
<form class="field inv" data-check autocomplete="off"><input placeholder="yourdomain.com" aria-label="Domain" spellcheck="false" autocapitalize="off"><button class="btn">Check</button></form></div>`;
const CHECK_JS = `<script>
document.querySelectorAll('[data-check]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();let v=(f.querySelector('input').value||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0];if(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v))location.href='/en/report/'+v;else{f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake')}}));
</script>`;

/* ---------- 数据 ---------- */
const DATA = JSON.parse(readFileSync(join(root, 'data/ai-crawlers.json'), 'utf8'));
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
const CLASSIC = new Set(['Googlebot', 'Bingbot', 'Applebot', 'Baiduspider']);
const crawlers = DATA.crawlers.filter((c) => EN[c.token]);
const missing = DATA.crawlers.filter((c) => !EN[c.token]).map((c) => c.token);
if (missing.length) throw new Error('crawlers-en.json 缺少: ' + missing.join(', '));

const out = [];

/* ---------- 爬虫百科 ---------- */
const groupOrder = [['search', 'AI search & assistants'], ['user', 'User-triggered fetchers'], ['training', 'Training crawlers'], ['training_control', 'Training control tokens'], ['dataset', 'Open datasets']];
function botCard(c) {
  return `<a class="bcard" href="/en/bots/${slug(c.token)}/"><div class="bt">${esc(c.token)}</div><div class="bv">${esc(c.vendor)}${CLASSIC.has(c.token) ? ' · search engine' : ''}</div><p>${esc(EN[c.token].summary.split('. ')[0].replace(/\.$/, ''))}.</p></a>`;
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
<p class="note">Sources: each operator's official crawler documentation, checked ${DATA.crawlers[0].verified_on}. Entries marked “partial” rely on documentation that doesn't state every detail.</p>
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
<div class="facts"><div><span>Operator</span><b>${esc(c.vendor)}</b></div><div><span>Purpose</span><b>${CAT[c.category]}</b></div><div><span>Follows robots.txt</span><b>${ROBOTS[c.respects_robots] || '–'}</b></div><div><span>Source</span><b><a href="${esc(c.docs_url)}" rel="nofollow noopener" target="_blank">Official docs ↗</a></b></div></div>
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
  { id: 'pro', name: 'Pro', price: '$19', unit: '/month', tag: 'Early access', hi: true, items: ['Up to 10 sites', 'Daily re-checks', 'Email alert when a crawler gets cut off', '90-day history per crawler', 'Founding price locked for life'], cta: '<a class="btn" href="#join" data-plan="pro">Join early access</a>' },
  { id: 'agency', name: 'Agency', price: '$79', unit: '/month', tag: 'Early access', items: ['Up to 50 client sites', 'Everything in Pro', 'White-label PDF reports', 'Weekly client digest', 'Priority support'], cta: '<a class="btn" href="#join" data-plan="agency">Join early access</a>' }
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
  desc: 'Free one-off AI crawler access checks. Daily monitoring and alerts for up to 10 sites from $19/month, or 50 client sites for agencies.',
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
<p><b>Likely cause:</b> Cloudflare's Training control was set to <i>Block</i>, which now also blocks search crawlers.</p><span class="mbtn">View report and fix</span></div></div></div></section>
<section class="sec" id="join"><div class="join card">
  <img class="vava" src="/en/brand/vava/vava3d-working-mini.webp" width="96" height="100" alt="" loading="lazy">
  <div class="jtext"><h2>Join early access</h2><p class="sub">Founding members keep the launch price for as long as they stay subscribed. No card needed today.</p>
  <form id="wl" class="wl" autocomplete="on">
    <input type="email" name="email" required placeholder="you@company.com" aria-label="Email" autocomplete="email">
    <select name="plan" aria-label="Plan"><option value="pro">Pro · up to 10 sites</option><option value="agency">Agency · up to 50 sites</option></select>
    <input name="site" placeholder="Main site (optional)" aria-label="Main site (optional)" autocapitalize="off" spellcheck="false">
    <label class="wlplug"><input type="checkbox" name="plugin" value="1"> I’d install a plugin or Worker snippet to see real AI crawler visits</label>
    <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <button class="btn">Join the list</button>
  </form><p class="wlmsg" id="wlmsg" role="status"></p></div>
</div></section>
<section class="sec tight"><h2>Questions</h2><div class="faq">${FAQ.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
</main>
<script>
{const q=new URLSearchParams(location.search),st=q.get('site'),pl=q.get('plan');if(st)document.querySelector('#wl [name=site]').value=st;if(pl==='agency'||pl==='pro')document.querySelector('#wl [name=plan]').value=pl}
document.querySelectorAll('[data-plan]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#wl [name=plan]').value=a.dataset.plan}));
const wl=document.getElementById('wl'),msg=document.getElementById('wlmsg');
wl.addEventListener('submit',async e=>{e.preventDefault();const b=wl.querySelector('button');b.disabled=true;msg.textContent='';
  const fd=Object.fromEntries(new FormData(wl));
  try{const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fd)});const j=await r.json();
    if(r.ok&&j.ok){wl.hidden=true;msg.className='wlmsg ok';msg.textContent='You’re on the list. We’ll email '+fd.email+' when your account is ready.'}
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
const FIXT = JSON.parse(readFileSync(join(root, 'tests/fixture-toyota.json'), 'utf8'));
const demo = renderReport(FIXT, { base: '/en', when: '2026-11-01T09:12:00Z', url: SITE + '/report/toyota.com' });
const EXAMPLES = [
  ['toyota.com', 'Silent block', 'v-bad', 'CloudFront rejects OAI-SearchBot and PerplexityBot. A browser and Googlebot get through.'],
  ['smithsonianmag.com', 'All blocked', 'v-bad', 'Cloudflare turns away all 8 AI search and user-triggered crawlers we sent.'],
  ['torontosun.com', 'Silent block', 'v-bad', '6 of 8 AI search crawlers rejected while robots.txt allows them.']
];
const HOME_FAQ = [
  ['Isn’t robots.txt enough?', 'robots.txt is only a request. Your CDN, firewall or a security plugin decides what actually gets through, and it can reject a crawler that robots.txt welcomes. That is the silent block we test for.'],
  ['Will allowing AI search let my content be used for training?', 'No. Search and training are separate crawlers at OpenAI, Anthropic, Perplexity, Apple and Google. You can allow OAI-SearchBot and block GPTBot, for example. Our guides show how on each platform.'],
  ['How accurate is a test from a data center?', 'Real crawlers come from their own IP ranges, which we can’t use. So every test runs with control groups (a normal browser, Googlebot and an unknown bot) and each result carries a confidence level.']
];
const homeBody = `<header class="hero"><div class="wrap">
  <span class="eyebrow"><b></b>Free · no sign-up · results in seconds</span>
  <h1>Can AI search <span class="grad">actually reach</span> your site?</h1>
  <p class="lead">Your robots.txt may say yes while your firewall says no. We request your page with the user agents of ChatGPT, Perplexity and Claude, compare against a browser and Googlebot, and show you what each one got back.</p>
  <form class="field" id="f" autocomplete="off" role="search">
    <input id="d" name="d" placeholder="yourdomain.com" inputmode="url" autocapitalize="off" spellcheck="false" aria-label="Your domain">
    <button class="btn" type="submit">Check access</button>
  </form>
  <p class="hint">Try <button type="button" data-d="toyota.com">toyota.com</button>·<button type="button" data-d="github.com">github.com</button>·<button type="button" data-d="shopify.com">shopify.com</button></p>
</div></header>

<section class="sec demo-sec" aria-label="Example report"><div class="wrap">
  <div class="win"><div class="bar"><i></i><i></i><i></i><span>vaksel.com/report/toyota.com</span></div>
    <div class="wbody" inert><div class="rp-head"><div><div class="crumb">AI crawler access report</div><h2 class="dh">toyota.com</h2><div class="meta">${demo.meta}</div></div></div>${demo.html}</div>
    <a class="wopen" href="/en/report/toyota.com">Open the live report →</a></div>
  <p class="cap">A real report from November 1, 2026. Toyota's robots.txt welcomes AI search crawlers; its firewall turns them away.</p>
</div></section>

<section class="sec" id="checks"><div class="wrap">
  <h2>Three layers, tested for real</h2>
  <p class="sub">Most checkers only read robots.txt. We also send live requests, with control groups so a bot-verification rule isn't mistaken for a block.</p>
  <div class="grid3">
    <div class="card c1"><div class="ic" aria-hidden="true">1</div><h3>robots.txt rules</h3><p>A verdict for each of 20+ AI agents, with search and training crawlers kept apart, so you can opt out of training without leaving AI answers.</p></div>
    <div class="card c2"><div class="ic" aria-hidden="true">2</div><h3>Firewall &amp; CDN</h3><p>Live requests as OAI-SearchBot, PerplexityBot, Claude-SearchBot and more. We name the CDN that answered: Cloudflare, CloudFront, Akamai and others.</p></div>
    <div class="card c3"><div class="ic" aria-hidden="true">3</div><h3>Page readability</h3><p>noindex and nosnippet, and whether your content exists without JavaScript, which most AI crawlers don't run.</p></div>
  </div>
</div></section>

<section class="sec" id="data"><div class="wrap">
  <div class="stat">
    <div class="card dark" style="padding:30px">
      <p class="k1">Our November 2026 sample of popular sites</p>
      <div class="big grad">1 in 28</div>
      <p class="k2">reachable sites silently block AI search crawlers at the firewall, while robots.txt allows them and Googlebot gets through.</p>
      <p class="k3">13 of 362 reachable sites, from a random 600 of the Tranco top 20k. Requests sent from a data-center IP with crawler user agents and control groups.</p>
    </div>
    <div class="card" style="padding:26px">
      <h3 style="margin-top:0;font-size:19px">Found in our sample</h3>
      <ul class="ex">${EXAMPLES.map(([d, t, c, w]) => `<li><a href="/en/report/${d}"><b>${d}</b><span class="tag ${c === 'v-bad' ? 't-bad' : 't-warn'}">${t}</span></a><p>${w}</p></li>`).join('')}</ul>
      <p class="note" style="margin-top:8px">Results from November 1, 2026. Each link runs a fresh check. <a href="/en/research/">How we measured this →</a></p>
    </div>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <h2>Fix it where the block is</h2>
  <p class="sub">Each report names the layer that rejected the crawler and links the matching guide.</p>
  <div class="bgrid g4">${GUIDES.map((g) => `<a class="bcard g" href="/en/guides/${g.slug}/"><div class="bt">${esc(g.name)}</div><p>${esc(g.desc.split('. ')[0].replace(/\.$/, ''))}.</p></a>`).join('')}</div>
</div></section>

<section class="sec" id="monitor"><div class="wrap">
  <div class="cta">
    <div><h3>Rules change. Get told when they do.</h3><p>Daily re-checks and an email when a CDN update, plugin or robots.txt edit cuts off an AI crawler. Multi-site reports for agencies.</p></div>
    <a class="btn" href="/en/pricing/">See plans</a>
  </div>
</div></section>

<section class="sec tight"><div class="wrap"><h2>Questions</h2><div class="faq">${HOME_FAQ.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>

<script>
const f=document.getElementById('f'),d=document.getElementById('d');
function clean(v){v=(v||'').trim().toLowerCase().replace(/^https?:\\/\\//,'').split(/[\\/?#]/)[0].replace(/\\.$/,'');return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/.test(v)?v:null}
function go(v){const c=clean(v);if(!c){f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake');d.focus();return}location.href='/en/report/'+c}
f.addEventListener('submit',e=>{e.preventDefault();go(d.value)});
document.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>go(b.dataset.d));
</script>`;
const homeLd = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'VAKSEL', url: SITE + '/', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web', description: 'Checks whether AI search crawlers can reach a website through robots.txt, firewalls and CDNs.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
out.push(write('en/index.html', page({
  path: '/en/', title: 'Can AI search reach your site? Free AI crawler access check · VAKSEL',
  desc: 'Test whether ChatGPT, Perplexity and Claude search crawlers can actually reach your site: robots.txt, firewall and CDN blocks, noindex and JavaScript-only pages. Free, no sign-up.',
  body: homeBody, ld: homeLd, type: 'website'
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
<ul><li><b>2026-11-02.1</b>: first public version. Adds robots.txt 5xx as “disallow everything” and caps cite at B for FAQ markup that doesn’t match the page.</li></ul>
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
<h2>Service providers</h2>
<p>The site runs on Cloudflare (hosting, caching and storage). Some checks are sent through our own server when a site blocks Cloudflare's network. Cloudflare processes requests under its <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener" target="_blank">privacy policy</a>.</p>
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
    return `<tr><td><a href="https://${d}/" rel="nofollow">${d}</a></td><td>${esc(f.en)}</td><td style="white-space:nowrap">${g3(f.expect)}</td><td style="white-space:nowrap">${r.got ? g3(r.got) + (r.ok ? ' ✓' : ' ✗') : '–'}</td><td><a href="/en/report/${d}">Report</a></td></tr>`; }).join('');
  const nOk = LAB.results.filter((r) => r.ok).length;
  out.push(write('en/research/lab/index.html', page({
    path: '/en/research/lab/', title: 'VAKSEL Lab: open test sites for AI visibility tools · VAKSEL',
    desc: 'Nineteen public test sites, each changing one thing (a firewall 403, a robots.txt 503, a fake llms.txt, mismatched FAQ markup). Use them to check any AI visibility tool, ours included.',
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
<p>Our first run matched 3 of 19. The lab found four bugs, now fixed:</p>
<ul><li>Huawei’s PetalBot wasn’t in our crawler list, so a site that blocked everyone in robots.txt was graded B instead of C. The same bug hid a robots.txt 503.</li>
<li>An X-Robots-Tag: noindex header was missed when we fetched through our fallback server.</li>
<li>When a site refused our direct request, its sitemap was reported missing, because the sitemap check had no fallback server.</li>
<li>A page that merely mentioned “Just a moment” was mistaken for a challenge page. We changed the test site; real challenge detection still uses page size.</li></ul>
<h2>Limits</h2>
<p>The sites simulate common setups. They don’t reproduce IP-based verification by real vendors, JavaScript challenges that need a browser, or rate limits. Expected grades follow our published rules; another tool may use different labels and still be right.</p>
</main>`
  })));
}

const urls = ['/en/', '/en/research/', '/en/research/grading/', '/en/research/lab/', '/en/pricing/', '/en/privacy/', '/en/terms/', '/en/contact/', '/en/guides/', ...GUIDES.map((g) => `/en/guides/${g.slug}/`), '/en/bots/', ...crawlers.map((c) => `/en/bots/${slug(c.token)}/`)];
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
