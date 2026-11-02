/* worker/monitor.js — 监控（早期体验 MVP）
 * 存储：WAITLIST KV，前缀
 *   mon:<id>            监控记录 JSON；metadata { s: 'pending'|'active', n: 下次复测时间(ms) }
 *   mi:<email>:<domain> → id（去重 / 每个邮箱的站点数）
 * 流程：POST /api/monitor（或早鸟表单勾选“立即开始监控”）→ 发确认邮件（双重确认）
 *   → GET /api/monitor/confirm?id=&t= 激活并记下首次结果作为基线
 *   → Cron（wrangler.toml [triggers]）每次只复测 MON_PER_RUN 个到期站点（免费版每次调用 50 个子请求）
 *   → 结果和上次不同：15 分钟后再测一次，两次一致才发提醒（避免偶发误报）；相同则 24 小时后再测
 *   → 每封邮件带退订链接 GET /api/monitor/stop?id=&t=（同时写 List-Unsubscribe 头）
 * 只存：邮箱、域名、语言、每次结果的摘要（等级 + 被拦的爬虫）。不存 IP。 */
import { gradeReport } from '../en/grade.js';
import { isMainSearch } from './access.js';

export const MON = { maxPerEmail: 3, dayMs: 24 * 3600e3, recheckMs: 15 * 60e3, pendingTtl: 2 * 86400 };
const RANK = { S: 0, A: 1, B: 2, C: 3 };

/* 从一次检测结果取摘要；实测没完成（inconclusive / unknown / 内部错误）返回 null，不拿来比较 */
export function summarize(r) {
  if (!r || r.error || r.code === 'internal') return null;
  const a = r.access || {};
  if (!a.bots || !a.bots.length || a.verdict === 'inconclusive' || a.verdict === 'unknown') return null;
  const g = gradeReport(r);
  const s = a.bots.filter(isMainSearch);
  return {
    verdict: a.verdict,
    grades: { access: g.access.grade, read: g.read.grade, cite: g.cite.grade },
    blocked: s.filter((b) => b.effective === 'blocked').map((b) => b.token).sort(),
    silent: s.filter((b) => b.silent).map((b) => b.token).sort(),
    cn_open: g.cn ? g.cn.open : null, cn_total: g.cn ? g.cn.total : null,
    cdn: a.cdn || null
  };
}
export const sigOf = (s) => (s ? JSON.stringify([s.grades, s.blocked, s.silent]) : '');

/* 前后两次摘要的差异；worse=true 表示有变差 */
export function diff(prev, cur) {
  const out = [];
  if (!prev || !cur) return { changes: out, worse: false };
  const pb = new Set(prev.blocked), cb = new Set(cur.blocked);
  cur.blocked.filter((t) => !pb.has(t)).forEach((t) => out.push({ type: 'blocked', token: t, silent: cur.silent.includes(t), worse: true }));
  prev.blocked.filter((t) => !cb.has(t)).forEach((t) => out.push({ type: 'open', token: t, worse: false }));
  ['access', 'read', 'cite'].forEach((k) => {
    const a = prev.grades[k], b = cur.grades[k];
    if (a !== b && a && b) out.push({ type: 'grade', layer: k, from: a, to: b, worse: RANK[b] > RANK[a] });
  });
  return { changes: out, worse: out.some((c) => c.worse) };
}

/* 一次复测后更新记录；返回 { rec, alert: null | {prev, cur, d} } */
export function step(rec, cur, now) {
  rec = Object.assign({}, rec);
  rec.checked_at = new Date(now).toISOString();
  if (!cur) { rec.fails = (rec.fails || 0) + 1; rec.next = now + (rec.fails >= 3 ? MON.dayMs : MON.recheckMs * 4); return { rec, alert: null }; }
  rec.fails = 0;
  if (!rec.last) { rec.last = cur; rec.cand = null; rec.next = now + MON.dayMs; return { rec, alert: null }; }
  if (sigOf(cur) === sigOf(rec.last)) { rec.last = cur; rec.cand = null; rec.next = now + MON.dayMs; return { rec, alert: null }; }
  if (rec.cand && sigOf(rec.cand) === sigOf(cur)) {
    const prev = rec.last;
    rec.last = cur; rec.cand = null; rec.next = now + MON.dayMs;
    const d = diff(prev, cur);
    return { rec, alert: d.changes.length ? { prev, cur, d } : null };
  }
  rec.cand = cur; rec.next = now + MON.recheckMs;
  return { rec, alert: null };
}

const rid = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const put = (env, rec, ttl) => env.WAITLIST.put('mon:' + rec.id, JSON.stringify(rec), Object.assign({ metadata: { s: rec.status, n: rec.next || 0 } }, ttl ? { expirationTtl: ttl } : {}));

/* 建一个待确认的监控并发确认邮件。opts: { email, domain, lang, origin, rep } */
export async function createMonitor(env, opts, send) {
  const { email, domain } = opts;
  const lang = opts.lang === 'zh' ? 'zh' : 'en';
  const ik = 'mi:' + email + ':' + domain;
  const exist = await env.WAITLIST.get(ik);
  if (exist) {
    const old = await env.WAITLIST.get('mon:' + exist, 'json');
    if (old && old.status === 'active') return { ok: true, already: true };
    if (old) { try { await send(email, confirmMail(old)); } catch (e) { return { ok: false, error: 'mail' }; } return { ok: true, resent: true }; }
  }
  const mine = await env.WAITLIST.list({ prefix: 'mi:' + email + ':' });
  if (mine.keys.length >= MON.maxPerEmail && !exist) return { ok: false, error: 'limit' };
  const rec = { id: rid(12), token: rid(24), email, domain, lang, origin: opts.origin, rep: opts.rep, status: 'pending', created_at: new Date().toISOString(), next: 0 };
  await put(env, rec, MON.pendingTtl);
  await env.WAITLIST.put(ik, rec.id, { expirationTtl: MON.pendingTtl });
  try { await send(email, confirmMail(rec)); }
  catch (e) { await env.WAITLIST.delete('mon:' + rec.id); await env.WAITLIST.delete(ik); return { ok: false, error: 'mail' }; }
  return { ok: true };
}

async function load(env, url) {
  const id = url.searchParams.get('id') || '', t = url.searchParams.get('t') || '';
  if (!/^[a-z0-9]{12}$/.test(id)) return null;
  const rec = await env.WAITLIST.get('mon:' + id, 'json');
  return rec && rec.token === t ? rec : null;
}

/* /api/monitor* 路由。deps: { check(domain) → result, send(to, mail), origin, rep, lang } */
export async function handleMonitor(request, env, ctx, deps) {
  const url = new URL(request.url);
  if (!env.WAITLIST) return J({ error: 'unavailable' }, 503);
  if (url.pathname === '/api/monitor' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || '';
    if (env.RL && typeof env.RL.limit === 'function') { try { const { success } = await env.RL.limit({ key: 'mon:' + ip }); if (!success) return J({ error: 'rate_limited' }, 429); } catch (e) {} }
    let b; try { b = await request.json(); } catch (e) { return J({ error: 'bad_json' }, 400); }
    if (b.hp) return J({ ok: true });
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return J({ error: 'bad_email' }, 400);
    const domain = deps.cleanDomain(String(b.site || b.domain || ''));
    if (!domain) return J({ error: 'bad_domain' }, 400);
    const r = await createMonitor(env, { email, domain, lang: b.lang === 'zh' || b.lang === 'en' ? b.lang : deps.lang, origin: deps.origin, rep: deps.repFor(b.lang === 'zh' || b.lang === 'en' ? b.lang : deps.lang) }, deps.send);
    return J(r, r.ok ? 200 : r.error === 'mail' ? 503 : 400);
  }
  if ((url.pathname === '/api/monitor/confirm' || url.pathname === '/api/monitor/stop') && (request.method === 'GET' || request.method === 'POST')) {
    const rec = await load(env, url);
    const lang = (rec && rec.lang) || deps.lang;
    if (!rec) return page(lang, 'bad');
    if (url.pathname.endsWith('/stop')) {
      // GET 只显示确认按钮（邮件安全扫描会预取链接，不能一打开就退订）；POST 才删除（含 List-Unsubscribe-Post 一键退订）
      if (request.method === 'GET') return page(lang, 'askstop', rec, url);
      await env.WAITLIST.delete('mon:' + rec.id); await env.WAITLIST.delete('mi:' + rec.email + ':' + rec.domain);
      return page(lang, 'stopped', rec);
    }
    if (rec.status !== 'active') {
      rec.status = 'active'; rec.confirmed_at = new Date().toISOString(); rec.next = 0;
      await put(env, rec); await env.WAITLIST.put('mi:' + rec.email + ':' + rec.domain, rec.id);
      // 首次结果作为基线（后台跑，不阻塞页面）
      if (ctx && ctx.waitUntil) ctx.waitUntil(runOne(env, rec, deps).catch(() => {}));
    }
    return page(lang, 'active', rec);
  }
  return J({ error: 'not_found' }, 404);
}

/* 复测一个站点并按需发提醒 */
export async function runOne(env, rec, deps, now) {
  now = now || Date.now();
  let cur = null;
  try { cur = summarize(await deps.check(rec.domain)); } catch (e) {}
  const { rec: next, alert } = step(rec, cur, now);
  if (alert) { try { await deps.send(rec.email, alertMail(next, alert)); next.alerts = (next.alerts || 0) + 1; next.alerted_at = new Date(now).toISOString(); } catch (e) {} }
  // 记录可能在复测期间被退订
  if (await env.WAITLIST.get('mon:' + rec.id)) await put(env, next);
  return { cur, alert };
}

/* Cron：挑最早到期的 active 记录 */
export async function runDue(env, deps, limit) {
  const now = Date.now();
  const due = [];
  let cursor;
  do {
    const l = await env.WAITLIST.list({ prefix: 'mon:', cursor });
    l.keys.forEach((k) => { const m = k.metadata || {}; if (m.s === 'active' && (m.n || 0) <= now) due.push([m.n || 0, k.name]); });
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  due.sort((a, b) => a[0] - b[0]);
  const done = [];
  for (const [, key] of due.slice(0, limit || 1)) {
    const rec = await env.WAITLIST.get(key, 'json');
    if (rec && rec.status === 'active') { await runOne(env, rec, deps, now); done.push(rec.domain); }
  }
  return { due: due.length, done };
}

/* ---------- 邮件与页面 ---------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei','Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";
const links = (rec) => ({
  confirm: rec.origin + '/api/monitor/confirm?id=' + rec.id + '&t=' + rec.token,
  stop: rec.origin + '/api/monitor/stop?id=' + rec.id + '&t=' + rec.token,
  report: rec.origin + (rec.rep || '/report/') + rec.domain
});
const LAYER = { en: { access: 'Get in', read: 'Read', cite: 'Cite' }, zh: { access: '能不能进', read: '能不能读', cite: '能不能被引用' } };

function shell(lang, pre, title, bodyHtml, btn, foot) {
  return `<!DOCTYPE html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px"><img src="https://vaksel.com/brand/email-lockup.png" width="160" alt="VAKSEL" style="display:block;border:0;width:160px;height:auto"></td></tr>
<tr><td style="background:#ffffff;border-radius:18px;padding:32px 30px">
<h1 style="margin:0 0 12px;font:700 24px/1.3 ${F};color:#080B14">${esc(title)}</h1>${bodyHtml}
${btn ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td style="border-radius:10px;background:#080B14"><a href="${btn[0]}" style="display:inline-block;padding:12px 20px;font:600 15px/1 ${F};color:#ffffff;text-decoration:none">${esc(btn[1])}</a></td></tr></table>` : ''}
</td></tr><tr><td style="padding:18px 6px 0;font:12px/1.7 ${F};color:#6e6e73">${foot}</td></tr></table></td></tr></table></body></html>`;
}
const P = (t) => `<p style="margin:0 0 14px;font:15px/1.6 ${F};color:#333336">${t}</p>`;

export function confirmMail(rec) {
  const L = links(rec), zh = rec.lang === 'zh', d = esc(rec.domain);
  const subject = zh ? `确认监控 ${rec.domain}` : `Confirm monitoring for ${rec.domain}`;
  const text = zh
    ? [`点下面的链接，开始监控 ${rec.domain}：`, L.confirm, '', '确认后我们每天复测一次。AI 搜索爬虫被拦、或三项评级变化，会发邮件提醒你。早期体验期间免费。', '', '如果不是你本人操作，忽略这封邮件即可，我们不会再发。'].join('\n')
    : [`Confirm you want daily monitoring for ${rec.domain}:`, L.confirm, '', 'Once confirmed we re-test the site every day and email you if an AI search crawler gets cut off or a grade changes. Free during early access.', '', "If this wasn't you, ignore this email and you won't hear from us again."].join('\n');
  const html = shell(rec.lang, zh ? '点一下确认，就开始每天复测。' : 'One click and daily re-tests start.', zh ? `确认监控 ${rec.domain}` : `Confirm monitoring for ${rec.domain}`,
    zh ? P(`确认后我们每天复测 <b>${d}</b> 一次。AI 搜索爬虫被拦、或三项评级变化时，会发邮件提醒你。早期体验期间免费。`)
      : P(`Once confirmed we re-test <b>${d}</b> every day and email you if an AI search crawler gets cut off or a grade changes. Free during early access.`),
    [L.confirm, zh ? '确认并开始监控' : 'Confirm and start monitoring'],
    zh ? '如果不是你本人操作，忽略这封邮件即可，我们不会再发。直接回复本邮件不会有人看到。' : "If this wasn't you, ignore this email and you won't hear from us again. Replies to this address are not read.");
  return { subject, text, html };
}

export function alertMail(rec, alert) {
  const L = links(rec), zh = rec.lang === 'zh', LY = LAYER[zh ? 'zh' : 'en'];
  const { d } = alert;
  const line = (c) => {
    if (c.type === 'blocked') return zh ? `${c.token} 现在被拦${c.silent ? '（静默拦截：robots.txt 允许，防火墙却拦了）' : ''}` : `${c.token} is now blocked${c.silent ? ' (silent block: robots.txt allows it, the firewall does not)' : ''}`;
    if (c.type === 'open') return zh ? `${c.token} 恢复可访问` : `${c.token} can get in again`;
    return zh ? `${LY[c.layer]}：${c.from} → ${c.to}` : `${LY[c.layer]}: ${c.from} → ${c.to}`;
  };
  const lines = d.changes.map(line);
  const subject = d.worse ? (zh ? `${rec.domain}：AI 爬虫访问有变化` : `${rec.domain}: AI crawler access changed`) : (zh ? `${rec.domain}：已恢复` : `${rec.domain}: things look better`);
  const intro = zh ? `今天复测 ${rec.domain}，结果和上次不同（15 分钟后又测了一次，结果一致）：` : `Today's re-test of ${rec.domain} differs from the last one (we checked again 15 minutes later and got the same result):`;
  const text = [intro, '', ...lines.map((l) => '• ' + l), '', (zh ? '完整报告与修复方法：' : 'Full report and how to fix it: ') + L.report, '', (zh ? '停止监控：' : 'Stop monitoring: ') + L.stop].join('\n');
  const color = (c) => (c.worse ? '#C4281C' : '#1A7F37');
  const html = shell(rec.lang, lines[0] || '', subject,
    P(esc(intro)) + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px">${d.changes.map((c, i) => `<tr><td valign="top" style="padding:0 10px 10px 0"><div style="width:10px;height:10px;border-radius:5px;margin-top:6px;background:${color(c)}"></div></td><td style="padding:0 0 10px;font:15px/1.55 ${F};color:#080B14">${esc(lines[i])}</td></tr>`).join('')}</table>`
      + (alert.cur.cdn ? P((zh ? '应答方：' : 'Served by: ') + esc(alert.cur.cdn)) : ''),
    [L.report, zh ? '查看报告和修复方法' : 'View report and fix'],
    (zh ? `你收到这封邮件，是因为你确认了监控 ${esc(rec.domain)}。<a href="${L.stop}" style="color:#6e6e73">停止监控</a>。` : `You're getting this because you confirmed monitoring for ${esc(rec.domain)}. <a href="${L.stop}" style="color:#6e6e73">Stop monitoring</a>.`));
  return { subject, text, html, headers: { 'List-Unsubscribe': '<' + L.stop + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

function page(lang, kind, rec, url) {
  const zh = lang === 'zh';
  const T = {
    bad: zh ? ['链接无效或已过期', '确认链接 2 天内有效。可以回到定价页重新登记。'] : ['This link is invalid or expired', 'Confirmation links last 2 days. You can sign up again from the pricing page.'],
    active: zh ? ['监控已开启', `我们每天复测 ${rec && rec.domain} 一次，有变化会发邮件给 ${rec && rec.email}。`] : ['Monitoring is on', `We'll re-test ${rec && rec.domain} every day and email ${rec && rec.email} when something changes.`],
    askstop: zh ? ['停止监控？', `停止后不再就 ${rec && rec.domain} 发邮件，记录会删除。`] : ['Stop monitoring?', `We'll stop emailing you about ${rec && rec.domain} and delete its records.`],
    stopped: zh ? ['已停止监控', `不会再就 ${rec && rec.domain} 给你发邮件，相关记录已删除。`] : ['Monitoring stopped', `You won't get more emails about ${rec && rec.domain}. Its records are deleted.`]
  }[kind];
  const back = rec ? rec.origin + (rec.rep || '/report/') + rec.domain : '/';
  const h = `<!DOCTYPE html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(T[0])} · VAKSEL</title><link rel="icon" href="/en/brand/vaksel-favicon.svg"></head>
<body style="margin:0;background:#f5f5f7;font-family:${F};color:#080B14"><main style="max-width:520px;margin:12vh auto;padding:32px 28px;background:#fff;border-radius:18px">
<img src="/en/brand/vaksel-horizontal-primary.svg" width="160" alt="VAKSEL" style="display:block;margin-bottom:22px"><h1 style="font-size:24px;margin:0 0 10px">${esc(T[0])}</h1><p style="font-size:16px;line-height:1.6;color:#333336;margin:0 0 22px">${esc(T[1])}</p>
${kind === 'askstop' ? `<form method="post" action="${esc(url.pathname + url.search)}" style="display:inline"><button style="padding:12px 20px;border:0;border-radius:10px;background:#C4281C;color:#fff;font:600 16px ${F};cursor:pointer">${zh ? '停止监控' : 'Stop monitoring'}</button></form> ` : ''}<a href="${esc(back)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#080B14;color:#fff;text-decoration:none;font-weight:600">${rec ? (zh ? '查看报告' : 'View report') : (zh ? '回首页' : 'Home')}</a></main></body></html>`;
  return new Response(h, { status: kind === 'bad' ? 404 : 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
