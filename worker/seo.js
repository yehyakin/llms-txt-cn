/* worker/seo.js — 首页“能不能读 / 能不能被引用”的确定性检查（纯函数，无 IO，Node 可测）
 *
 * 输入：首页 HTML 与少量上下文（最终网址、X-Robots-Tag、sitemap 是否可用、llms.txt 结论）。
 * 输出：{ checks:[{ id, layer:'read'|'cite', status:'pass'|'warn'|'fail'|'info', basis:'official'|'common'|'hypothesis', data }], counts }
 *   basis 说明这条建议的依据：official = 搜索引擎官方文档明确写了；common = 业界普遍做法 / 公开实测；hypothesis = 推测，无官方说法。
 * 文案不在这里，见 en/view.js 的 SEO 字典（中英双语）。不做“GEO 总分”：每条都是可以自己验证的事实。 */

const ATTR_RE = /([^\s=\/>]+)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
function attrs(tag) {
  const o = {}; const inner = tag.replace(/^<\s*[\w:-]+/, '').replace(/\/?>$/, '');
  let m; ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner))) o[m[1].toLowerCase()] = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : '';
  return o;
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch (x) { return m; } }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
}
const strip = (h) => decodeEntities(String(h || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
/* 显示宽度：中日韩字符算 2，其余算 1（标题/描述长度的经验阈值都按英文字符给出） */
export function width(s) { let w = 0; for (const ch of String(s || '')) w += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1; return w; }

export function visibleText(html) {
  return strip(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, ' '));
}

function jsonLd(html) {
  const blocks = []; const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m; while ((m = re.exec(html))) blocks.push(m[1].trim());
  const items = []; let errors = 0;
  const walk = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(walk);
    if (x['@graph']) walk(x['@graph']); if (x['@type']) items.push(x); };
  for (const b of blocks) { try { walk(JSON.parse(b.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ''))); } catch (e) { errors++; } }
  const types = (it) => [].concat(it['@type'] || []).map(String);
  return { blocks: blocks.length, errors, items, types: [...new Set(items.flatMap(types))], has: (re2) => items.filter((it) => types(it).some((t) => re2.test(t))) };
}

const QWORD = /^(什么|如何|怎么|怎样|为什么|为何|是否|能否|可以|哪些|哪个|哪里|多少|how|what|why|when|where|which|who|can|is|are|does|do|should|will)\b|^(什么|如何|怎么|怎样|为什么|为何|是否|能否|哪些|哪个|多少)/i;

export function analyzePage(input) {
  const html = String((input && input.html) || '');
  const finalUrl = (input && input.url) || '';
  const checks = [];
  const add = (id, layer, status, basis, data) => checks.push({ id, layer, status, basis, data: data || {} });
  let base = null; try { base = new URL(finalUrl); } catch (e) {}
  const head = (html.match(/<head\b[\s\S]*?<\/head\s*>/i) || [html.slice(0, 200000)])[0];
  const metas = (head.match(/<meta\b[^>]*>/gi) || []).map(attrs);
  const links = (head.match(/<link\b[^>]*>/gi) || []).map(attrs);
  const meta = (k) => { const x = metas.find((m) => (m.name || m.property || '').toLowerCase() === k); return x ? decodeEntities(x.content || '') : null; };
  const rel = (r) => links.filter((l) => (l.rel || '').toLowerCase().split(/\s+/).includes(r));
  const text = visibleText(html);
  const body = (html.match(/<body\b[\s\S]*/i) || [html])[0];

  /* ---------- 能不能读 ---------- */
  const tm = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = tm ? strip(tm[1]) : '';
  const tw = width(title);
  add('title', 'read', !title ? 'fail' : (tw < 10 || tw > 70) ? 'warn' : 'pass', 'official', { title: title.slice(0, 140), width: tw });

  const desc = (meta('description') || '').trim();
  const dw = width(desc);
  add('description', 'read', !desc ? 'warn' : (dw < 50 || dw > 320) ? 'warn' : 'pass', 'official', { desc: desc.slice(0, 200), width: dw });

  const robotsMeta = metas.filter((m) => /^(robots|googlebot)$/i.test(m.name || '')).map((m) => m.content || '').join(',');
  const dir = (robotsMeta + ',' + ((input && input.xRobots) || '')).toLowerCase();
  const noindex = /\b(noindex|none)\b/.test(dir);
  const nosnippet = /\bnosnippet\b/.test(dir) || /max-snippet\s*:\s*0\b/.test(dir);
  add('indexable', 'read', noindex ? 'fail' : nosnippet ? 'fail' : 'pass', 'official', { noindex, nosnippet, directives: dir.replace(/^,|,$/g, '').slice(0, 120) });

  const canon = rel('canonical');
  let cdata = { count: canon.length };
  let cst = 'warn';
  if (canon.length > 1) cst = 'fail';
  else if (canon.length === 1) {
    let cu = null; try { cu = new URL(canon[0].href || '', finalUrl || undefined); } catch (e) {}
    cdata.href = cu ? cu.href : (canon[0].href || '');
    if (!cu) cst = 'fail';
    else if (base && cu.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) { cst = 'warn'; cdata.otherHost = cu.hostname; }
    else cst = 'pass';
  }
  add('canonical', 'read', cst, 'official', cdata);

  const n = text.length;
  const spa = /<div\b[^>]*id\s*=\s*["'](root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(html);
  add('text', 'read', n < 200 ? 'fail' : n < 600 ? 'warn' : 'pass', 'official', { chars: n, spa });

  const h1 = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1\s*>/gi) || []).map(strip).filter(Boolean);
  add('h1', 'read', h1.length === 1 ? 'pass' : h1.length === 0 ? 'warn' : 'info', 'common', { count: h1.length, first: (h1[0] || '').slice(0, 100) });

  const sm = input && input.sitemap;
  add('sitemap', 'read', !sm ? 'info' : sm.ok ? 'pass' : 'warn', 'official', sm ? { url: sm.url, declared: !!sm.declared, status: sm.status } : {});

  const internal = new Set(); let anchors = 0;
  (body.match(/<a\b[^>]*>/gi) || []).forEach((t) => { const a = attrs(t); if (!a.href || /^(#|javascript:|mailto:|tel:)/i.test(a.href)) return; anchors++;
    try { const u = new URL(decodeEntities(a.href), finalUrl || undefined); if (base && u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '')) internal.add(u.pathname + u.search); } catch (e) {} });
  add('links', 'read', internal.size >= 5 ? 'pass' : 'warn', 'official', { internal: internal.size, anchors });

  const imgs = (body.match(/<img\b[^>]*>/gi) || []).map(attrs);
  const withAlt = imgs.filter((i) => (i.alt || '').trim()).length;
  add('alt', 'read', !imgs.length ? 'info' : withAlt / imgs.length >= 0.8 ? 'pass' : 'warn', 'official', { images: imgs.length, withAlt });

  const hl = links.filter((l) => (l.rel || '').toLowerCase() === 'alternate' && l.hreflang);
  if (hl.length) {
    const bad = hl.filter((l) => !/^(x-default|[a-z]{2,3}(-[a-z0-9]{2,8})*)$/i.test(l.hreflang)).map((l) => l.hreflang);
    const xd = hl.some((l) => l.hreflang.toLowerCase() === 'x-default');
    let self = false; hl.forEach((l) => { try { const u = new URL(l.href, finalUrl || undefined); if (base && u.hostname === base.hostname && u.pathname.replace(/\/$/, '') === base.pathname.replace(/\/$/, '')) self = true; } catch (e) {} });
    add('hreflang', 'read', bad.length ? 'fail' : !self ? 'warn' : 'pass', 'official', { count: hl.length, bad: bad.slice(0, 5), xdefault: xd, self });
  }

  const vp = metas.some((m) => (m.name || '').toLowerCase() === 'viewport');
  add('viewport', 'read', vp ? 'pass' : 'warn', 'official', {});

  /* ---------- 能不能被引用 ---------- */
  const ld = jsonLd(html);
  add('jsonld', 'cite', ld.errors ? 'fail' : ld.blocks ? 'pass' : 'info', 'official', { blocks: ld.blocks, errors: ld.errors, types: ld.types.slice(0, 8) });

  const org = ld.has(/^(Organization|Corporation|LocalBusiness|NewsMediaOrganization|OnlineStore|EducationalOrganization|GovernmentOrganization|Person)$/i)[0]
    || ld.has(/Organization|Business|Store/i)[0];
  if (org) {
    const name = String(org.name || '').trim();
    const sameAs = [].concat(org.sameAs || []).filter(Boolean);
    const logo = !!org.logo;
    const visible = name && (text.toLowerCase().includes(name.toLowerCase()) || title.toLowerCase().includes(name.toLowerCase()));
    add('entity', 'cite', !name ? 'warn' : !visible ? 'warn' : (logo && org.url) ? 'pass' : 'info', 'official', { name: name.slice(0, 80), url: !!org.url, logo, sameAs: sameAs.length, visible: !!visible });
  } else add('entity', 'cite', 'info', 'official', { none: true });

  const site = ld.has(/^WebSite$/i)[0];
  const ogName = meta('og:site_name');
  add('sitename', 'cite', (site && site.name) || ogName ? 'pass' : 'info', 'official', { name: String((site && site.name) || ogName || '').slice(0, 80) });

  const art = ld.has(/Article|BlogPosting|NewsArticle|Report/i)[0];
  const pub = (art && art.datePublished) || meta('article:published_time') || null;
  const mod = (art && art.dateModified) || meta('article:modified_time') || null;
  const timeTag = /<time\b[^>]*datetime\s*=/i.test(body);
  add('dates', 'cite', (pub || mod) ? 'pass' : timeTag ? 'info' : 'info', 'official', { published: pub ? String(pub).slice(0, 25) : null, modified: mod ? String(mod).slice(0, 25) : null, timeTag });

  const author = meta('author') || (art && art.author && (art.author.name || (Array.isArray(art.author) && art.author[0] && art.author[0].name) || (typeof art.author === 'string' && art.author))) || (rel('author').length ? 'rel=author' : null);
  add('author', 'cite', author ? 'pass' : 'info', 'common', { author: author ? String(author).slice(0, 60) : null });

  const heads = []; const hre = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi; let hm;
  while ((hm = hre.exec(body))) heads.push({ text: strip(hm[2]), end: hre.lastIndex });
  let qs = 0, answered = 0; const ex = [];
  heads.forEach((h, i) => {
    if (!(/[?？]\s*$/.test(h.text) || QWORD.test(h.text))) return; qs++;
    const seg = body.slice(h.end, i + 1 < heads.length ? heads[i + 1].end : h.end + 4000);
    const p = (seg.match(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/i) || seg.match(/<(div|dd|li)\b[^>]*>([\s\S]*?)<\/\1\s*>/i) || [])[1];
    const pt = strip(p && p.length > 2 ? p : '');
    if (pt.length >= 20 && width(pt) <= 700) { answered++; if (ex.length < 2) ex.push(h.text.slice(0, 60)); }
  });
  add('answers', 'cite', !qs ? 'info' : answered / qs >= 0.6 ? 'pass' : 'warn', 'hypothesis', { questions: qs, answered, examples: ex });

  const semantic = /<(main|article)\b/i.test(body);
  add('semantic', 'cite', semantic ? 'pass' : 'info', 'common', {});

  const ogt = meta('og:title'), ogi = meta('og:image');
  add('og', 'cite', ogt && ogi ? 'pass' : 'warn', 'common', { title: !!ogt, image: !!ogi });

  const lv = input && input.llms;
  if (lv) add('llms', 'cite', lv === 'real' ? 'pass' : lv === 'html_spoof' ? 'warn' : 'info', 'hypothesis', { verdict: lv });

  const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
  checks.forEach((c) => counts[c.status]++);
  return { checks, counts, url: finalUrl, bytes: html.length };
}
