/* en/grade-view.js — 三层评级条（S/A/B/C），中英双语，纯字符串 */
import { gradeReport } from './grade.js';
import { seoLabel } from './seo-view.js';
const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ZH = {
  title: '评级', sep: '、',
  layers: { access: ['能不能进', '#crawlers'], read: ['能不能读', '#seo-read'], cite: ['能不能被引用', '#seo-cite'] },
  none: '未评级',
  access: {
    noindex: () => '首页带 noindex，不会被收录',
    all_blocked: (w) => (w.robots ? 'robots.txt 禁止了' : '') + '全部 ' + w.n + ' 个 AI 搜索爬虫' + (w.robots ? '' : '被拦'),
    silent: (w) => w.n + ' 个 AI 搜索爬虫被防火墙静默拦截',
    some_blocked: (w) => w.total + ' 个 AI 搜索爬虫中 ' + w.n + ' 个被' + (w.robots ? ' robots.txt 禁止' : '拦'),
    some_warn: (w) => '都能进，' + w.n + ' 个遇到验证页或内容缩水',
    all_open: (w) => '实测 ' + w.total + ' 个 AI 搜索爬虫全部能进',
    robots_only: () => '防火墙实测没完成，只看 robots.txt，最高 A',
    no_data: () => '没拿到 robots.txt 和实测结果'
  },
  readOk: '官方和常用检查全部通过', fix: (l) => '待改：' + l, problem: (l) => '问题：' + l,
  cite: (p, t, miss) => t + ' 个引用信号有 ' + p + ' 个' + (miss ? '，缺' + miss : ''),
  noPage: '没拿到首页 HTML',
  rulesT: '怎么评的',
  rules: '<p>三层分开评，不打总分。只用标着“官方文档”或“业界常用”的检查，“推测”和“提示”不计分。训练爬虫被拦不扣分，那是你的选择。</p><ul>' +
    '<li><b>能不能进</b>：S 实测全部能进；A 都能进但有验证页、内容缩水，或实测没完成只看 robots.txt；B 部分 AI 搜索爬虫被拦；C 全部被拦、有静默拦截或首页 noindex。</li>' +
    '<li><b>能不能读</b>：S 没有待改项；A 1 项；B 2–3 项或有非关键问题；C 不能收录 / 不能显示摘要、不跑 JS 读不到正文，或待改 4 项以上。</li>' +
    '<li><b>能不能被引用</b>：结构化数据、机构信息、网站名称、分享卡片、语义标签 5 个信号，S 全有，A 4 个，B 2–3 个，C 0–1 个；JSON-LD 解析失败最高 B。</li></ul>'
};
const EN = {
  title: 'Grades', sep: ', ',
  layers: { access: ['Can they get in', '#crawlers'], read: ['Can they read it', '#seo-read'], cite: ['Can they cite it', '#seo-cite'] },
  none: 'Not graded',
  access: {
    noindex: () => 'The homepage is set to noindex',
    all_blocked: (w) => 'All ' + w.n + ' AI search crawlers ' + (w.robots ? 'disallowed by robots.txt' : 'blocked'),
    silent: (w) => w.n + ' AI search crawler' + (w.n > 1 ? 's' : '') + ' silently blocked by the firewall',
    some_blocked: (w) => w.n + ' of ' + w.total + ' AI search crawlers ' + (w.robots ? 'disallowed by robots.txt' : 'blocked'),
    some_warn: (w) => 'All get in; ' + w.n + ' hit a challenge or a thinner page',
    all_open: (w) => 'All ' + w.total + ' AI search crawlers got in',
    robots_only: () => 'Live test incomplete; robots.txt only, so A at most',
    no_data: () => 'No robots.txt or live results'
  },
  readOk: 'Every official and common check passes', fix: (l) => 'To improve: ' + l, problem: (l) => 'Problem: ' + l,
  cite: (p, t, miss) => p + ' of ' + t + ' citation signals' + (miss ? '; missing ' + miss : ''),
  noPage: 'Couldn’t get the homepage HTML',
  rulesT: 'How we grade',
  rules: '<p>Each layer is graded on its own; there’s no overall score. Only checks marked “Official docs” or “Common practice” count; hypotheses and notes don’t. Blocking training crawlers costs nothing: that’s your call.</p><ul>' +
    '<li><b>Can they get in</b>: S, every AI search crawler got in; A, all get in but some hit a challenge or a thinner page, or the live test didn’t finish and only robots.txt was checked; B, some AI search crawlers are blocked; C, all are blocked, a silent block was found, or the homepage is noindex.</li>' +
    '<li><b>Can they read it</b>: S, nothing to improve; A, one item; B, two or three, or a non-critical problem; C, indexing or snippets are blocked, the text needs JavaScript, or four or more items need work.</li>' +
    '<li><b>Can they cite it</b>: five signals (structured data, organization, site name, share card, semantic tags). S all five, A four, B two or three, C one or none; a JSON-LD parse error caps it at B.</li></ul>'
};

function line(k, g, L, lang) {
  if (!g.grade) return k === 'access' ? L.access.no_data() : L.noPage;
  if (k === 'access') return g.why.map((w) => (L.access[w.id] || (() => ''))(w)).filter(Boolean).join(lang === 'zh' ? '；' : '. ');
  if (k === 'read') {
    if (!g.why.length) return L.readOk;
    const f = g.why.filter((w) => w.status === 'fail').map((w) => seoLabel(w.id, lang));
    const w = g.why.filter((x) => x.status === 'warn').map((x) => seoLabel(x.id, lang));
    return [f.length ? L.problem(f.join(L.sep)) : '', w.length ? L.fix(w.join(L.sep)) : ''].filter(Boolean).join(lang === 'zh' ? '；' : '. ');
  }
  return L.cite(g.passed, g.total, g.why.map((w) => seoLabel(w.id, lang)).join(L.sep));
}

export function renderGrades(r, lang) {
  const L = lang === 'zh' ? ZH : EN;
  const G = gradeReport(r);
  const tile = (k) => { const g = G[k]; const [name, href] = L.layers[k];
    return '<a class="gtile g-' + (g.grade || 'none') + '" href="' + href + '"><span class="gl">' + name + '</span><span class="gg">' + (g.grade || '–') + '</span><span class="gw">' + E(line(k, g, L, lang)) + '</span></a>'; };
  return '<div class="grades" aria-label="' + L.title + '">' + tile('access') + tile('read') + tile('cite') + '</div>' +
    '<details class="grules"><summary>' + L.rulesT + '</summary>' + L.rules + '</details>';
}
