// 中文站（cetxt.com）正文内容：由 scripts/build-en.mjs 的英文内容翻译而来。
// 结构与英文版一一对应；<pre> 代码块保持原样；内部链接已改为中文站路径。

export const GUIDES_ZH = [
  {
    slug: 'cloudflare', name: 'Cloudflare', title: 'Cloudflare 拦截了 AI 爬虫：修复方法（2026 年新版控制项）',
    desc: '自 2026 年 9 月 15 日起，Cloudflare 将 AI 爬虫控制拆分为 Search、Training 和 Agent 三项。本文说明如何在拒绝 AI 训练的同时，继续出现在 ChatGPT、Perplexity 和 Claude 的搜索结果中。',
    body: `
<p class="lead l">2026 年 9 月 15 日，Cloudflare 用三个控制项取代了原来单一的“Block AI bots”开关。过去无害的设置，现在可能会拦截搜索爬虫，包括 Googlebot、Bingbot 和 Applebot。</p>
<div class="callout"><b>简要做法。</b>在 <b>Security → Settings</b> 中，将 <b>Search</b> 设为 <i>Allow</i>，<b>Training</b> 设为 <i>Disallow AI Training</i>，<b>Agent</b> 按需设置。除非你接受同时退出 Google、Bing 和 Apple 搜索，否则不要把 Training 设为 <i>Block</i>。</div>
<h2>1. 检查三个 AI 爬虫控制项</h2>
<p>Cloudflare 现在按行为对爬虫分类，每个控制项单独设置：</p>
<table class="tbl"><thead><tr><th>控制项</th><th>涵盖范围</th><th>建议设置</th></tr></thead><tbody>
<tr><td><b>Search</b></td><td>为日后回答问题而索引内容的爬虫，例如 OAI-SearchBot、PerplexityBot 和 Claude-SearchBot。</td><td>Allow</td></tr>
<tr><td><b>Training</b></td><td>为训练模型而收集内容的爬虫，包括同时用于搜索和训练的混合用途爬虫。</td><td>Disallow AI Training</td></tr>
<tr><td><b>Agent</b></td><td>由用户触发的抓取，例如 ChatGPT-User、Claude-User 以及浏览器操作类智能体。</td><td>Allow，或 Block on pages with ads</td></tr>
</tbody></table>
<p>可选项为 <i>Allow</i>、<i>Block on pages with ads</i>（在含广告的页面上拦截）和 <i>Block</i>；Training 另外提供 <i>Disallow AI Training</i>（禁止 AI 训练）。</p>
<h2>2. 了解“Block”现在的含义</h2>
<p>自 2026 年 9 月 15 日起，<i>Block</i> 和 <i>Block on pages with ads</i> 也会作用于混合用途爬虫。Cloudflare 的官方公告写明，为 Training 选择 Block “will stop Applebot, Bingbot, and Googlebot from reaching your site, search included.”（会让 Applebot、Bingbot 和 Googlebot 无法访问你的网站，搜索也包括在内。）</p>
<p><i>Disallow AI Training</i> 是不影响搜索的选项：Cloudflare 会在你的 robots.txt 中声明不允许训练，继续允许其认定为“Accountable”的爬虫（Apple、Google、Microsoft）用于搜索，并拦截仅用于训练的爬虫，例如 GPTBot、ClaudeBot、Meta-ExternalAgent 和 Amazonbot。</p>
<h2>3. 检查 Cloudflare 自动迁移后的设置</h2>
<p>现有网站已被自动迁移。如果你之前开启了旧的 <i>Block AI bots</i> 开关，现在的设置是：Search 为 <i>Allow</i>，Training 为 <i>Disallow AI Training</i>，Agent 为 <i>Block on pages with ads</i>。含广告网站新接入的域名也会得到同样的预设。其中 Agent 这一项可能会在展示广告的页面上拦截 ChatGPT-User 和 Claude-User。</p>
<h2>4. 排查自定义规则和 Bot Fight Mode</h2>
<ol><li><b>Security rules / WAF custom rules</b>（安全规则 / WAF 自定义规则）：查找使用 <code>cf.verified_bot_category</code>、<code>http.user_agent</code> 或 <code>GPTBot</code> 等爬虫名称的表达式。在新控制项推出之前写的旧规则，可能仍在拦截 AI 搜索爬虫。</li>
<li><b>Bot Fight Mode / Super Bot Fight Mode</b>：这两项可能会对自动化流量发起质询。如果 AI 爬虫收到的是质询页面，请检查这些设置并放行已验证的爬虫。</li>
<li><b>AI Crawl Control</b>（原 AI Audit）：显示哪些 AI 爬虫访问了你的网站，并可单独允许或拦截某个爬虫。请确认你想保留的搜索爬虫在这里没有被设为 Block。</li></ol>
<h2>5. 重新检测</h2>
<p>Cloudflare 的设置几秒内即可生效。再次运行检测，确认 AI 搜索相关各行显示 <i>Reachable</i>（可访问）。</p>`,
    sources: [['https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers', 'Cloudflare blog: Have it both ways (Sep 15, 2026)（Cloudflare 博客，2026 年 9 月 15 日）'], ['https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/', 'Cloudflare docs: Block AI Bots（Cloudflare 文档）'], ['https://developers.cloudflare.com/ai-crawl-control/', 'Cloudflare docs: AI Crawl Control（Cloudflare 文档）']]
  },
  {
    slug: 'cloudfront', name: 'CloudFront / AWS WAF', title: 'CloudFront 或 AWS WAF 拦截了 AI 爬虫：修复方法',
    desc: 'AWS WAF Bot Control 的 CategoryAI 规则连已验证的 AI 爬虫也会拦截。本文说明如何继续拦截 AI 训练，同时放行 AI 搜索爬虫。',
    body: `
<p class="lead l">如果检测报告显示 CloudFront 对 AI 爬虫返回 403，常见原因是你的分发所关联的 Web ACL 中启用了 <b>AWS WAF Bot Control</b> 托管规则组。</p>
<div class="callout"><b>原因。</b>Bot Control 的大多数类别规则只拦截<i>未验证</i>的爬虫，<code>CategoryAI</code> 却不同：AWS 文档写明它 “applies the action to all matches, regardless of whether the bots are verified or unverified.”（对所有匹配项执行该操作，无论爬虫是否已验证。）因此 OAI-SearchBot 和 PerplexityBot 会和训练爬虫一起被拦截。</div>
<h2>1. 找到这条规则</h2>
<ol><li>打开 <b>AWS WAF → Web ACLs</b>（或 protection packs），选择与你的 CloudFront 分发关联的那一个。</li>
<li>找到托管规则组 <code>AWSManagedRulesBotControlRuleSet</code>。</li>
<li>在 <b>Sampled requests</b>（抽样请求）或 WAF 日志中，查找命中 <code>CategoryAI</code>、带有标签 <code>awswaf:managed:aws:bot-control:bot:category:ai</code> 的请求。</li></ol>
<h2>2. 将 CategoryAI 改为 Count</h2>
<p>编辑该规则组，为 <code>CategoryAI</code> 设置 <b>rule action override</b>（规则操作覆盖），改为 <i>Count</i>。请求仍会被打上标签，但这条规则不再拦截任何请求。</p>
<h2>3. 重新加上你真正需要的拦截</h2>
<p>在 Bot Control 规则组<b>之后</b>添加一条自己的规则，匹配标签 <code>awswaf:managed:aws:bot-control:bot:category:ai</code>，并排除你想放行的爬虫。针对 OAI-SearchBot、PerplexityBot、Claude-SearchBot 及其他搜索类爬虫，使用日志中出现的爬虫名称标签（<code>awswaf:managed:aws:bot-control:bot:name:…</code>）。GPTBot、ClaudeBot 等训练爬虫保持拦截。</p>
<p>如果你不想维护 WAF 规则，也可以让 CategoryAI 保持 Count，改用 robots.txt 拒绝训练：</p>
<pre>User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /</pre>
<h2>4. 留意其他信号规则</h2>
<p><code>SignalKnownBotDataCenter</code> 和 <code>SignalNonBrowserUserAgent</code> 只作用于非已验证爬虫的请求。如果真实爬虫能够通过，而我们从数据中心发出的测试仍显示被拦截，报告会因此将该结果标为较低置信度。</p>
<h2>5. 重新检测</h2>
<p>WAF 的修改大约一分钟内生效。再次运行检测即可。</p>`,
    sources: [['https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-bot.html', 'AWS WAF docs: Bot Control rule group（AWS WAF 文档：Bot Control 规则组）']]
  },
  {
    slug: 'wordpress', name: 'WordPress', title: 'ChatGPT 或 Perplexity 看不到你的 WordPress 网站？检查这五个地方',
    desc: 'WordPress 的一项设置、SEO 插件、安全插件或主机商，都可能拦截 AI 爬虫。本文说明如何找出是哪一层，并在不允许 AI 训练的前提下修复。',
    body: `
<p class="lead l">在 WordPress 上，AI 爬虫可能在五个不同的层面被挡在门外。按下面的顺序逐项排查；检测报告会告诉你拦截发生在 robots.txt 还是实际请求中。</p>
<h2>1. “Discourage search engines from indexing this site”（建议搜索引擎不索引本站点）</h2>
<p>在 <b>Settings → Reading</b>（设置 → 阅读）中，这个复选框会要求搜索引擎不要索引本站。测试站上线时常常忘记关闭它。如果报告显示 <i>noindex</i>，请取消勾选。</p>
<h2>2. SEO 插件的 robots.txt 编辑器</h2>
<p>WordPress 提供的是虚拟 robots.txt，Yoast SEO、Rank Math 等 SEO 插件允许在后台编辑它。如果报告显示 robots.txt 禁止了某个 AI 搜索爬虫，先检查这里；也要检查网站根目录下是否有实体 <code>robots.txt</code> 文件，它会覆盖虚拟文件。</p>
<p>如果想拒绝训练但保留在 AI 搜索中，就继续拦截训练爬虫、放行搜索爬虫：</p>
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
<h2>3. 安全插件</h2>
<p>Wordfence、Sucuri、All-In-One Security 等插件可以按 user agent 拦截、对爬虫限速，或拦截“伪造”的爬虫。如果实际请求被拦截而 robots.txt 是允许的，请检查这些插件的黑名单和爬虫规则中是否包含 AI user agent。</p>
<h2>4. “Block AI”类插件</h2>
<p>有些插件会把所有 AI 爬虫都写进 robots.txt，或直接拦截，不区分搜索和训练。如果你在用这类插件，看看它是否支持单独放行搜索爬虫。</p>
<h2>5. 主机商或 CDN</h2>
<p>托管型 WordPress 主机通常有自己的爬虫防护，很多网站也接入了 Cloudflare。如果报告显示请求由 CDN 响应，请参照 <a href="/guides/cloudflare/">Cloudflare 修复指南</a>，或询问主机商是否在边缘节点拦截 AI user agent。</p>`,
    sources: [['https://developers.google.com/search/docs/crawling-indexing/robots/intro', 'Google: Introduction to robots.txt（Google：robots.txt 简介）']]
  },
  {
    slug: 'shopify', name: 'Shopify', title: 'Shopify 与 AI 爬虫：robots.txt.liquid 以及你能控制的部分',
    desc: '如何通过 robots.txt.liquid 调整哪些 AI 爬虫可以访问 Shopify 店铺，让商品页继续出现在 AI 搜索中，以及拦截并非来自你的设置时该怎么办。',
    body: `
<p class="lead l">Shopify 对 AI 爬虫有两层控制：你可以自定义的 robots.txt 文件，以及由 Shopify 统一管理的网络层。</p>
<div class="callout"><b>在 ChatGPT 或 Copilot 上销售？</b>Shopify 通过 Shopify Catalog 向智能体店面同步商品数据，与 robots.txt 无关。拦截爬虫只影响在开放网络上被发现，不影响这些渠道。</div>
<h2>1. 用 robots.txt.liquid 自定义 robots.txt</h2>
<ol><li>在 Shopify 后台进入 <b>Online Store</b>（在线商店）。</li>
<li>在已发布的主题上点击 <b>⋯ → Edit code</b>（编辑代码）。</li>
<li>点击 <b>Add a new template</b>，选择 <b>robots</b>，再点击 <b>Create template</b>。这会创建一个包含 Shopify 默认规则的 <code>robots.txt.liquid</code>。</li>
<li>添加你自己的规则组，保留默认规则，然后保存。</li></ol>
<p>Shopify 建议用 Liquid 添加指令，而不是把模板整个替换成纯文本，这样它的默认规则才能继续自动更新。下面是要添加的规则组的纯文本示例，作用是拒绝训练、保留 AI 搜索：</p>
<pre>User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /</pre>
<p>Shopify 将此视为不受支持的自定义：其支持团队无法协助修改，并提醒错误使用可能导致全部流量丢失。每次修改后都请重新检测。</p>
<h2>2. 实际请求被拦截时</h2>
<p>Shopify 在网络层为所有店铺统一处理爬虫管理，并且不推荐、也不支持在 Shopify 前面加 Cloudflare 之类的代理。如果 robots.txt 允许某个爬虫，而我们的实际请求被拦截，请移除你添加的代理，检查是否有应用加了爬虫防护或地区屏蔽；如果问题仍然存在，请附上报告链接向 Shopify 反馈。</p>
<h2>3. 让商品页可读</h2>
<p>大多数 AI 爬虫不执行 JavaScript。如果报告显示在不运行 JavaScript 时页面文字很少，请确认商品标题、价格和描述写在主题的 HTML 里，而不是在页面加载后由应用注入。</p>`,
    sources: [['https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt', 'Shopify Help: Editing robots.txt.liquid（Shopify 帮助中心：编辑 robots.txt.liquid）']]
  },
  {
    slug: 'edgeone', name: '腾讯云 EdgeOne', title: '腾讯云 EdgeOne 拦截了 AI 爬虫：修复方法',
    desc: 'EdgeOne 的“AI 爬虫处置”按 User-Agent 识别 20 多个 AI 爬虫，名单里包括 AI 搜索用的 PerplexityBot。本文说明怎样拦训练、留搜索。',
    body: `
<p class="lead l">如果报告显示 EdgeOne 对 AI 爬虫返回拦截或挑战，先看“AI 爬虫处置”。它按请求的 User-Agent 识别一份 AI 爬虫名单，设置一个处置方式，对名单里所有爬虫生效。</p>
<div class="callout"><b>要注意的一点。</b>腾讯云公布的识别名单里有 <code>PerplexityBot</code>，它是 Perplexity 的搜索爬虫。把 AI 爬虫处置设成“拦截”，Perplexity 搜索也就看不到你的网站。名单里没有 <code>OAI-SearchBot</code>、<code>Claude-SearchBot</code>，如果它们也被拦，原因在别的规则。</div>
<h2>1. 找到 AI 爬虫处置</h2>
<ol><li>登录 EdgeOne 控制台，<b>服务总览</b> → 选择站点。</li>
<li><b>安全防护 → Web 防护</b>，切到 <b>域名级防护策略</b>，点目标域名。</li>
<li>在 <b>Bot 管理</b> 卡片里进入 <b>基础 Bot 管理 → AI 爬虫处置</b>，点编辑。</li></ol>
<p>处置方式有观察、拦截、放行、JavaScript 挑战、托管挑战。大多数 AI 爬虫不执行 JavaScript，JavaScript 挑战和托管挑战对它们等同于拦截。</p>
<h2>2. 拦训练、留搜索</h2>
<p>腾讯云文档列出的名单包括 GPTBot、ClaudeBot、Google-Extended、Meta-ExternalAgent、PerplexityBot、pangu（华为）等。名单里大部分是训练爬虫，PerplexityBot 是例外。两种做法：</p>
<ul><li><b>想拦训练：</b>AI 爬虫处置设为“拦截”，再加一条 <b>防护例外规则</b>，对 User-Agent 包含 <code>PerplexityBot</code> 的请求跳过 AI 爬虫处置。腾讯云文档写明误拦时用防护例外规则恢复。</li>
<li><b>只想看看：</b>设为“观察”，不影响访问，先看 AI 爬虫的流量。</li></ul>
<p>只按 UA 放行有被伪造的风险。PerplexityBot 公布了 IP 段，需要更严时可以在例外规则里加上 IP 条件。</p>
<h2>3. 排查其他会拦爬虫的地方</h2>
<ol><li><b>Bot 基础特征管理</b>：检查有没有把“来自 IDC（数据中心）的请求”设为拦截或 JavaScript 挑战。AI 爬虫都从数据中心发出请求，这一项会把它们一起拦掉。搜索引擎特征规则应设为放行。</li>
<li><b>Bot 智能分析</b>：确认“正常 Bot 请求”不是拦截。</li>
<li><b>自定义规则</b>：查 UA 黑名单、区域封禁。只允许中国大陆访问会拦掉海外的 AI 爬虫（OAI-SearchBot、PerplexityBot 等从海外机房发出）。</li></ol>
<p>按腾讯云文档，AI 爬虫处置本身不影响百度、Google 等搜索引擎爬虫，免费套餐也带这个功能。</p>
<h2>4. 重新检测</h2>
<p>保存后再跑一次检测，确认 AI 搜索各行显示“能进”。</p>`,
    sources: [['https://cloud.tencent.com/document/product/1552/127868', '腾讯云文档：EdgeOne AI 爬虫处置（含识别名单）'], ['https://cloud.tencent.com/document/product/1552/98207', '腾讯云文档：Bot 基础特征管理'], ['https://cloud.tencent.com/document/product/1552/93131', '腾讯云文档：防护例外规则'], ['https://cloud.tencent.com/document/product/1552/129054', '腾讯云文档：免费套餐自带 AI 爬虫处置']]
  },
  {
    slug: 'aliyun', name: '阿里云 ESA / CDN', title: '阿里云 ESA 或 CDN 拦截了 AI 爬虫：修复方法',
    desc: '阿里云 ESA 有专门的“AI 爬虫管理”，可以按爬虫逐个拦截或观察，被拦请求默认返回 403。本文说明怎样只拦训练爬虫，并排查 Bots 与 WAF 规则。',
    body: `
<p class="lead l">阿里云边缘安全加速 ESA 把 AI 爬虫单独放在“AI 爬虫管理”里，按爬虫逐个开关。好处是可以只拦训练、不拦搜索；坏处是批量勾选时容易把搜索爬虫一起选上。</p>
<div class="callout"><b>简要做法。</b>在 <b>安全防护 → AI 爬虫管理 → 爬虫客户端</b> 里，只把训练爬虫（GPTBot、ClaudeBot、Google-Extended 等）设为“拦截”，OAI-SearchBot、PerplexityBot、Claude-SearchBot 保持关闭或“观察”。</div>
<h2>1. 检查 AI 爬虫管理</h2>
<ol><li>ESA 控制台 → <b>站点管理</b> → 选择站点。</li>
<li>左侧 <b>安全防护 → AI 爬虫管理</b>，打开 <b>爬虫客户端</b> 页签，列出可管理的爬网程序。</li>
<li>看每个爬虫的 <b>状态</b> 和 <b>处置动作</b>：拦截会拦下该爬虫的所有请求，观察只记录不拦。</li></ol>
<p>被拦的爬虫默认收到 403，可在 <b>设置 → 拦截响应</b> 里改。AI 爬虫管理只在付费套餐（基础版及以上）可用。</p>
<h2>2. 检查 Bots</h2>
<p><b>安全防护 → Bots</b> 的简易模式把流量分为“绝对是 Bot”“可能是 Bot”“已通过验证的 Bot”。阿里云建议对“已通过验证的 Bot”（主要是搜索引擎爬虫）放行。AI 搜索爬虫不一定被算作已验证，如果它们落在“绝对是 Bot”或“可能是 Bot”并被设为拦截或滑块挑战，也会进不来。</p>
<p>阿里云文档给出的优先级是：简易 Bots 配置 &gt; AI 爬虫配置 &gt; 高级 Bots 配置。也就是说，简易模式里的拦截会先于 AI 爬虫管理生效。</p>
<h2>3. 检查 WAF 与自定义规则</h2>
<ol><li>在 WAF 规则里查 User-Agent 黑名单、区域封禁。只允许中国大陆访问会拦掉从海外机房发出的 AI 爬虫。</li>
<li>误拦时可以建白名单规则，让特定 UA 或 IP 跳过 Bots 检查。只按 UA 放行容易被伪造，能用官方 IP 段更好。</li>
<li>用的是老版阿里云 CDN / DCDN 加 WAF 的，同样在 WAF 的 Bot 管理和自定义规则里查。</li></ol>
<h2>4. 重新检测</h2>
<p>改完再跑一次检测，确认 AI 搜索各行显示“能进”。</p>`,
    sources: [['https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/ai-crawler-management/', '阿里云文档：什么是 AI 爬虫管理（含与 Bots 的优先级）'], ['https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/ai-crawl-get-started', '阿里云文档：AI 爬虫管理快速上手'], ['https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/bots', '阿里云文档：Bots 快速上手']]
  },
  {
    slug: 'baota', name: '宝塔面板', title: '宝塔 Nginx 防火墙拦了 ChatGPT、Perplexity 爬虫？检查这四个地方',
    desc: '宝塔 Nginx 防火墙默认放行国内外主要搜索引擎蜘蛛，但不认识 OAI-SearchBot 等 AI 爬虫，“非浏览器拦截”“禁止海外访问”都会拦它们。本文说明怎样放行。',
    body: `
<p class="lead l">宝塔 Nginx 防火墙会放行百度、谷歌、必应、360、搜狗、头条、神马等搜索引擎蜘蛛，但它的蜘蛛名单里没有 OAI-SearchBot、PerplexityBot 这类 AI 搜索爬虫。宝塔官方论坛里已有站长反馈 OAI-SearchBot、Applebot 被防火墙封掉。</p>
<div class="callout"><b>简要做法。</b>宝塔官方客服的建议是：需要放行的爬虫，把 UA 加入 <b>UA 白名单</b>；被“禁止海外访问”误拦的，把爬虫 IP 段加入 <b>IP 白名单</b>，IP 白名单优先级最高。</div>
<h2>1. 非浏览器拦截</h2>
<p>宝塔的说明是：这项“拦截非浏览器请求，通过 UA 判断是否是爬虫”，并说明“不会拦截真实的蜘蛛爬虫”。AI 爬虫不在它的蜘蛛名单里，很可能被当作非浏览器请求拦掉。要么关掉这项，要么把 AI 搜索爬虫加进 UA 白名单。</p>
<h2>2. 禁止海外访问</h2>
<p>OAI-SearchBot、PerplexityBot、Claude-SearchBot 都从海外机房发出请求。开了“禁止海外访问”，它们基本进不来。宝塔官方论坛 2026 年 9 月的答复还提到，“蜘蛛 IP 放行”和“禁止海外访问”存在冲突（已知问题），连 Googlebot 也会时拦时放，建议把爬虫 IP 段加到 IP 白名单（路径：安全 → Nginx 防火墙 → 全局配置 → IP 白名单）。</p>
<p>IP 段以爬虫官方公布的为准，例如 OpenAI 的 <code>searchbot.json</code>、<code>chatgpt-user.json</code>，各爬虫的出处见 <a href="/bots/">AI 爬虫百科</a>。</p>
<h2>3. UA 白名单与 UA 黑名单</h2>
<p>宝塔的规则顺序里，UA 白名单排在大多数拦截规则之前。白名单按关键词匹配，填 <code>OAI-SearchBot</code>、<code>PerplexityBot</code>、<code>Claude-SearchBot</code>、<code>ChatGPT-User</code> 即可。同时检查 UA 黑名单和“User-Agent 过滤”里有没有 <code>bot</code>、<code>spider</code>、<code>python</code> 这类宽泛关键词，它们会误伤。</p>
<p>注意：宝塔说明里写明 UA 白名单命中后“直接跳过任何拦截”，包括 CC 防御。UA 可以伪造，所以只填具体的爬虫名，不要填 <code>bot</code> 这样的宽泛词；更稳妥的是 IP 白名单。</p>
<h2>4. 伪静态与 Nginx 配置</h2>
<p>很多站长按网上教程在 <b>网站 → 设置 → 伪静态</b> 或配置文件里写了 <code>if ($http_user_agent ~* "GPTBot|ChatGPT|Perplexity|...")</code> 返回 403 或 444 的规则。这类规则常把 <code>ChatGPT</code>、<code>Perplexity</code> 这样的宽泛词写进去，会连 ChatGPT-User、PerplexityBot 一起拦。只想拦训练的话，改成只匹配 <code>GPTBot</code>、<code>ClaudeBot</code>、<code>CCBot</code>、<code>Google-Extended</code> 等训练爬虫，或者干脆改用 robots.txt。</p>
<h2>5. 重新检测</h2>
<p>改完保存，再跑一次检测，确认 AI 搜索各行显示“能进”。宝塔防火墙的“封锁历史”里也能看到被拦的 UA 和原因。</p>`,
    sources: [['https://www.bt.cn/bbs/thread-132479-1-1.html', '宝塔官方论坛：Nginx 防火墙针对蜘蛛的规则说明（2024）'], ['https://www.bt.cn/bbs/thread-146016-1-1.html', '宝塔官方论坛：蜘蛛池缺少 ChatGPT 等，官方答复加 UA 白名单（2025）'], ['https://www.bt.cn/bbs/thread-155793-1-1.html', '宝塔官方论坛：Nginx 防火墙拦截爬虫，官方答复加 IP 白名单（2026-09）'], ['https://www.bt.cn/bbs/thread-73847-1-1.html', '宝塔官方论坛：Nginx 网站防火墙使用说明'], ['https://openai.com/searchbot.json', 'OpenAI：OAI-SearchBot IP 段']]
  }
];

// 正文不含面包屑、<main> 外壳和文末的 checkBox()/CHECK_JS，由构建脚本拼接。
export const RESEARCH_ZH = {
  title: '防火墙静默拦截 AI 搜索爬虫有多常见？2026 年 11 月抽样 · VAKSEL',
  desc: '从 Tranco 前 2 万名中随机抽取 600 个网站，其中 362 个可访问：45 个拒绝了 robots.txt 允许的 AI 搜索爬虫 user agent，其中 13 个是专门针对 AI 爬虫的拦截。附方法、定义和局限。',
  h1: '防火墙静默拦截 AI 搜索爬虫有多常见？',
  upd: '抽样时间：2026 年 11 月 1 日',
  body: `
<p class="lead l">在对热门网站的随机抽样中，约每 28 个可访问网站就有 1 个在防火墙层拒绝了 AI 搜索爬虫的 user agent，且拦截专门针对 AI 爬虫，而 robots.txt 是允许它们访问的。</p>
<div class="facts"><div><span>抽样</span><b>600 个网站</b></div><div><span>可访问</span><b>362</b></div><div><span>至少拒绝一个 AI 搜索 UA</span><b>45（12.4%）</b></div><div><span>专门针对 AI 爬虫</span><b>13（3.6%）</b></div></div>
<h2>样本</h2>
<p>从 Tranco 前 20,000 名列表中随机抽取 600 个域名。如果从我们的服务器以普通浏览器请求其首页返回 HTTP 200，即计为<b>可访问</b>：600 个中有 362 个。其余 238 个被排除，因为连浏览器请求都没有拿到正常页面：125 个连接失败或超时（其中很多是没有公开网站的 CDN、广告或 API 域名），80 个返回 403/401/503 或质询页面，33 个返回其他状态码，例如 404。对这些网站，无法单独判断爬虫的情况。</p>
<h2>第 1 步：user agent 请求</h2>
<p>对每个可访问网站，我们获取 robots.txt，并分别以四个 AI 搜索及用户触发类爬虫的 user agent 请求首页：OAI-SearchBot、ChatGPT-User、PerplexityBot 和 Claude-SearchBot。当某个请求得到 4xx/5xx 状态码或质询页面，而浏览器请求得到 200 时，计为<b>被拒绝</b>。</p>
<p>45 个网站（占可访问网站的 12.4%）在 robots.txt 允许的情况下，至少拒绝了四者之一。我们称之为<b>静默拦截</b>：robots.txt 中没有任何内容提醒站长。这 45 个中有 26 个由 Cloudflare 提供服务。</p>
<h2>第 2 步：对照组</h2>
<p>我们在同一天对这 45 个网站重新测试，加入两个对照：一个使用 Googlebot 的 user agent，一个来自未知爬虫。这样可以区分三种不同的原因：</p>
<table class="tbl"><thead><tr><th>对照组结果</th><th>可能原因</th><th>网站数</th></tr></thead><tbody>
<tr><td>Googlebot user agent 同样被拒绝</td><td>网站会验证爬虫 IP 地址，拒绝从不对应网络冒用爬虫名称的请求。真实的 AI 爬虫很可能可以通过。</td><td>29</td></tr>
<tr><td>未知爬虫被拒绝，Googlebot 被允许</td><td>通用的爬虫规则</td><td>1</td></tr>
<tr><td>重新测试未复现</td><td>限速或临时规则</td><td>2</td></tr>
<tr><td>浏览器、Googlebot 和未知爬虫均被允许；AI 搜索 UA 被拒绝</td><td>专门针对 AI 爬虫的规则</td><td><b>13</b></td></tr>
</tbody></table>
<p>这 13 个网站占可访问网站的 3.6%，约 28 个中有 1 个。例子包括 toyota.com、smithsonianmag.com 和 torontosun.com；13 个中有 7 个由 Cloudflare 提供服务。</p>
<h2>局限</h2>
<ul><li>所有请求都来自同一台数据中心服务器。真实爬虫来自其运营方自己的 IP 段，外部测试者无法使用。如果网站的规则放行已验证的爬虫 IP，即使我们的请求被拒绝，真实爬虫也能通过；对照组正是为了标记这类情况，但无法完全排除。</li>
<li>我们只测试了首页。网站对其他路径可能有不同处理。</li>
<li>规则会变化。结果反映的是网站在 2026 年 11 月 1 日的状态；首页上的链接会重新运行检测。</li>
<li>600 是一个较小的样本。请将 12.4% 和 3.6% 视为估计值，误差约为几个百分点。</li></ul>
<h2>亚洲网站</h2>
<p>我们对 1,000 个热门中文网站做了同样的测试。静默拦截更少见：第 1 步为可访问网站的 3.7%，第 2 步约为 0.8%。</p>`
};

export const PRIVACY_ZH = {
  title: '隐私政策 · VAKSEL',
  desc: '你运行检测或加入抢先体验名单时，我们收集哪些信息，以及不收集哪些信息。',
  h1: '隐私政策',
  body: `
<p class="lead l">我们尽可能少地收集信息。运行检测无需注册账号，不设置 Cookie，也不使用广告追踪。llms.txt 工具页、调查报告和旧版指南页使用自托管的 Umami 统计访问量，它不设置 Cookie，也不识别个人身份。</p>
<h2>当你检测一个域名时</h2>
<ul><li>我们的服务器会请求该域名的公开文件：<code>robots.txt</code>、<code>llms.txt</code> 和首页。这些请求由我们发出，而不是由你的浏览器发出。</li>
<li>我们不保存你检测的域名，也不保存你的 IP 地址。你的 IP 地址只会被短暂用于请求限速，随后即被丢弃。</li>
<li>每个检测结果以域名为键缓存约五分钟，以免重复检测再次访问该网站。报告的分享图片最多缓存一小时。</li></ul>
<h2>当你加入抢先体验名单或联系我们时</h2>
<ul><li>我们会保存你填写的邮箱地址、方案和网站，你发送的留言（如有），以及请求来源的国家或地区（由我们的托管服务商提供）。我们不保存你的 IP 地址。</li>
<li>这些信息仅用于在你的账号就绪时通知你，以及回复你。我们不会出售这些信息，也不会将其用于营销或分享给他人。</li>
<li>如需删除你的信息，请用同一邮箱通过<a href="/contact/">联系表单</a>提交请求。我们会在 30 天内删除。</li></ul>
<h2>服务提供商</h2>
<p>本站运行在 Cloudflare 上（托管、缓存和存储）。当某个网站屏蔽 Cloudflare 的网络时，部分检测会经由我们自己的服务器发出。Cloudflare 依据其<a href="https://www.cloudflare.com/privacypolicy/" rel="noopener" target="_blank">隐私政策</a>处理请求。</p>
<h2>变更</h2>
<p>如果本政策有变更，我们会更新页面顶部的日期。如果开始收集新的信息，我们会先在这里说明。</p>`
};

export const TERMS_ZH = {
  title: '使用条款 · VAKSEL',
  desc: '使用 VAKSEL AI 爬虫访问检测服务的条款。',
  h1: '使用条款',
  body: `
<h2>使用检测服务</h2>
<ul><li>请检测你拥有、管理或有正当理由查看的网站。不得使用本服务对网站进行压力测试、扫描或攻击。</li>
<li>检测有频率限制。请勿通过自动化手段或多个网络绕过限制。</li></ul>
<h2>检测结果的含义</h2>
<p>检测结果是我们在检测当时的最佳判断。我们从数据中心 IP 地址、以各爬虫的 user agent 发起测试，而不是从爬虫自己的网络发起，因此会验证爬虫 IP 地址的网站可能会以不同方式对待真实爬虫。正因如此，每个结果都会标注置信度。爬虫说明以各运营方截至所示日期的公开文档为准。</p>
<h2>免责声明</h2>
<p>本服务按“现状”提供，不作任何形式的保证。在法律允许的范围内，我们不对依据报告作出的决定，或因使用本服务产生的任何损失承担责任。</p>
<h2>付费方案</h2>
<p>监测方案目前处于抢先体验阶段。加入名单不代表你需要付费。付费方案开放时，我们会在你订阅前展示其条款和价格。</p>
<h2>变更与联系</h2>
<p>我们可能会更新这些条款，页面顶部的日期即为最新版本日期。如有疑问，请使用<a href="/contact/">联系表单</a>。</p>`
};

export const CONTACT_ZH = {
  title: '联系我们 · VAKSEL',
  desc: '向 VAKSEL 提问、提交数据请求或反馈意见。',
  h1: '联系我们',
  lead: '关于检测报告的问题、数据删除请求，或建议我们新增的爬虫。我们会通过邮件回复。',
  labels: { email: '你的邮箱', topic: '主题', message: '留言', send: '发送' },
  topics: { question: '关于报告的问题', data: '删除我的数据', feedback: '反馈或建议新增爬虫', other: '其他' },
  msgs: {
    ok: '谢谢，我们会通过邮件回复你。',
    bad_email: '邮箱格式似乎不正确。',
    rate_limited: '尝试次数过多，请稍等一分钟。',
    empty: '请填写留言内容。',
    error: '出了点问题，请重试。',
    network: '网络错误，请重试。'
  }
};

export const HOME_FAQ_ZH = [
  ['有 robots.txt 不就够了吗？', 'robots.txt 只是一种请求。真正决定哪些请求能通过的是你的 CDN、防火墙或安全插件，它们可能会拒绝 robots.txt 明明欢迎的爬虫。这正是我们检测的静默拦截。'],
  ['允许 AI 搜索，会让我的内容被用于训练吗？', '不会。在 OpenAI、Anthropic、Perplexity、Apple 和 Google，搜索和训练使用的是不同的爬虫。例如，你可以允许 OAI-SearchBot，同时拦截 GPTBot。我们的修复指南介绍了在各个平台上的设置方法。'],
  ['从数据中心发起的测试有多准确？', '真实爬虫来自它们自己的 IP 段，我们无法使用。因此每次测试都带有对照组（普通浏览器、Googlebot 和未知爬虫），每个结果都标注置信度。']
];

// 中文版定价尚未确定：不出现任何具体价格。
export const PRICING_FAQ_ZH = [
  ['监测会检查什么？', '与免费检测相同的三个层面（robots.txt、以各 AI 搜索爬虫身份发起并带对照组的实际请求，以及页面可读性），按每日计划执行。结果发生变化时你会收到邮件，例如某次 CDN 更新开始拦截 OAI-SearchBot。'],
  ['什么时候上线？', '监测功能目前处于抢先体验阶段。加入名单后，账号就绪时我们会发邮件通知你。中文版价格尚未公布，价格公布并经你确认订阅之前，不会收取任何费用。'],
  ['为什么我的网站会自己开始拦截 AI 爬虫？', 'CDN 的默认设置会变化（Cloudflare 在 2026 年 9 月 15 日调整了 AI 爬虫控制项），安全插件会更新爬虫名单，改版时 robots.txt 也可能被修改。这些变化都不会通知你。'],
  ['你们是从爬虫的真实 IP 地址测试的吗？', '这些公司以外的人都做不到。我们从数据中心以各爬虫的 user agent 测试，并与普通浏览器、Googlebot 和未知爬虫的结果对比。这样可以区分专门针对 AI 的拦截和通用的爬虫验证规则，报告会标注每个结果的置信度。']
];

export const EXAMPLES_ZH = [
  ['toyota.com', '静默拦截', 'v-bad', 'CloudFront 拒绝了 OAI-SearchBot 和 PerplexityBot，浏览器和 Googlebot 可以正常访问。'],
  ['smithsonianmag.com', '全部拦截', 'v-bad', 'Cloudflare 拒绝了我们发出的全部 8 个 AI 搜索及用户触发类爬虫。'],
  ['torontosun.com', '静默拦截', 'v-bad', '8 个 AI 搜索爬虫中有 6 个被拒绝，而 robots.txt 允许它们访问。']
];
