import { classifyAccess, blockReason } from '../worker/access.js';
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : (fail++, console.log('FAIL', name)); };
const ok = (extra) => Object.assign({ status: 200, headers: { server: 'cloudflare', 'cf-ray': 'x' }, bytes: 150000, text_chars: 4000, challenge: false, meta_robots: '', title: 'T' }, extra || {});
const blk = { status: 403, headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' }, bytes: 7500, text_chars: 100, challenge: true, meta_robots: '', title: 'Just a moment' };
const BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User', 'GPTBot', 'ClaudeBot', 'Bytespider', 'PetalBot'];
const mk = (gb, ctl, botFn) => { const r = { browser: ok(), Googlebot: gb, 'control-bot': ctl }; BOTS.forEach(b => r[b] = botFn(b)); return { kind: 'probe', target: 'https://x.com/', results: r }; };
const data = JSON.parse(readFileSync(new URL('../data/ai-crawlers.json', import.meta.url)));

let a = classifyAccess(mk(ok(), ok(), () => blk), [], data);
t('AI-only block → silent_block/all_blocked high', a.verdict === 'all_blocked' && a.bots[0].confidence === 'high' && a.bots[0].silent);
a = classifyAccess(mk(blk, blk, () => blk), [], data);
t('spoofed googlebot blocked → unverified, not blocked', a.bots.every(b => b.firewall === 'unverified') && a.verdict === 'warn');
a = classifyAccess(mk(ok(), blk, () => blk), [], data);
t('unknown bots blocked → medium', a.bots[0].confidence === 'medium');
a = classifyAccess(mk(ok(), ok(), b => b === 'PerplexityBot' ? blk : ok()), [], data);
t('one search bot blocked → silent_block', a.verdict === 'silent_block' && a.counts.silent === 1);
a = classifyAccess(mk(ok(), ok(), b => b === 'GPTBot' || b === 'ClaudeBot' ? blk : ok()), [], data);
t('training-only block → open', a.verdict === 'open' && a.counts.training_blocked === 2);
a = classifyAccess(mk(ok(), ok(), () => ok()), [{ token: 'OAI-SearchBot', status: 'blocked' }], data);
t('robots block not silent', a.verdict === 'partly_blocked' && !a.bots[0].silent && a.bots[0].effective === 'blocked');
const p = mk(ok(), ok(), () => ok()); p.results.browser = ok({ meta_robots: 'noindex, nofollow' });
t('noindex', classifyAccess(p, [], data).verdict === 'noindex');
const q = mk(ok(), ok(), () => ok()); q.results.browser = ok({ text_chars: 50 });
t('js only', classifyAccess(q, [], data).verdict === 'js_only');
const r = mk(ok(), ok(), () => ok()); r.results.browser = blk;
t('baseline blocked → inconclusive', classifyAccess(r, [], data).verdict === 'inconclusive');
t('probe error → unknown', classifyAccess({ kind: 'error', code: 'busy' }, [], data).verdict === 'unknown');
t('challenge page 200 small', blockReason({ status: 200, headers: {}, bytes: 5000, challenge: true }, ok()) === 'challenge');
t('challenge word in big page ok', blockReason({ status: 200, headers: {}, bytes: 150000, challenge: true }, ok()) === null);
a = classifyAccess(mk(ok(), ok(), b => b === 'OAI-SearchBot' ? ok({ text_chars: 300 }) : ok()), [], data);
t('degraded content warns', a.bots[0].firewall === 'degraded' && a.verdict === 'warn');
// 真实探测样本
for (const [f, want] of [['/tmp/p_smithsonianmag.com.json', 'all_blocked'], ['/tmp/p_github.com.json', 'open']]) {
  try { const v = classifyAccess(JSON.parse(readFileSync(f)), [], data).verdict; t('real ' + f + ' → ' + v, v === want); } catch (e) {}
}
console.log(`access: ${pass} 通过，${fail} 失败`);
if (fail) process.exit(1);
