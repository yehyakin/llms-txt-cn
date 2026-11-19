// 盯官方爬虫文档：抓 data/ai-crawlers.json 里每个 docs_url，去掉 HTML 后做哈希，并检查各 token 是否仍出现在原文里。
// 用法：node scripts/watch-docs.mjs            只比较，打印变化，有变化时退出码 1（给定时任务用）
//       node scripts/watch-docs.mjs --record   把当前结果写回 data/doc-watch.json 作为新基线
//       node scripts/watch-docs.mjs --report work.json   另把变化明细（增删句子、疑似新 UA）写成 JSON，给自动写日志的定时任务用
// 正文快照存 data/doc-snapshots/<id>.txt（每句一行），--record 时更新。变化如何写成日志条目见 notes/changelog-template.md。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DATA = JSON.parse(readFileSync(new URL('../data/ai-crawlers.json', import.meta.url), 'utf8'));
const STATE_F = new URL('../data/doc-watch.json', import.meta.url);
const state = existsSync(STATE_F) ? JSON.parse(readFileSync(STATE_F, 'utf8')) : { docs: {} };
const record = process.argv.includes('--record');
const ri = process.argv.indexOf('--report'); const reportF = ri > 0 ? process.argv[ri + 1] : null;
const SNAP = new URL('../data/doc-snapshots/', import.meta.url);
const known = new Set(DATA.crawlers.map((c) => c.token.toLowerCase()));
const sid = (u) => createHash('sha1').update(u).digest('hex').slice(0, 10);
const sentences = (t) => [...new Set(t.split(/(?<=[.!?。！？])\s+|\s{2,}/).map((x) => x.trim()).filter((x) => x.length > 2))];
const RELEVANT = /robots|user[- ]?agent|crawl|\bbots?\b|spider|opt[- ]?out|disallow|ip (address|range)|\.json\b|training|index|fetch|爬虫|抓取/i;
const UA_RE = /\b[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*(?:Bot|bot|Spider|spider|-User|-Agent|-Extended|-Index|-Training|-Fetcher|Fetcher|-SearchBot)\b/g;
const uaCands = (t) => new Set((t.match(UA_RE) || []).map((x) => x.trim()));

const byUrl = {};
for (const c of DATA.crawlers) if (c.docs_url) (byUrl[c.docs_url] ||= []).push(c.token);

function text(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '') // 去掉页面上的时钟类噪声
    .replace(/\s+/g, ' ').trim();
}

async function grab(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; VAKSEL-docwatch/1.0; +https://vaksel.com/bots/)', 'accept-language': 'en' } });
    const body = await r.text();
    return { status: r.status, body };
  } catch (e) { return { status: 0, error: String(e.cause?.code || e.message) }; }
}

const now = new Date().toISOString();
const changes = [];
const next = { checked_at: now, docs: {} };
for (const [url, tokens] of Object.entries(byUrl)) {
  const r = await grab(url);
  const prev = state.docs[url];
  if (r.status !== 200) {
    next.docs[url] = { ...(prev || {}), tokens, last_error: r.error || `HTTP ${r.status}`, last_error_at: now };
    console.log(`?? ${url} — ${r.error || 'HTTP ' + r.status}（不算变化，保留旧基线）`);
    continue;
  }
  const t = text(r.body);
  if (t.length < 300) { // 正文靠 JavaScript 渲染，静态抓取只拿到空壳，哈希没有意义
    next.docs[url] = { tokens, js_only: true, chars: t.length };
    console.log(`JS ${url} — 正文需 JavaScript 渲染（${t.length} 字符），此脚本看不到，需人工或浏览器查看`);
    continue;
  }
  const hash = createHash('sha256').update(t).digest('hex').slice(0, 16);
  const low = t.toLowerCase();
  const found = tokens.filter((k) => low.includes(k.toLowerCase()));
  const lost = tokens.filter((k) => !found.includes(k));
  next.docs[url] = { tokens, hash, chars: t.length, found, since: prev && prev.hash === hash ? prev.since : now };
  const sf = new URL(sid(url) + '.txt', SNAP);
  const now_s = sentences(t);
  if (record) { mkdirSync(SNAP, { recursive: true }); writeFileSync(sf, now_s.join('\n') + '\n'); }
  if (!prev || !prev.hash) { console.log(`+  ${url} 新基线 ${hash}`); continue; }
  if (prev.hash !== hash) {
    const old_s = existsSync(sf) ? readFileSync(sf, 'utf8').split('\n').filter(Boolean) : null;
    const oldSet = new Set(old_s || []), newSet = new Set(now_s);
    const added = old_s ? now_s.filter((x) => !oldSet.has(x)) : null;
    const removed = old_s ? old_s.filter((x) => !newSet.has(x)) : null;
    const oldText = (old_s || []).join(' ');
    const newUA = old_s ? [...uaCands(t)].filter((k) => !known.has(k.toLowerCase()) && !oldText.includes(k)) : [];
    const goneUA = old_s ? [...uaCands(oldText)].filter((k) => !t.includes(k)) : [];
    const d = { url, snapshot: `data/doc-snapshots/${sid(url)}.txt`, tokens, from: prev.hash, to: hash, chars: [prev.chars, t.length], lost: lost.filter((k) => (prev.found || tokens).includes(k)),
      no_snapshot: !old_s, new_ua_candidates: newUA, gone_ua_candidates: goneUA,
      added_relevant: (added || []).filter((x) => RELEVANT.test(x)).slice(0, 40), removed_relevant: (removed || []).filter((x) => RELEVANT.test(x)).slice(0, 40),
      added_count: added ? added.length : null, removed_count: removed ? removed.length : null };
    changes.push(d);
    console.log(`!! ${url} 内容变了 ${prev.hash} → ${hash}（${prev.chars} → ${t.length} 字符）${d.lost.length ? ' 原文不再出现: ' + d.lost.join(', ') : ''}`);
  } else console.log(`=  ${url}`);
}
if (reportF) writeFileSync(reportF, JSON.stringify({ checked_at: now, changes, js_only: Object.entries(next.docs).filter(([, v]) => v.js_only).map(([u]) => u), errors: Object.entries(next.docs).filter(([, v]) => v.last_error_at === now).map(([u, v]) => ({ url: u, error: v.last_error })) }, null, 1));
if (record) { writeFileSync(STATE_F, JSON.stringify(next, null, 1) + '\n'); console.log('已写入 data/doc-watch.json'); }
console.log(`${Object.keys(byUrl).length} 个文档，${changes.length} 个有变化`);
process.exit(changes.length && !record ? 1 : 0);
