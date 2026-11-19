import { readFileSync } from 'node:fs';
import { summarize, diff, step, sigOf, createMonitor, handleMonitor, runDue, alertMail, confirmMail, MON } from '../worker/monitor.js';
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : (fail++, console.log('FAIL', name)); };
const toyota = JSON.parse(readFileSync(new URL('./fixture-toyota.json', import.meta.url)));
const clone = (o) => JSON.parse(JSON.stringify(o));

/* summarize */
const s0 = summarize(toyota);
t('summarize toyota', s0 && s0.grades.access && Array.isArray(s0.blocked));
t('summarize null on inconclusive', summarize({ access: { verdict: 'inconclusive', bots: [{}] } }) === null);
t('summarize null on error', summarize({ error: 'rate_limited' }) === null);
t('summarize null on no bots', summarize({ access: { verdict: 'open', bots: [] } }) === null);

/* diff */
const A = { grades: { access: 'S', read: 'A', cite: 'B' }, blocked: [], silent: [] };
const B = { grades: { access: 'C', read: 'A', cite: 'B' }, blocked: ['OAI-SearchBot'], silent: ['OAI-SearchBot'] };
const d1 = diff(A, B);
t('diff blocked + grade', d1.worse && d1.changes.length === 2 && d1.changes[0].type === 'blocked' && d1.changes[0].silent);
const d2 = diff(B, A);
t('diff improvement', !d2.worse && d2.changes.some((c) => c.type === 'open'));
t('diff same', diff(A, clone(A)).changes.length === 0);

/* step：两次一致才提醒 */
const now = 1e12;
let r = step({ id: 'x' }, A, now);
t('first = baseline, no alert', !r.alert && r.rec.last && r.rec.next === now + MON.dayMs);
r = step(r.rec, B, now + 1);
t('change → candidate, recheck soon', !r.alert && r.rec.cand && r.rec.next === now + 1 + MON.recheckMs);
const r2 = step(r.rec, A, now + 2);
t('flap back → no alert, cand cleared', !r2.alert && !r2.rec.cand);
r = step(r.rec, B, now + 3);
t('confirmed change → alert', r.alert && r.alert.d.worse && sigOf(r.rec.last) === sigOf(B) && !r.rec.cand);
const r3 = step(r.rec, null, now + 4);
t('failed check keeps last', !r3.alert && r3.rec.fails === 1 && sigOf(r3.rec.last) === sigOf(B));

/* 邮件 */
const rec = { id: 'abcdefghijkm', token: 'tok', email: 'a@b.co', domain: 'ex.com', lang: 'en', origin: 'https://vaksel.com', rep: '/report/' };
const m = alertMail(rec, { prev: A, cur: B, d: d1 });
t('alert mail en', /OAI-SearchBot is now blocked/.test(m.text) && /vaksel.com\/report\/ex.com/.test(m.text) && m.headers['List-Unsubscribe'].includes('/api/monitor/stop?id=abcdefghijkm'));
const mz = alertMail(Object.assign({}, rec, { lang: 'zh' }), { prev: A, cur: B, d: d1 });
t('alert mail zh', /现在被拦/.test(mz.text) && /能不能进：S → C/.test(mz.text));
t('confirm mail', /api\/monitor\/confirm\?id=abcdefghijkm&t=tok/.test(confirmMail(rec).text));

/* KV 流程 */
function kv() {
  const m = new Map();
  return { m,
    async get(k, type) { const v = m.get(k); if (!v) return null; return type === 'json' ? JSON.parse(v.v) : v.v; },
    async put(k, v, o) { m.set(k, { v, meta: o && o.metadata }); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name, metadata: m.get(name).meta })), list_complete: true }; } };
}
const env = { WAITLIST: kv() };
const sent = [];
let next = toyota;
const deps = { cleanDomain: (d) => (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null), origin: 'https://vaksel.com', lang: 'en', repFor: () => '/report/',
  send: async (to, mail) => { sent.push({ to, mail }); }, check: async () => clone(next) };
const post = (body) => new Request('https://vaksel.com/api/monitor', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const waits = []; const ctx = { waitUntil: (p) => waits.push(p) };

let res = await (await handleMonitor(post({ email: 'A@B.co', site: 'toyota.com' }), env, ctx, deps)).json();
t('create ok', res.ok && sent.length === 1 && /Confirm monitoring for toyota.com/.test(sent[0].mail.subject));
const recKey = [...env.WAITLIST.m.keys()].find((k) => k.startsWith('mon:'));
const rec1 = JSON.parse(env.WAITLIST.m.get(recKey).v);
t('pending stored lowercase email, no ip', rec1.status === 'pending' && rec1.email === 'a@b.co' && !('ip' in rec1));
t('bad email', (await handleMonitor(post({ email: 'x', site: 'toyota.com' }), env, ctx, deps)).status === 400);
t('bad domain', (await handleMonitor(post({ email: 'a@b.co', site: '' }), env, ctx, deps)).status === 400);
const bad = await handleMonitor(new Request('https://vaksel.com/api/monitor/confirm?id=' + rec1.id + '&t=wrong'), env, ctx, deps);
t('confirm bad token 404', bad.status === 404);
const ok = await handleMonitor(new Request('https://vaksel.com/api/monitor/confirm?id=' + rec1.id + '&t=' + rec1.token), env, ctx, deps);
await Promise.all(waits);
const rec2 = JSON.parse(env.WAITLIST.m.get(recKey).v);
t('confirm activates + baseline', ok.status === 200 && rec2.status === 'active' && rec2.last && env.WAITLIST.m.get(recKey).meta.s === 'active');
res = await (await handleMonitor(post({ email: 'a@b.co', site: 'toyota.com' }), env, ctx, deps)).json();
t('duplicate active', res.already === true);
for (const d of ['a1.com', 'a2.com']) await handleMonitor(post({ email: 'a@b.co', site: d }), env, ctx, deps);
res = await (await handleMonitor(post({ email: 'a@b.co', site: 'a3.com' }), env, ctx, deps)).json();
t('limit per email', res.ok === false && res.error === 'limit');

/* runDue：未到期不跑；到期变化两次才发 */
let out = await runDue(env, deps, 1);
t('nothing due', out.done.length === 0);
const forceDue = () => { const v = env.WAITLIST.m.get(recKey); const o = JSON.parse(v.v); o.next = 0; v.v = JSON.stringify(o); v.meta.n = 0; };
const worse = clone(toyota); worse.access.bots.forEach((b) => { if (b.token === 'Claude-SearchBot') { b.effective = 'blocked'; b.silent = true; b.confidence = 'high'; } });
next = worse; forceDue(); const before = sent.length;
out = await runDue(env, deps, 1);
t('first change no mail', out.done[0] === 'toyota.com' && sent.length === before);
forceDue(); await runDue(env, deps, 1);
t('second change mails', sent.length === before + 1 && /Claude-SearchBot/.test(sent[sent.length - 1].mail.text));

/* 退订：GET 只显示按钮，POST 才删 */
const g = await handleMonitor(new Request('https://vaksel.com/api/monitor/stop?id=' + rec1.id + '&t=' + rec1.token), env, ctx, deps);
t('stop GET keeps', g.status === 200 && env.WAITLIST.m.has(recKey) && /<form method="post"/.test(await g.text()));
await handleMonitor(new Request('https://vaksel.com/api/monitor/stop?id=' + rec1.id + '&t=' + rec1.token, { method: 'POST' }), env, ctx, deps);
t('stop POST deletes', !env.WAITLIST.m.has(recKey) && !env.WAITLIST.m.has('mi:a@b.co:toyota.com'));

const env2 = { WAITLIST: kv() };
const rm = await (await handleMonitor(post({ email: 'z@b.co', site: 'x.com' }), env2, ctx, Object.assign({}, deps, { send: async () => { throw new Error('down'); } }))).json();
t('mail failure cleans up', rm.error === 'mail' && env2.WAITLIST.m.size === 0);
console.log(`monitor: ${pass} 通过，${fail} 失败`);
if (fail) process.exit(1);
