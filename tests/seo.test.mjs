import { analyzePage, width, visibleText } from '../worker/seo.js';
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : (fail++, console.log('FAIL', name)); };
const get = (r, id) => r.checks.find((c) => c.id === id);
const para = '这是一段足够长的正文内容，用来模拟真实网站首页上可见的文字，'.repeat(20);
const good = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>示例公司 - 专业的云存储服务</title>
<meta name="description" content="示例公司提供面向中小企业的云存储、备份与文件同步服务，支持多地域容灾和按量计费，十分钟即可上手。">
<meta name="viewport" content="width=device-width"><link rel="canonical" href="https://www.example.com/">
<link rel="alternate" hreflang="zh-CN" href="https://www.example.com/"><link rel="alternate" hreflang="x-default" href="https://www.example.com/">
<meta property="og:title" content="示例公司"><meta property="og:image" content="https://www.example.com/og.png"><meta property="og:site_name" content="示例公司">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"示例公司","url":"https://www.example.com/","logo":"https://www.example.com/l.png","sameAs":["https://weibo.com/x"]},{"@type":"WebSite","name":"示例公司"}]}</script>
</head><body><main><h1>示例公司云存储</h1><p>${para}</p>
<h2>什么是对象存储？</h2><p>对象存储是一种把文件当作对象来管理的存储方式，适合图片、视频和备份等海量数据。</p>
<h2>价格怎么算？</h2><p>按实际使用的容量和流量计费，没有最低消费，每月账单可在控制台随时查看。</p>
${[1,2,3,4,5,6].map(i=>`<a href="/p${i}">页面${i}</a>`).join('')}<img src="a.png" alt="架构图"></main></body></html>`;
let r = analyzePage({ html: good, url: 'https://www.example.com/', sitemap: { ok: true, declared: true, url: 'https://www.example.com/sitemap.xml', status: 200 }, llms: 'missing' });
t('good: no fails', r.counts.fail === 0);
t('good: title pass', get(r, 'title').status === 'pass');
t('good: canonical pass', get(r, 'canonical').status === 'pass');
t('good: hreflang pass', get(r, 'hreflang').status === 'pass' && get(r, 'hreflang').data.xdefault);
t('good: jsonld types', get(r, 'jsonld').status === 'pass' && get(r, 'jsonld').data.types.includes('Organization'));
t('good: entity pass + visible', get(r, 'entity').status === 'pass' && get(r, 'entity').data.sameAs === 1);
t('good: answers 2/2', get(r, 'answers').data.questions === 2 && get(r, 'answers').data.answered === 2 && get(r, 'answers').status === 'pass');
t('good: links pass', get(r, 'links').status === 'pass' && get(r, 'links').data.internal === 6);
t('good: text pass', get(r, 'text').status === 'pass');
t('good: llms info (hypothesis)', get(r, 'llms').status === 'info' && get(r, 'llms').basis === 'hypothesis');

const spa = `<html><head><title>App</title><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="/a"><link rel="canonical" href="/b">
<script type="application/ld+json">{"@type": "Organization", name: broken}</script></head><body><div id="root"></div><script>var x="<p>hidden text that should not count</p>"</script></body></html>`;
r = analyzePage({ html: spa, url: 'https://app.example.com/', xRobots: '' });
t('spa: noindex fail', get(r, 'indexable').status === 'fail' && get(r, 'indexable').data.noindex);
t('spa: two canonicals fail', get(r, 'canonical').status === 'fail');
t('spa: text fail + spa', get(r, 'text').status === 'fail' && get(r, 'text').data.spa);
t('spa: jsonld parse error fail', get(r, 'jsonld').status === 'fail' && get(r, 'jsonld').data.errors === 1);
t('spa: short title warn', get(r, 'title').status === 'warn');
t('spa: no description warn', get(r, 'description').status === 'warn');
t('spa: no hreflang check', !get(r, 'hreflang'));
t('spa: sitemap unknown → info', get(r, 'sitemap').status === 'info');

r = analyzePage({ html: '<html><head><title>Long enough title here</title></head><body>' + para + '</body></html>', url: 'https://x.com/', xRobots: 'max-snippet:0' });
t('header max-snippet:0 → fail nosnippet', get(r, 'indexable').status === 'fail' && get(r, 'indexable').data.nosnippet);
r = analyzePage({ html: '<html><head><title>T</title><link rel="canonical" href="https://other.com/"><script type="application/ld+json">{"@type":"Organization","name":"Nowhere Corp"}</script></head><body><h1>a</h1><h1>b</h1>' + para + '</body></html>', url: 'https://x.com/' });
t('canonical other host warn', get(r, 'canonical').status === 'warn' && get(r, 'canonical').data.otherHost === 'other.com');
t('entity name not visible warn', get(r, 'entity').status === 'warn' && !get(r, 'entity').data.visible);
t('two h1 info', get(r, 'h1').status === 'info');
t('width cjk', width('中文ab') === 6);
t('visibleText strips script/style', visibleText('<style>a{}</style><p>Hi &amp; bye</p><script>x</script>') === 'Hi & bye');
t('empty html safe', analyzePage({ html: '', url: '' }).checks.length > 5);
r = analyzePage({ html: '<html><head><title>Hreflang test page</title><link rel="alternate" hreflang="english" href="https://x.com/"></head><body>' + para + '</body></html>', url: 'https://x.com/' });
t('bad hreflang code fail', get(r, 'hreflang').status === 'fail' && get(r, 'hreflang').data.bad[0] === 'english');


const faqPage = (qs, body) => `<html><head><title>FAQ 测试页面标题</title><script type="application/ld+json">${JSON.stringify({ '@type': 'FAQPage', mainEntity: qs.map((q) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: 'x' } })) })}</script></head><body><main>${body}</main></body></html>`;
r = analyzePage({ html: faqPage(['什么是对象存储？', 'How much does it cost?'], '<h2>什么是对象存储?</h2><p>说明</p><h3>How much does it COST</h3>'), url: 'https://e.com/' });
t('faq: visible questions pass (punct/case-insensitive)', get(r, 'faq').status === 'pass' && get(r, 'faq').data.questions === 2);
r = analyzePage({ html: faqPage(['什么是对象存储？', '页面上根本没有这个问题吗？'], '<h2>什么是对象存储？</h2>'), url: 'https://e.com/' });
t('faq: hidden question warns', get(r, 'faq').status === 'warn' && get(r, 'faq').data.missing === 1 && get(r, 'faq').basis === 'official');
r = analyzePage({ html: good, url: 'https://www.example.com/' });
t('faq: absent when no FAQPage', !get(r, 'faq'));
console.log(`seo: ${pass} 通过，${fail} 失败`);
if (fail) process.exit(1);
