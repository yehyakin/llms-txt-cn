/* en/grade.js — 三层评级 S/A/B/C（纯函数，Worker 与浏览器共用）。
 * 原则：只用能验证的事实；basis=hypothesis 的检查不计入；info（可有可无）不扣分；没有总分。
 * 返回 { access, read, cite }，每层 { grade: 'S'|'A'|'B'|'C'|null, why: [{id, status}], cap?: string }。
 *
 * 能不能进（access）
 *   C：首页 noindex；或 AI 搜索爬虫全部被拦；或有高/中可信的静默拦截
 *   B：部分 AI 搜索爬虫被 robots.txt 或防火墙拦
 *   A：都能进，但有爬虫遇到验证页 / 内容缩水 / 只能查 robots（实测未完成，最高 A）
 *   S：实测全部能进，拿到的页面和浏览器一样
 *   训练爬虫被拦不扣分（那是站长的选择）。
 * 能不能读（read）：官方/常用检查里
 *   C：indexable 或 text 为 fail（不能收录/摘要，或不跑 JS 读不到正文），或 待改 ≥ 4
 *   其他 fail 最高 B；0 项待改 S，1 项 A，2–3 项 B
 * 能不能被引用（cite）：5 个信号 jsonld、entity、sitename、og、semantic 中通过几个
 *   5 → S，4 → A，2–3 → B，0–1 → C；JSON-LD 解析失败最高 B；FAQPage 标记的问题在页面上找不到，最高 B。
 *   robots.txt 返回 5xx / 不可达：按 RFC 9309 视为全站禁止，归到“全部被拦”，并单独说明原因。
 * 中文搜索与 AI 引擎（data 里 region=cn：Baiduspider、Bytespider、PetalBot、搜狗、360、神马、Kimi）不计入三层评级，
 *   只在 cn 字段给出“能进几个”（2026-11-02.2 起；之前 Bytespider、PetalBot 计入能不能进）。
 * 规则版本：GRADE_VERSION，改规则时加一。
 */
const RANK = ['S', 'A', 'B', 'C'];
const worse = (a, b) => RANK[Math.max(RANK.indexOf(a), RANK.indexOf(b))];
const isSearch = (b) => (b.category === 'search' || b.category === 'user') && b.region !== 'cn';
const isCn = (b) => (b.category === 'search' || b.category === 'user') && b.region === 'cn';
const CLASSIC = new Set(['Googlebot', 'Bingbot', 'Applebot', 'Baiduspider', 'YandexBot', 'Yeti']);
/* 2026-11-04 新增的 MistralAI-User、YouBot 只做 robots.txt 分析、在报告里列出，不计入评级；YandexBot、Yeti 与 Googlebot 同属传统搜索引擎，同样不计 */
const UNGRADED = new Set(['MistralAI-User', 'MistralAI-Index', 'YouBot', 'Amzn-User']);
export const GRADE_VERSION = '2026-11-02.2';
export const CITE_SIGNALS = ['jsonld', 'entity', 'sitename', 'og', 'semantic'];

const robots5xx = (r) => !!(r && r.robots && r.robots.analysis && r.robots.analysis.fetch && r.robots.analysis.fetch.policy === 'disallow_all');
export function gradeAccess(r) {
  const g = gradeAccess0(r);
  if (robots5xx(r) && g.grade === 'C') g.why.unshift({ id: 'robots_5xx', status: 'fail', http: r.robots.analysis.fetch.http_status });
  return g;
}
function gradeAccess0(r) {
  const a = (r && r.access) || {};
  const live = a.bots && a.bots.length && a.verdict !== 'inconclusive' && a.verdict !== 'unknown';
  if (live) {
    const s = a.bots.filter(isSearch);
    const why = [];
    if (a.page && a.page.noindex) return { grade: 'C', why: [{ id: 'noindex', status: 'fail' }] };
    const blocked = s.filter((b) => b.effective === 'blocked');
    const silent = s.filter((b) => b.silent && (b.confidence === 'high' || b.confidence === 'medium'));
    if (s.length && blocked.length === s.length) return { grade: 'C', why: [{ id: 'all_blocked', status: 'fail', n: blocked.length }] };
    if (silent.length) return { grade: 'C', why: [{ id: 'silent', status: 'fail', n: silent.length, bots: silent.map((b) => b.token) }] };
    if (blocked.length) return { grade: 'B', why: [{ id: 'some_blocked', status: 'warn', n: blocked.length, total: s.length, bots: blocked.map((b) => b.token) }] };
    const warn = s.filter((b) => b.effective === 'warn');
    if (warn.length) return { grade: 'A', why: [{ id: 'some_warn', status: 'warn', n: warn.length, bots: warn.map((b) => b.token) }] };
    return { grade: 'S', why: [{ id: 'all_open', status: 'pass', total: s.length }] };
  }
  /* 实测没完成：只能看 robots.txt，最高 A */
  const ra = ((r && r.robots && r.robots.analysis && r.robots.analysis.access) || []).filter((b) => isSearch(b) && !CLASSIC.has(b.token) && !UNGRADED.has(b.token));
  if (!ra.length) return { grade: null, why: [{ id: 'no_data', status: 'info' }] };
  const blocked = ra.filter((b) => b.status === 'blocked');
  const cap = { id: 'robots_only', status: 'info' };
  if (blocked.length === ra.length) return { grade: 'C', why: [{ id: 'all_blocked', status: 'fail', n: blocked.length, robots: true }, cap] };
  if (blocked.length) return { grade: 'B', why: [{ id: 'some_blocked', status: 'warn', n: blocked.length, total: ra.length, bots: blocked.map((b) => b.token), robots: true }, cap] };
  return { grade: 'A', why: [cap], cap: 'robots_only' };
}

export function gradeRead(seo) {
  if (!seo || !seo.ok) return { grade: null, why: [{ id: 'no_page', status: 'info' }] };
  const list = seo.checks.filter((c) => c.layer === 'read' && c.basis !== 'hypothesis');
  const fails = list.filter((c) => c.status === 'fail');
  const warns = list.filter((c) => c.status === 'warn');
  const why = fails.concat(warns).map((c) => ({ id: c.id, status: c.status }));
  if (fails.some((c) => c.id === 'indexable' || c.id === 'text') || warns.length >= 4) return { grade: 'C', why };
  let g = warns.length === 0 ? 'S' : warns.length === 1 ? 'A' : 'B';
  if (fails.length) g = worse(g, 'B');
  return { grade: g, why };
}

export function gradeCite(seo) {
  if (!seo || !seo.ok) return { grade: null, why: [{ id: 'no_page', status: 'info' }] };
  const by = {}; seo.checks.forEach((c) => { if (c.layer === 'cite') by[c.id] = c; });
  const passed = CITE_SIGNALS.filter((id) => by[id] && by[id].status === 'pass');
  const missing = CITE_SIGNALS.filter((id) => !passed.includes(id)).map((id) => ({ id, status: (by[id] && by[id].status) || 'info' }));
  const n = passed.length;
  let g = n >= 5 ? 'S' : n === 4 ? 'A' : n >= 2 ? 'B' : 'C';
  if (by.jsonld && by.jsonld.status === 'fail') g = worse(g, 'B');
  if (by.faq && by.faq.status === 'warn') { g = worse(g, 'B'); missing.push({ id: 'faq', status: 'warn' }); }
  return { grade: g, why: missing, passed: n, total: CITE_SIGNALS.length };
}

/* 中文搜索与 AI 引擎：不评级，只数能进几个。live=false 表示只看了 robots.txt */
export function cnSummary(r) {
  const a = (r && r.access) || {};
  const live = a.bots && a.bots.length && a.verdict !== 'inconclusive' && a.verdict !== 'unknown';
  const list = live ? a.bots.filter(isCn).map((b) => ({ token: b.token, blocked: b.effective === 'blocked', warn: b.effective === 'warn', silent: !!b.silent }))
    : ((r && r.robots && r.robots.analysis && r.robots.analysis.access) || []).filter(isCn).map((b) => ({ token: b.token, blocked: b.status === 'blocked' }));
  if (!list.length) return null;
  if (robots5xx(r)) list.forEach((b) => { b.blocked = true; });
  return { live: !!live, total: list.length, open: list.filter((b) => !b.blocked).length, blocked: list.filter((b) => b.blocked).map((b) => b.token), silent: list.filter((b) => b.silent).map((b) => b.token) };
}
export function gradeReport(r) {
  return { access: gradeAccess(r), read: gradeRead(r && r.seo), cite: gradeCite(r && r.seo), cn: cnSummary(r) };
}
