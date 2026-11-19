// 中文首页（2026-11-05）：直接复用英文首页（en/index.html，由 build-en.mjs 先生成）的版式与脚本，
// 文案逐条换成中文；链接从 /en/ 改到中文站根路径，图片、字体等静态资源仍用 /en/ 下的文件。
// 英文首页改了文案后，这里对应的条目也要改；找不到的英文原文会在构建时报错，避免漏翻。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// [英文原文（HTML 里的样子）, 中文]，各替换一次
const T = [
  ['See what AI search actually gets from your site.', 'AI 搜索到底能从你的网站拿到什么？'],
  ['Your robots.txt may say yes while your firewall says no. VAKSEL requests your page as ChatGPT, Perplexity and Claude, checks it against a browser and Googlebot, and shows what each one got back.', 'robots.txt 写着欢迎，防火墙却可能把它挡在门外。VAKSEL 用 ChatGPT、Perplexity、Claude 爬虫的身份请求你的页面，再和浏览器、Googlebot 对照，告诉你每个请求拿到了什么。'],
  ['aria-label="Check access"', 'aria-label="开始检测"'],
  ['Try <button', '试试 <button'],
  ['<span>Free, no sign-up</span>', '<span>免费，无需注册</span>'],
  ['<h3>Silent block</h3>\n  <p class="ix">robots.txt lets OAI-SearchBot in. The firewall answers 403.</p>', '<h3>静默拦截</h3>\n  <p class="ix">robots.txt 放行了 OAI-SearchBot，防火墙却回了 403。</p>'],
  ['aria-label="Crawlers we test"', 'aria-label="我们测试的爬虫"'],
  ['We test the crawlers behind', '我们测试这些公司的爬虫'],
  ['<p class="kick">Product</p><h2>AI crawler access, tested for real.</h2>', '<p class="kick">产品</p><h2>AI 爬虫能不能进，实测给你看。</h2>'],
  ['Most checkers read robots.txt and stop. VAKSEL sends live requests through your CDN and firewall, with control groups, and tells you which layer said no.', '多数检测工具读完 robots.txt 就结束了。VAKSEL 会穿过你的 CDN 和防火墙真实发请求，设对照组，并告诉你是哪一层拒绝了。'],
  ['<h3>Enter your domain</h3><p>One field, no sign-up. We read robots.txt for 20+ AI agents and keep search, user-triggered and training crawlers apart.</p>', '<h3>输入你的域名</h3><p>一个输入框，无需注册。我们按 20 多个 AI 爬虫逐个解读 robots.txt，搜索、用户触发和训练三类分开看。</p>'],
  ['<span>Domain</span><span>Agents</span><span>robots.txt</span>', '<span>域名</span><span>爬虫</span><span>robots.txt</span>'],
  ['<h3>We request as each crawler</h3><p>Live requests as OAI-SearchBot, PerplexityBot, Claude-SearchBot and the rest, next to a normal browser and Googlebot, so a bot check isn’t mistaken for a block.</p>', '<h3>以每个爬虫的身份请求</h3><p>用 OAI-SearchBot、PerplexityBot、Claude-SearchBot 等身份实际请求，同时用普通浏览器和 Googlebot 对照，避免把爬虫核验误判成拦截。</p>'],
  ['<span>Firewall</span><span>CDN</span><span>Control groups</span>', '<span>防火墙</span><span>CDN</span><span>对照组</span>'],
  ['<h3>Fix it, then keep watching</h3><p>Each finding names the layer that rejected the crawler and links the guide for your platform. Turn on monitoring and we email you when a rule change cuts one off.</p>', '<h3>修好它，然后持续盯着</h3><p>每条结论写明是哪一层拒绝了爬虫，并附上对应平台的修复指南。开启监控后，规则一变导致爬虫被挡，我们就发邮件告诉你。</p>'],
  ['<span>Fix guide</span><span>Re-checks</span><span>Alerts</span>', '<span>修复指南</span><span>定期复测</span><span>邮件提醒</span>'],
  ['<span>New check</span><small>8 agents · 3 controls</small>', '<span>新建检测</span><small>8 个爬虫 · 3 个对照</small>'],
  ['<em>Check access</em>', '<em>开始检测</em>'],
  ['toyota.com · served by CloudFront', 'toyota.com · 应答方 CloudFront'],
  [' silent blocks</small>', ' 个静默拦截</small>'],
  ['<span>Fix · CloudFront / AWS WAF</span><small>Guide</small>', '<span>修复 · CloudFront / AWS WAF</span><small>指南</small>'],
  ['AWS WAF · Bot Control rule group', 'AWS WAF · Bot Control 规则组'],
  ['<span>Category</span>', '<span>类别</span>'],
  ['<em>keep</em>', '<em>保持</em>'],
  ['<b>VAKSEL alerts</b><span>Sample alert</span>', '<b>VAKSEL 提醒</b><span>提醒邮件示例</span>'],
  ['OAI-SearchBot can no longer reach example.com', 'OAI-SearchBot 已无法访问 example.com'],
  ['Re-checked twice, 15 minutes apart: <code>200 → 403</code> at the firewall. robots.txt unchanged.', '间隔 15 分钟复测两次，防火墙层 <code>200 → 403</code>。robots.txt 没有变化。'],
  ['<p class="kick">Evaluation</p><h2>Checked against sites with known answers.</h2>', '<p class="kick">评估</p><h2>用答案已知的网站来检验。</h2>'],
  [' lab verdicts right</h3>', ' 个测试站判断正确</h3>'],
  ['Sites we configured ourselves, re-run whenever the rules change. Reading robots.txt alone gets ', '这些站点由我们自己配置，规则一改就重跑。只读 robots.txt 只能答对 '],
  [' right; the misses are mostly firewall and CDN blocks.', '，错的大多是防火墙和 CDN 拦截。'],
  ['See the lab →', '看对照测试集 →'],
  ['<h3>Control groups on every check</h3><p>A data-center IP isn’t a crawler’s real IP. So each result is compared with a browser, Googlebot and an unknown bot, and carries a confidence level.</p>', '<h3>每次检测都有对照组</h3><p>机房 IP 不是爬虫的真实 IP。所以每个结果都和浏览器、Googlebot、未知爬虫对照，并标出可信度。</p>'],
  ['How grading works →', '评级方法 →'],
  ['<h3>Measured on real sites</h3><p>13 of 362 reachable sites silently block AI search crawlers while robots.txt allows them and Googlebot gets through.</p>', '<h3>在真实网站上测量</h3><p>362 个可访问的网站中有 13 个静默拦截 AI 搜索爬虫：robots.txt 允许，Googlebot 也能进。中文大站另测了 1000 个，静默拦截约 0.8%。</p>'],
  ['Read the study →', '看研究报告 →'],
  ['aria-label="Example report"', 'aria-label="报告示例"'],
  ['<p class="kick">From check to report</p><h2>A clear verdict.<br>Evidence for every line.<br>One report to share.</h2>', '<p class="kick">从检测到报告</p><h2>结论清楚，<br>每一行都有证据，<br>一份报告就能转给别人。</h2>'],
  ['Every check ends in a report you can send to your CDN team or a client: what each crawler got back, which layer decided it, and how to fix it.', '每次检测都生成一份报告，可以直接发给 CDN 运维或客户：每个爬虫拿到了什么、是哪一层决定的、怎么修。'],
  ['<li>Verdict for each AI agent</li><li>The layer that blocked it</li><li>Status codes from live requests</li><li>A fix guide for your platform</li>', '<li>每个 AI 爬虫的结论</li><li>拦截发生在哪一层</li><li>实测请求的状态码</li><li>对应平台的修复指南</li>'],
  ['Open a real report <span>→</span>', '打开一份真实报告 <span>→</span>'],
  ['aria-label="Example report, scroll to read"', 'aria-label="报告示例，可滚动阅读"'],
  ['<p class="kick">FAQ</p><h2>Questions</h2><p class="sub">How the check works, and what it can’t see.</p>', '<p class="kick">常见问题</p><h2>问答</h2><p class="sub">检测怎么做，以及它看不到什么。</p>'],
  ['<h2>See what AI crawlers really get.</h2>', '<h2>看看 AI 爬虫真正拿到了什么。</h2>'],
  ['<p>Check in seconds. Monitoring emails you when a CDN, plugin or robots.txt change cuts one off.</p>', '<p>几秒出结果。开启监控后，CDN、插件或 robots.txt 的改动一旦挡住 AI 爬虫，我们就发邮件告诉你。</p>'],
  ['<em>allows AI search</em>', '<em>允许 AI 搜索</em>'],
  ['<em>control · 200</em>', '<em>对照 · 200</em>'],
  ['<b>Monitoring</b><em>re-checked daily</em>', '<b>监控</b><em>每天复测</em>'],
  ['placeholder="Is ChatGPT blocked on my site?"', 'placeholder="ChatGPT 能访问我的网站吗？"'],
  ['See monitoring plans →', '了解监控 →'],
  // 首屏轮播卡片（脚本里的文案）
  ["'Silent block','robots.txt lets OAI-SearchBot in. The firewall answers 403.'", "'静默拦截','robots.txt 放行了 OAI-SearchBot，防火墙却回了 403。'"],
  ["'All blocked','Cloudflare turns away all 6 AI search and user-triggered crawlers we sent.','6 of 6 rejected'", "'全部拦截','我们发出的 6 个 AI 搜索和用户触发爬虫全被 Cloudflare 拒绝。','6 个全被拒'"],
  ["'Silent block','OpenAI and Perplexity crawlers get a 403. Claude’s get through.'", "'静默拦截','OpenAI 和 Perplexity 的爬虫收到 403，Claude 的能进。'"],
  ["'Open','Every AI crawler we sent got the page, same as Googlebot.','8 of 8 got in'", "'畅通','我们发出的 AI 爬虫都拿到了页面，和 Googlebot 一样。','8 个全部通过'"]
];
// 出现多次的词，全部替换
const ALL = [
  ['aria-label="Your domain"', 'aria-label="你的域名"'],
  ['>Check access <span>›</span>', '>开始检测 <span>›</span>'],
  ['<p class="lh">Process</p>', '<p class="lh">执行过程</p>'],
  ['<span>fetch robots.txt</span>', '<span>读取 robots.txt</span>'],
  ['<small>200 · 1 redirect</small>', '<small>200 · 1 次跳转</small>'],
  ['<span>probe 8 AI agents</span>', '<span>以 8 个 AI 爬虫身份请求</span>'],
  ['<span>control: browser, Googlebot, unknown bot</span>', '<span>对照：浏览器、Googlebot、未知爬虫</span>'],
  ['<span>fix guide</span>', '<span>修复指南</span>'],
  ['>queued<', '>排队中<'],
  ['<i></i>Browser<b>', '<i></i>浏览器<b>'],
  ['<i></i>Unknown bot<b>', '<i></i>未知爬虫<b>'],
  ['>Search<', '>搜索<'], ['>User<', '>用户触发<'], ['>Training<', '>训练<'],
  ['Indexes pages for ChatGPT search results.', '为 ChatGPT 搜索结果建立索引。'],
  ['Fetches a page when a ChatGPT user asks about it.', 'ChatGPT 用户提问时实时抓取页面。'],
  ['Indexes pages for Perplexity answers.', '为 Perplexity 的回答建立索引。'],
  ['Fetches a page during a Perplexity question.', 'Perplexity 用户提问时抓取页面。'],
  ['Indexes pages for Claude’s web search.', '为 Claude 联网搜索建立索引。'],
  ['Fetches a page when a Claude user asks.', 'Claude 用户提问时抓取页面。'],
  ['Collects pages to train OpenAI models.', '抓取网页用于训练 OpenAI 模型。'],
  ['Collects pages to train Anthropic models.', '抓取网页用于训练 Anthropic 模型。'],
  ['robots: disallow', 'robots：禁止'], ['robots: partial', 'robots：部分允许'], ['robots: allow', 'robots：允许'],
  ['vaksel.com/report/toyota.com', 'cetxt.com/report/toyota.com'],
  ['/en/report/', '/report/'], ['/en/guides/', '/guides/'], ['/en/research/', '/research/'], ['/en/pricing/', '/pricing/']
];

const GUIDE_SHORT = {
  cloudflare: '2026 年 9 月起 AI 爬虫控制拆成 Search、Training、Agent 三项',
  cloudfront: 'Bot Control 的 CategoryAI 规则连已验证的 AI 爬虫也会拦',
  wordpress: '一项设置、SEO 插件、安全插件或主机商都可能拦 AI 爬虫',
  shopify: '用 robots.txt.liquid 决定哪些 AI 爬虫能访问店铺',
  edgeone: '“AI 爬虫处置”名单里包括 AI 搜索用的 PerplexityBot',
  aliyun: 'ESA“AI 爬虫管理”可逐个拦截或观察，默认返回 403',
  baota: 'Nginx 防火墙不认识 OAI-SearchBot 等 AI 爬虫',
  baidu: '没有单独开关，拦截多来自 UA 名单、区域封禁或 WAF'
};
const GUIDE_MARK = { cloudflare: 'cloudflare', cloudfront: 'amazonwebservices', wordpress: 'wordpress', shopify: 'shopify' };
const CDN = { 'toyota.com': 'CloudFront', 'smithsonianmag.com': 'Cloudflare', 'torontosun.com': 'istio-envoy' };

export function zhHome({ root, GUIDES_ZH, HOME_FAQ_ZH, EXAMPLES_ZH, DEMO_DATE_ZH }) {
  const en = readFileSync(join(root, 'en/index.html'), 'utf8');
  const a = en.indexOf('<header class="hero">'), b = en.lastIndexOf('</main>');
  if (a < 0 || b < 0) throw new Error('zh-home: 找不到英文首页正文');
  let h = en.slice(a, b);
  const MARK = (n) => readFileSync(join(root, `data/marks/${n}.svg`), 'utf8').replace('<svg ', '<svg class="mk " aria-hidden="true" fill="currentColor" ').replace(/<title>.*?<\/title>/, '');
  const sec = (start, end, html) => { const i = h.indexOf(start), j = h.indexOf(end, i); if (i < 0 || j < 0) throw new Error('zh-home: 段落没找到 ' + start); h = h.slice(0, i) + html + h.slice(j); };
  // 整段替换：样本卡片 + 修复指南（中文有 8 篇）+ 旧工具入口
  sec('<section class="sec found gridbg">', '<section class="sec tight faqs">', `<section class="sec found gridbg"><div class="wrap">
  <p class="lab">抽样里发现的例子</p><p class="lsub">robots.txt 放行，防火墙却拦。</p>
  <div class="qcards">${EXAMPLES_ZH.map(([d, t, , w], i) => `<a class="qc tk${i === 1 ? ' g2' : ''}" href="/report/${d}"><div class="qh"><b>${d}</b><span>${esc(t)}</span></div><p>${esc(w)}</p><div class="qf"><span>${CDN[d] || ''}</span><span>2026-11-01</span></div></a>`).join('')}</div>
  <p class="lab" style="margin-top:56px">修复指南</p><p class="lsub">哪一层拦的，就修哪一层。</p>
  <div class="qcards g4">${GUIDES_ZH.map((g, i) => `<a class="qc tk gd${i % 4 === 2 ? ' g2' : ''}" href="/guides/${g.slug}/"><div class="gmk">${GUIDE_MARK[g.slug] ? MARK(GUIDE_MARK[g.slug]) : `<span class="gtx">${esc(g.name.replace(/^(腾讯云|阿里云|百度智能云)\s*/, '').slice(0, 2))}</span>`}</div><div class="qh"><b>${esc(g.name)}</b><span>指南</span></div><p>${esc(GUIDE_SHORT[g.slug] || String(g.desc).split('。')[0])}。</p><div class="qf"><span>看指南 →</span></div></a>`).join('')}</div>
  <p class="lab" style="margin-top:56px">原来的工具都还在</p><p class="lsub">llms.txt 工具与中文大站普查。</p>
  <div class="qcards g2c"><a class="qc tk gd" href="/tools/"><div class="qh"><b>llms.txt 工具</b><span>工具</span></div><p>生成、校验 llms.txt，还有 robots.txt 规则生成器。</p><div class="qf"><span>打开工具 →</span></div></a><a class="qc tk gd" href="/survey/"><div class="qh"><b>中文大站普查</b><span>报告</span></div><p>1000 个中文网站的 AI 爬虫规则与 llms.txt 现状。</p><div class="qf"><span>看普查报告 →</span></div></a></div>
</div></section>

`);
  const fs0 = h.indexOf('<section class="sec tight faqs">');
  const fa = h.indexOf('<div class="faq">', fs0), fb = h.indexOf('</div></div></section>', fa);
  if (fs0 < 0 || fa < 0 || fb < 0) throw new Error('zh-home: FAQ 没找到');
  h = h.slice(0, fa) + `<div class="faq">${HOME_FAQ_ZH.map(([q, x]) => `<details><summary>${esc(q)}</summary><p>${esc(x)}</p></details>`).join('')}` + h.slice(fb);
  h = h.replace(/alt="Cover of a VAKSEL AI crawler access report for toyota.com, [^"]*"/, `alt="VAKSEL 为 toyota.com 生成的 AI 爬虫可访问性报告封面，${DEMO_DATE_ZH}"`)
    .replace(/alt="Report pages: [^"]*"/, 'alt="报告内页：结论为静默拦截，8 个 AI 爬虫的结果，拦截层为 CloudFront，AWS WAF 修复指南"')
    .replace(/alt="Access verdict accuracy[^"]*"/, 'alt="20 个测试站上的判断准确率：VAKSEL 与只读 robots.txt 对比，按配置类型分组"')
    .replace(/alt="toyota.com: crawlers robots.txt allows[^"]*"/, 'alt="toyota.com：robots.txt 允许的爬虫与实际拿到页面的爬虫，按类别对比"')
    .replace(/alt="Sample funnel:[^"]*"/, 'alt="抽样漏斗：Tranco 600 个域名，362 个可访问，45 个拒绝了 AI 搜索 UA，其中 13 个针对 AI"');
  for (const [e, z] of T) { if (!h.includes(e)) throw new Error('zh-home: 英文原文没找到，可能英文首页改了：' + e.slice(0, 70)); h = h.replace(e, z); }
  for (const [e, z] of ALL) h = h.split(e).join(z);
  // “20 of 20 个测试站判断正确”“只能答对 12 of 20”
  h = h.replace(/(\d+) of (\d+) 个测试站判断正确/, '$2 个测试站，$1 个判断正确').replace(/只能答对 (\d+) of (\d+)/, '只能答对 $1 个');
  const left = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
  return { body: h, leftover: left };
}
