// 盯官方爬虫文档：抓 data/ai-crawlers.json 里每个 docs_url，去掉 HTML 后做哈希，并检查各 token 是否仍出现在原文里。
// 用法：node scripts/watch-docs.mjs            只比较，打印变化，有变化时退出码 1（给定时任务用）
//       node scripts/watch-docs.mjs --record   把当前结果写回 data/doc-watch.json 作为新基线
// 发现变化后由人核对原文，再在 data/crawler-changelog.json 里手写一条，重跑 build-en.mjs。不自动发布。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DATA = JSON.parse(readFileSync(new URL('../data/ai-crawlers.json', import.meta.url), 'utf8'));
const STATE_F = new URL('../data/doc-watch.json', import.meta.url);
const state = existsSync(STATE_F) ? JSON.parse(readFileSync(STATE_F, 'utf8')) : { docs: {} };
const record = process.argv.includes('--record');

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
  if (!prev || !prev.hash) { console.log(`+  ${url} 新基线 ${hash}`); continue; }
  if (prev.hash !== hash) {
    const d = { url, tokens, from: prev.hash, to: hash, chars: [prev.chars, t.length], lost: lost.filter((k) => (prev.found || tokens).includes(k)) };
    changes.push(d);
    console.log(`!! ${url} 内容变了 ${prev.hash} → ${hash}（${prev.chars} → ${t.length} 字符）${d.lost.length ? ' 原文不再出现: ' + d.lost.join(', ') : ''}`);
  } else console.log(`=  ${url}`);
}
if (record) { writeFileSync(STATE_F, JSON.stringify(next, null, 1) + '\n'); console.log('已写入 data/doc-watch.json'); }
console.log(`${Object.keys(byUrl).length} 个文档，${changes.length} 个有变化`);
process.exit(changes.length && !record ? 1 : 0);
