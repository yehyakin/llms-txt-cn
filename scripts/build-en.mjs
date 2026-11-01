// 生成英文站（VAKSEL）的静态页：统一导航/页脚、定价、指南、爬虫百科、404、sitemap。
// 用法：node scripts/build-en.mjs   （改了文案或 data/*.json 后重跑，再提交生成结果）
// 页面里的链接都写 /en/...；在 vaksel.com 上由 Worker 改写成根路径。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://vaksel.com';
const UPDATED = '2026-11-01';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const canon = (p) => SITE + p.replace(/^\/en/, '');

export const NAV = (active) => `<nav class="nav"><div class="wrap">
  <a class="logo" href="/en/" aria-label="VAKSEL home"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31"></a>
  <a class="n hide-m${active === 'guides' ? ' on' : ''}" href="/en/guides/">Fix guides</a>
  <a class="n hide-m${active === 'bots' ? ' on' : ''}" href="/en/bots/">AI crawlers</a>
  <a class="n${active === 'pricing' ? ' on' : ''}" href="/en/pricing/">Pricing</a>
  <a class="n lang" href="https://cetxt.com/" hreflang="zh">中文</a>
</div></nav>`;

export const FOOT = `<footer><div class="wrap fgrid">
  <div class="fbrand"><img src="/en/brand/vaksel-horizontal-primary.svg" alt="VAKSEL" width="164" height="31"><p>Can AI search actually reach your site? Free checks for robots.txt, firewall and CDN blocks.</p></div>
  <div><h4>Product</h4><a href="/en/">Access check</a><a href="/en/pricing/">Pricing &amp; monitoring</a><a href="/en/#data">Research</a></div>
  <div><h4>Fix guides</h4><a href="/en/guides/cloudflare/">Cloudflare</a><a href="/en/guides/cloudfront/">CloudFront / AWS WAF</a><a href="/en/guides/wordpress/">WordPress</a><a href="/en/guides/shopify/">Shopify</a></div>
  <div><h4>AI crawlers</h4><a href="/en/bots/oai-searchbot/">OAI-SearchBot</a><a href="/en/bots/perplexitybot/">PerplexityBot</a><a href="/en/bots/claude-searchbot/">Claude-SearchBot</a><a href="/en/bots/">All crawlers</a></div>
  <div class="fsmall"><span>© 2026 VAKSEL</span><a href="https://cetxt.com/" hreflang="zh">中文版 cetxt.com</a><span>We log the domains checked and the requesting IP for abuse prevention.</span></div>
</div></footer>`;

function page({ path, title, desc, body, active, index = true, ld }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex"><meta name="theme-color" content="#ffffff">
<link rel="canonical" href="${canon(path)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="VAKSEL"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon(path)}"><meta property="og:image" content="${SITE}/og/site.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/en/brand/vaksel-favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/en/app.css">${ld ? `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head><body>
${NAV(active)}
${body}
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
<div class="plans">${PLANS.map((p) => `<div class="plan${p.hi ? ' hi' : ''}"><div class="ptag">${p.tag}</div><h3>${p.name}</h3><div class="pp">${p.price}<small>${p.unit}</small></div><ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>${p.cta}</div>`).join('')}</div>
<section class="sec" id="join"><div class="join card">
  <img class="vava" src="/en/brand/vava/vava3d-working-mini.webp" width="96" height="100" alt="" loading="lazy">
  <div class="jtext"><h2>Join early access</h2><p class="sub">Founding members keep the launch price for as long as they stay subscribed. No card needed today.</p>
  <form id="wl" class="wl" autocomplete="on">
    <input type="email" name="email" required placeholder="you@company.com" aria-label="Email">
    <select name="plan" aria-label="Plan"><option value="pro">Pro · up to 10 sites</option><option value="agency">Agency · up to 50 sites</option></select>
    <input name="site" placeholder="Main site (optional)" aria-label="Main site" autocapitalize="off" spellcheck="false">
    <input name="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <button class="btn">Join the list</button>
  </form><p class="wlmsg" id="wlmsg" role="status"></p></div>
</div></section>
<section class="sec tight"><h2>Questions</h2><div class="faq">${FAQ.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
</main>
<script>
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

/* ---------- sitemap ---------- */
const urls = ['/en/', '/en/pricing/', '/en/guides/', ...GUIDES.map((g) => `/en/guides/${g.slug}/`), '/en/bots/', ...crawlers.map((c) => `/en/bots/${slug(c.token)}/`)];
write('en/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${canon(u)}</loc><lastmod>${UPDATED}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('en/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

/* ---------- 首页和报告页：替换导航与页脚 ---------- */
for (const f of ['en/index.html', 'en/report/index.html']) {
  let s = readFileSync(join(root, f), 'utf8');
  s = s.replace(/<nav class="nav">[\s\S]*?<\/nav>/, NAV(''));
  s = s.replace(/<footer>[\s\S]*?<\/footer>/, FOOT);
  writeFileSync(join(root, f), s);
}
console.log('en pages:', out.length, '+ 404, sitemap; crawlers:', crawlers.length);
