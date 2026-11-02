import { gradeReport, gradeRead, gradeCite, gradeAccess } from '../en/grade.js';
import { renderGrades } from '../en/grade-view.js';
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : (fail++, console.log('FAIL', name)); };
const bot = (token, o) => Object.assign({ token, category: 'search', effective: 'open', silent: false }, o || {});
const acc = (bots, o) => ({ access: Object.assign({ verdict: 'open', bots, page: {} }, o || {}) });
const seo = (list) => ({ ok: true, checks: list.map(([id, layer, status, basis]) => ({ id, layer, status, basis: basis || 'official', data: {} })) });

t('access S', gradeAccess(acc([bot('A'), bot('B'), bot('T', { category: 'training', effective: 'blocked' })])).grade === 'S');
t('access A warn', gradeAccess(acc([bot('A'), bot('B', { effective: 'warn' })])).grade === 'A');
t('access B some', gradeAccess(acc([bot('A'), bot('B', { effective: 'blocked' })])).grade === 'B');
t('access C silent', gradeAccess(acc([bot('A'), bot('B', { effective: 'blocked', silent: true, confidence: 'high' })])).grade === 'C');
t('access low-confidence silent not C', gradeAccess(acc([bot('A'), bot('B', { effective: 'warn', confidence: 'low' })])).grade === 'A');
t('access C all', gradeAccess(acc([bot('A', { effective: 'blocked' })])).grade === 'C');
t('access C noindex', gradeAccess(acc([bot('A')], { page: { noindex: true } })).grade === 'C');
const ro = (sts) => ({ access: { verdict: 'inconclusive' }, robots: { analysis: { access: sts.map((s, i) => ({ token: 'X' + i, category: 'search', status: s })) } } });
t('robots-only capped A', gradeAccess(ro(['allowed', 'allowed'])).grade === 'A');
t('robots-only B', gradeAccess(ro(['allowed', 'blocked'])).grade === 'B');
t('robots-only ignores Googlebot', gradeAccess({ access: {}, robots: { analysis: { access: [{ token: 'Googlebot', category: 'search', status: 'blocked' }, { token: 'X', category: 'search', status: 'allowed' }] } } }).grade === 'A');
t('access null no data', gradeAccess({}).grade === null);

t('read S', gradeRead(seo([['title', 'read', 'pass'], ['h1', 'read', 'pass', 'common']])).grade === 'S');
t('read A', gradeRead(seo([['title', 'read', 'warn']])).grade === 'A');
t('read B', gradeRead(seo([['title', 'read', 'warn'], ['h1', 'read', 'warn', 'common']])).grade === 'B');
t('read C 4 warns', gradeRead(seo([['a', 'read', 'warn'], ['b', 'read', 'warn'], ['c', 'read', 'warn'], ['d', 'read', 'warn']])).grade === 'C');
t('read C text fail', gradeRead(seo([['text', 'read', 'fail']])).grade === 'C');
t('read C indexable fail', gradeRead(seo([['indexable', 'read', 'fail']])).grade === 'C');
t('read other fail caps B', gradeRead(seo([['canonical', 'read', 'fail']])).grade === 'B');
t('read info ignored', gradeRead(seo([['sitemap', 'read', 'info']])).grade === 'S');
t('read hypothesis ignored', gradeRead(seo([['x', 'read', 'fail', 'hypothesis']])).grade === 'S');
t('read null', gradeRead({ ok: false }).grade === null);

const all = ['jsonld', 'entity', 'sitename', 'og', 'semantic'];
t('cite S', gradeCite(seo(all.map((id) => [id, 'cite', 'pass']))).grade === 'S');
t('cite A', gradeCite(seo(all.map((id, i) => [id, 'cite', i ? 'pass' : 'info']))).grade === 'A');
t('cite B', gradeCite(seo(all.map((id, i) => [id, 'cite', i < 2 ? 'pass' : 'info']))).grade === 'B');
t('cite C', gradeCite(seo([['og', 'cite', 'pass']])).grade === 'C');
t('cite jsonld fail caps B', gradeCite(seo(all.map((id) => [id, 'cite', id === 'jsonld' ? 'fail' : 'pass']))).grade === 'B');
t('cite llms/answers not counted', gradeCite(seo([...all.map((id) => [id, 'cite', 'pass']), ['llms', 'cite', 'warn', 'hypothesis']])).grade === 'S');

const r = Object.assign(acc([bot('OAI-SearchBot')]), { seo: seo([['title', 'read', 'warn'], ...all.map((id) => [id, 'cite', 'pass'])]) });
const g = gradeReport(r);
t('report grades', g.access.grade === 'S' && g.read.grade === 'A' && g.cite.grade === 'S');
const hz = renderGrades(r, 'zh'), he = renderGrades(r, 'en');
t('render zh', hz.includes('能不能进') && hz.includes('待改：页面标题') && hz.includes('g-S'));
t('render en', he.includes('Can they cite it') && he.includes('To improve: Page title'));
t('render none', renderGrades({}, 'zh').includes('g-none'));

const r5 = { access: { verdict: 'inconclusive' }, robots: { analysis: { fetch: { policy: 'disallow_all', http_status: 503 }, access: [{ token: 'X', category: 'search', status: 'blocked' }] } } };
const g5 = gradeAccess(r5);
t('robots 5xx -> C with reason', g5.grade === 'C' && g5.why[0].id === 'robots_5xx' && g5.why[0].http === 503);
t('robots 5xx render', renderGrades(r5, 'zh').includes('返回 503') && renderGrades(r5, 'en').includes('RFC 9309'));
const fq = seo([...all.map((id) => [id, 'cite', 'pass']), ['faq', 'cite', 'warn']]);
t('faq mismatch caps cite at B', gradeCite(fq).grade === 'B');
t('faq render', renderGrades({ seo: fq }, 'zh').includes('FAQ 标记与页面不符') && !renderGrades({ seo: fq }, 'zh').includes('缺FAQ'));
t('faq pass no cap', gradeCite(seo([...all.map((id) => [id, 'cite', 'pass']), ['faq', 'cite', 'pass']])).grade === 'S');
t('rules version shown', renderGrades({}, 'en').includes('Rules version') && renderGrades({}, 'zh').includes('/research/grading/'));
/* 2026-11-02.2：中文引擎单独成组，不计入主评级 */
const cnb = (t, o) => bot(t, Object.assign({ region: 'cn' }, o || {}));
t('cn blocked does not affect access', gradeAccess(acc([bot('A'), cnb('Bytespider', { effective: 'blocked', silent: true, confidence: 'high' })])).grade === 'S');
t('cn alone not all_blocked', gradeAccess(acc([bot('A', { effective: 'blocked' }), cnb('Kimi-SearchBot')])).grade === 'C');
const cs = gradeReport(acc([bot('A'), cnb('Bytespider', { effective: 'blocked' }), cnb('Kimi-SearchBot')])).cn;
t('cn summary', cs && cs.total === 2 && cs.open === 1 && cs.blocked[0] === 'Bytespider' && cs.live);
t('cn summary null when none', gradeReport(acc([bot('A')])).cn === null);
t('cn line rendered', renderGrades(acc([bot('A'), cnb('Bytespider', { effective: 'blocked' })]), 'zh').includes('中文搜索与 AI 引擎（不计入评级）：0/1 能进'));
t('cn robots-only', gradeReport({ access: {}, robots: { analysis: { access: [{ token: 'YisouSpider', category: 'search', region: 'cn', status: 'blocked' }] } } }).cn.open === 0);
console.log(`grade: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
