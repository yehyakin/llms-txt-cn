/* en/seo-view.js — “能不能读 / 能不能被引用”两层检查的展示（中英双语，纯字符串，Worker 与浏览器共用） */
const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const G = 'https://developers.google.com/search/docs/';
export const REFS = {
  title: G + 'appearance/title-link', description: G + 'appearance/snippet', indexable: G + 'appearance/ai-features',
  canonical: G + 'crawling-indexing/consolidate-duplicate-urls', text: G + 'appearance/ai-features', sitemap: G + 'crawling-indexing/sitemaps/overview',
  links: G + 'crawling-indexing/links-crawlable', alt: G + 'appearance/google-images', hreflang: G + 'specialty/international/localized-versions',
  viewport: G + 'crawling-indexing/mobile/mobile-sites-mobile-first-indexing', jsonld: G + 'appearance/structured-data/sd-policies',
  entity: G + 'appearance/structured-data/organization', sitename: G + 'appearance/site-names', dates: G + 'appearance/publication-dates', faq: G + 'appearance/structured-data/sd-policies'
};
const ZH = {
  layers: { read: ['能不能读', 'AI 和搜索引擎拿到你的首页后，能不能读懂、能不能收录'], cite: ['能不能被引用', '让 AI 回答时更容易认出你、引用你的信号'] },
  basis: { official: '官方文档', common: '业界常用', hypothesis: '推测' },
  st: { pass: '通过', warn: '待改', fail: '问题', info: '提示' },
  counts: (c) => `通过 ${c.pass} · 待改 ${c.warn} · 问题 ${c.fail}`,
  note: 'Google 官方说明：出现在 AI 概览里没有额外要求，也不需要专门的 AI 文件或标记；页面能被收录、能显示摘要即可。所以这里只列能验证的事实，标“推测”的仅供参考。',
  fail: '没拿到首页 HTML，这两层检查跳过了。',
  doc: '文档',
  c: {
    title: ['页面标题', (s, d) => !d.title ? '首页没有 &lt;title&gt;。' : `“${E(d.title)}”${s === 'warn' ? (d.width < 10 ? '，太短，说不清这是什么网站。' : '，偏长，搜索结果里会被截断。') : '。'}`],
    description: ['页面描述', (s, d) => !d.desc ? '没有 meta description，摘要只能由引擎自己从正文里截。' : `“${E(d.desc.slice(0, 80))}${d.desc.length > 80 ? '…' : ''}”${s === 'warn' ? (d.width < 50 ? '，偏短。' : '，偏长。') : '。'}`],
    indexable: ['允许收录和摘要', (s, d) => d.noindex ? '页面带 <code>noindex</code>，不会被收录，也就不会出现在 AI 概览里。' : d.nosnippet ? '页面带 <code>nosnippet</code> 或 <code>max-snippet:0</code>。Google 写明：AI 概览只引用能显示摘要的页面。' : '没有 noindex / nosnippet。'],
    canonical: ['规范网址', (s, d) => d.count > 1 ? `有 ${d.count} 个 canonical，引擎会全部忽略。只留一个。` : !d.count ? '没有 canonical。带参数的网址可能被当成重复页。' : d.otherHost ? `canonical 指向另一个域名 ${E(d.otherHost)}，首页的权重会被让给它。确认是不是故意的。` : `指向 ${E(d.href)}。`],
    text: ['不跑 JS 的正文', (s, d) => `不执行 JavaScript 时能读到 ${d.chars.toLocaleString()} 个字符。` + (s === 'fail' ? (d.spa ? '页面是前端渲染的空壳，大多数 AI 爬虫不跑 JS，什么也读不到。改用服务端渲染或静态生成。' : '内容太少，AI 爬虫读不到要点。') : s === 'warn' ? '偏少，关键介绍最好直接写在 HTML 里。' : '')],
    h1: ['一级标题', (s, d) => !d.count ? '没有 &lt;h1&gt;。' : d.count === 1 ? `“${E(d.first)}”。` : `有 ${d.count} 个 &lt;h1&gt;，主题不够集中。`],
    sitemap: ['站点地图', (s, d) => !d.url ? '没能检查。' : d.status === 200 && s === 'pass' ? `${d.declared ? 'robots.txt 里声明了' : '找到了'} ${E(d.url)}。` : `${d.declared ? 'robots.txt 声明的' : '默认位置'} ${E(d.url)} ${d.status === 200 ? '返回的不是 XML 站点地图。' : '没拿到站点地图（' + E(d.status) + '）。'}`],
    links: ['站内链接', (s, d) => `首页有 ${d.internal} 个站内链接。` + (s === 'warn' ? '太少，爬虫很难从首页发现其他页面。' : '')],
    alt: ['图片说明 alt', (s, d) => !d.images ? '首页 HTML 里没有图片。' : `${d.images} 张图里 ${d.withAlt} 张写了 alt。`],
    hreflang: ['多语言 hreflang', (s, d) => d.bad && d.bad.length ? `语言代码写错了：${d.bad.map(E).join('、')}。` : !d.self ? `有 ${d.count} 条 hreflang，但没有指向本页自己的那条。` : `${d.count} 条，${d.xdefault ? '含 x-default。' : '没有 x-default。'}`],
    viewport: ['移动端适配', (s) => s === 'pass' ? '有 viewport 设置。' : '没有 viewport，手机上会按桌面版缩放。'],
    jsonld: ['结构化数据', (s, d) => d.errors ? `${d.blocks} 段 JSON-LD 里有 ${d.errors} 段解析失败，引擎会直接忽略。` : !d.blocks ? '没有 JSON-LD。不是必需的，但能帮引擎确认你是谁。' : `${d.blocks} 段，类型：${d.types.map(E).join('、') || '无'}。`],
    entity: ['机构信息', (s, d) => d.none ? '没有 Organization 标记。加上名称、网址、logo，能帮引擎把网站和品牌对上。' : !d.name ? 'Organization 没写 name。' : !d.visible ? `标记里的名称“${E(d.name)}”在页面上找不到。Google 要求结构化数据和页面可见内容一致。` : `“${E(d.name)}”${d.logo ? '，有 logo' : '，缺 logo'}${d.sameAs ? `，sameAs ${d.sameAs} 个` : ''}。`],
    faq: ['FAQ 标记', (s, d) => !d.questions ? 'FAQPage 标记里没有问题。' : d.missing ? `FAQPage 标记了 ${d.questions} 个问题，其中 ${d.missing} 个在页面上找不到${d.examples && d.examples.length ? '（如“' + E(d.examples[0]) + '”）' : ''}。Google 要求标记的内容对用户可见，否则可能被当作违规。` : `FAQPage 标记的 ${d.questions} 个问题都在页面上。`],
    sitename: ['网站名称', (s, d) => d.name ? `“${E(d.name)}”。` : '没有 WebSite 标记或 og:site_name，搜索结果里的网站名只能由引擎猜。'],
    dates: ['发布与更新日期', (s, d) => d.published || d.modified ? `${d.published ? '发布 ' + E(d.published) : ''}${d.published && d.modified ? '，' : ''}${d.modified ? '更新 ' + E(d.modified) : ''}。` : d.timeTag ? '页面里有 &lt;time&gt;，但没有结构化的发布/更新日期。首页通常不需要，文章页需要。' : '首页没有日期信号。首页通常不需要，文章页需要。'],
    author: ['作者信息', (s, d) => d.author ? `“${E(d.author)}”。` : '首页没有作者信息。文章页建议写明作者。'],
    answers: ['问答式段落', (s, d) => !d.questions ? '首页没有问句式小标题。常见问题可以写成“问题小标题 + 第一段直接回答”。' : `${d.questions} 个问句式小标题，${d.answered} 个后面紧跟直接回答${d.examples && d.examples.length ? '（如“' + E(d.examples[0]) + '”）' : ''}。`],
    semantic: ['语义标签', (s) => s === 'pass' ? '用了 &lt;main&gt; 或 &lt;article&gt;，正文容易定位。' : '没有 &lt;main&gt; / &lt;article&gt;，正文和导航混在一起。'],
    og: ['分享卡片', (s, d) => d.title && d.image ? '有 og:title 和 og:image。' : `缺${!d.title ? ' og:title' : ''}${!d.image ? ' og:image' : ''}，被转发时卡片不完整。`],
    llms: ['llms.txt', (s, d) => d.verdict === 'real' ? '有。Google 明确说不需要；其他 AI 是否读取没有公开说明。' : d.verdict === 'html_spoof' ? '/llms.txt 返回的是网页，不是文本。要么放真文件，要么让它 404。' : '没有。Google 明确说不需要；其他 AI 是否读取没有公开说明，可有可无。']
  }
};
const EN = {
  layers: { read: ['Can they read it', 'Whether search engines and AI can parse and index your homepage'], cite: ['Can they cite it', 'Signals that help AI recognize and quote you'] },
  basis: { official: 'Official docs', common: 'Common practice', hypothesis: 'Hypothesis' },
  st: { pass: 'Pass', warn: 'Improve', fail: 'Problem', info: 'Note' },
  counts: (c) => `${c.pass} pass · ${c.warn} to improve · ${c.fail} problems`,
  note: 'Google says there are no extra requirements for AI Overviews and no special AI files or markup are needed: the page must be indexed and eligible for a snippet. So we list facts you can verify, and anything marked “Hypothesis” is only a suggestion.',
  fail: 'We couldn’t get the homepage HTML, so these checks were skipped.',
  doc: 'Docs',
  c: {
    title: ['Page title', (s, d) => !d.title ? 'The homepage has no &lt;title&gt;.' : `“${E(d.title)}”${s === 'warn' ? (d.width < 10 ? ': too short to say what the site is.' : ': long, it will be cut off in results.') : '.'}`],
    description: ['Meta description', (s, d) => !d.desc ? 'No meta description, so engines pick a snippet from the body.' : `“${E(d.desc.slice(0, 90))}${d.desc.length > 90 ? '…' : ''}”${s === 'warn' ? (d.width < 50 ? ': short.' : ': long.') : '.'}`],
    indexable: ['Indexing and snippets allowed', (s, d) => d.noindex ? 'The page has <code>noindex</code>, so it won’t be indexed or shown in AI Overviews.' : d.nosnippet ? 'The page has <code>nosnippet</code> or <code>max-snippet:0</code>. Google says AI Overviews only link pages eligible for a snippet.' : 'No noindex or nosnippet.'],
    canonical: ['Canonical URL', (s, d) => d.count > 1 ? `${d.count} canonical tags: engines ignore them all. Keep one.` : !d.count ? 'No canonical. URLs with parameters may be treated as duplicates.' : d.otherHost ? `Canonical points to another host, ${E(d.otherHost)}. Make sure that’s intended.` : `Points to ${E(d.href)}.`],
    text: ['Text without JavaScript', (s, d) => `${d.chars.toLocaleString()} characters are readable without JavaScript. ` + (s === 'fail' ? (d.spa ? 'This is a client-rendered shell; most AI crawlers don’t run JavaScript and see nothing. Use SSR or static generation.' : 'Too little for AI crawlers to learn what you do.') : s === 'warn' ? 'On the thin side; put your key description in the HTML.' : '')],
    h1: ['H1 heading', (s, d) => !d.count ? 'No &lt;h1&gt;.' : d.count === 1 ? `“${E(d.first)}”.` : `${d.count} &lt;h1&gt; tags; the topic is less clear.`],
    sitemap: ['Sitemap', (s, d) => !d.url ? 'Not checked.' : s === 'pass' ? `${d.declared ? 'Declared in robots.txt' : 'Found'}: ${E(d.url)}.` : `${d.declared ? 'The sitemap declared in robots.txt' : 'The default location'}, ${E(d.url)}, ${d.status === 200 ? 'doesn’t return an XML sitemap.' : 'returned ' + E(d.status) + '.'}`],
    links: ['Internal links', (s, d) => `${d.internal} internal links on the homepage.` + (s === 'warn' ? ' Too few for crawlers to discover your other pages.' : '')],
    alt: ['Image alt text', (s, d) => !d.images ? 'No images in the homepage HTML.' : `${d.withAlt} of ${d.images} images have alt text.`],
    hreflang: ['hreflang', (s, d) => d.bad && d.bad.length ? `Invalid language codes: ${d.bad.map(E).join(', ')}.` : !d.self ? `${d.count} hreflang links, but none points to this page itself.` : `${d.count} links${d.xdefault ? ', with x-default.' : ', no x-default.'}`],
    viewport: ['Mobile viewport', (s) => s === 'pass' ? 'Viewport is set.' : 'No viewport; phones will show a zoomed-out desktop page.'],
    jsonld: ['Structured data', (s, d) => d.errors ? `${d.errors} of ${d.blocks} JSON-LD blocks fail to parse and will be ignored.` : !d.blocks ? 'No JSON-LD. Not required, but it helps engines confirm who you are.' : `${d.blocks} block${d.blocks > 1 ? 's' : ''}: ${d.types.map(E).join(', ') || 'no types'}.`],
    entity: ['Organization', (s, d) => d.none ? 'No Organization markup. Name, URL and logo help engines tie the site to your brand.' : !d.name ? 'Organization has no name.' : !d.visible ? `The marked-up name “${E(d.name)}” doesn’t appear on the page. Google requires structured data to match visible content.` : `“${E(d.name)}”${d.logo ? ', with logo' : ', no logo'}${d.sameAs ? `, ${d.sameAs} sameAs` : ''}.`],
    faq: ['FAQ markup', (s, d) => !d.questions ? 'The FAQPage markup has no questions.' : d.missing ? `${d.missing} of ${d.questions} FAQPage questions aren’t on the page${d.examples && d.examples.length ? ' (e.g. “' + E(d.examples[0]) + '”)' : ''}. Google requires marked-up content to be visible; hidden markup can be treated as spam.` : `All ${d.questions} FAQPage questions appear on the page.`],
    sitename: ['Site name', (s, d) => d.name ? `“${E(d.name)}”.` : 'No WebSite markup or og:site_name, so engines guess your site name.'],
    dates: ['Published and updated dates', (s, d) => d.published || d.modified ? `${d.published ? 'Published ' + E(d.published) : ''}${d.published && d.modified ? ', ' : ''}${d.modified ? 'updated ' + E(d.modified) : ''}.` : d.timeTag ? 'A &lt;time&gt; tag but no structured dates. Homepages rarely need them; articles do.' : 'No date signals. Homepages rarely need them; articles do.'],
    author: ['Author', (s, d) => d.author ? `“${E(d.author)}”.` : 'No author on the homepage. Name authors on articles.'],
    answers: ['Question-and-answer sections', (s, d) => !d.questions ? 'No question-style headings. FAQs work well as a question heading followed by a direct answer.' : `${d.questions} question headings, ${d.answered} followed by a direct answer${d.examples && d.examples.length ? ' (e.g. “' + E(d.examples[0]) + '”)' : ''}.`],
    semantic: ['Semantic tags', (s) => s === 'pass' ? 'Uses &lt;main&gt; or &lt;article&gt;, so the main content is easy to find.' : 'No &lt;main&gt; or &lt;article&gt;; content and navigation are mixed.'],
    og: ['Share card', (s, d) => d.title && d.image ? 'Has og:title and og:image.' : `Missing${!d.title ? ' og:title' : ''}${!d.image ? ' og:image' : ''}; shared links show an incomplete card.`],
    llms: ['llms.txt', (s, d) => d.verdict === 'real' ? 'Present. Google says it isn’t needed; other AI providers haven’t said whether they read it.' : d.verdict === 'html_spoof' ? '/llms.txt returns a web page, not text. Serve a real file or let it 404.' : 'None. Google says it isn’t needed; other AI providers haven’t said whether they read it. Optional.']
  }
};
const TAG = { pass: 't-ok', warn: 't-warn', fail: 't-bad', info: 't-gray' };
const ORDER = { fail: 0, warn: 1, pass: 2, info: 3 };
export const seoLabel = (id, lang) => { const L = lang === 'zh' ? ZH : EN; return L.c[id] ? L.c[id][0] : id; };
export function renderSeo(seo, lang) {
  const L = lang === 'zh' ? ZH : EN;
  if (!seo) return '';
  if (!seo.ok) return '<div class="panel seo"><h3>' + L.layers.read[0] + ' · ' + L.layers.cite[0] + '</h3><p class="seo-skip">' + L.fail + '</p></div>';
  const layer = (k) => {
    const list = seo.checks.filter((c) => c.layer === k && L.c[c.id]).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    const cnt = { pass: 0, warn: 0, fail: 0, info: 0 }; list.forEach((c) => cnt[c.status]++);
    return '<div class="panel seo" id="seo-' + k + '"><h3>' + L.layers[k][0] + ' <span>' + L.counts(cnt) + '</span></h3><p class="seo-sub">' + L.layers[k][1] + '</p><ul class="seol">' +
      list.map((c) => { const [label, fn] = L.c[c.id]; const ref = REFS[c.id];
        return '<li class="s-' + c.status + '"><span class="tag ' + TAG[c.status] + '">' + L.st[c.status] + '</span><div><b>' + label + '</b><p>' + fn(c.status, c.data) + '</p></div><span class="bs b-' + c.basis + '">' +
          (ref && c.basis === 'official' ? '<a href="' + ref + '" target="_blank" rel="noopener">' + L.basis[c.basis] + ' ↗</a>' : L.basis[c.basis]) + '</span></li>'; }).join('') + '</ul></div>';
  };
  return layer('read') + layer('cite') + '<p class="seo-note">' + L.note + '</p>';
}
