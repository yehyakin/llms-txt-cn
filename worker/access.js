/* worker/access.js — AI 爬虫“实际能不能进来”的判定（纯函数，无 IO，方便 Node 测试）
 *
 * 输入：relay /probe 返回的原始信号（浏览器基线、Googlebot 与 control-bot 对照组、各 AI 爬虫 UA 的首页响应），
 *       以及 robots.txt 的逐爬虫分析（lib/aiaudit.js 的 access 数组，可缺省）。
 * 为什么要对照组：我们只能用机房 IP 冒充爬虫 UA。很多 WAF 会核验“自称 Googlebot/GPTBot 但 IP 不对”的请求并拦下，
 * 真爬虫从官方 IP 来时其实能进。所以：
 *   - AI UA 被拦，而冒充的 Googlebot 和无名 control-bot 都能进 → 站点专门拦了 AI（高可信）
 *   - AI UA 被拦，冒充的 Googlebot 也被拦 → 站点在核验爬虫身份，真爬虫多半能进（低可信，只提示）
 *   - AI UA 被拦，Googlebot 能进但无名 control-bot 被拦 → 站点拦所有未知爬虫（中可信）
 */

export const PROBE_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot',
  'Claude-User', 'GPTBot', 'ClaudeBot', 'Bytespider', 'PetalBot',
  'Sogou web spider', '360Spider', 'YisouSpider', 'Kimi-SearchBot', 'Kimi-User'];
/* region=cn 的爬虫（data/ai-crawlers.json）单独成组：不计入主评级，报告里另列“中文搜索与 AI 引擎” */
export const isMainSearch = (b) => (b.category === 'search' || b.category === 'user') && b.region !== 'cn';
export const isCnSearch = (b) => (b.category === 'search' || b.category === 'user') && b.region === 'cn';
const FALLBACK_CAT = { PetalBot: 'search', 'Perplexity-User': 'user', 'Claude-User': 'user' };
const BLOCK_CODES = new Set([401, 403, 406, 429, 451, 503, 520, 521, 522, 523, 524, 525, 526, 530]);

function lower(h) { return h || {}; }

export function detectCdn(sig) {
  const h = lower(sig && sig.headers);
  const server = String(h.server || '').toLowerCase();
  if (h['cf-ray'] || server === 'cloudflare') return 'Cloudflare';
  if (h['x-amz-cf-id'] || server.includes('cloudfront')) return 'CloudFront';
  if (h['x-akamai-transformed'] || server.includes('akamai')) return 'Akamai';
  if (h['x-sucuri-id'] || server.includes('sucuri')) return 'Sucuri';
  if (h['x-iinfo']) return 'Imperva';
  if (server.includes('tengine')) return 'Tengine';
  if (/fastly|varnish/.test(String(h.via || '') + server)) return 'Fastly';
  return server ? server.slice(0, 30) : null;
}

/* 单次响应是否“被拦”。返回 null 表示正常，否则返回原因字符串 */
export function blockReason(sig, base) {
  if (!sig) return 'no_response';
  if (sig.error) return 'error:' + sig.error;
  const h = lower(sig.headers);
  if (h['cf-mitigated']) return 'challenge';
  if (BLOCK_CODES.has(sig.status)) return 'http_' + sig.status;
  if (sig.status >= 400) return 'http_' + sig.status;
  if (sig.challenge && (!base || sig.bytes < Math.max(30000, (base.bytes || 0) * 0.3))) return 'challenge';
  return null;
}

function noJsInfo(base) {
  const h = lower(base.headers);
  const directives = (String(base.meta_robots || '') + ',' + String(h['x-robots-tag'] || '')).toLowerCase();
  return {
    text_chars: base.text_chars || 0,
    js_only: (base.text_chars || 0) < 200,
    noindex: /\b(noindex|none)\b/.test(directives),
    nosnippet: /\bnosnippet\b/.test(directives),
    title: base.title || ''
  };
}

/* probe: { kind:'probe', target, results:{browser, Googlebot, 'control-bot', <bot>...} }
 * robotsAccess: aiaudit.analyze(...).access（数组）或 null */
export function classifyAccess(probe, robotsAccess, crawlerData) {
  if (!probe || probe.kind !== 'probe' || !probe.results) {
    return { verdict: 'unknown', reason: 'probe_failed', code: probe && probe.code };
  }
  const R = probe.results;
  const base = R.browser;
  const baseBlock = blockReason(base, null);
  const cdn = detectCdn(base || {});
  if (baseBlock || !base || base.status !== 200) {
    return { verdict: 'inconclusive', reason: 'baseline_blocked', base_reason: baseBlock || ('http_' + (base && base.status)), cdn, target: probe.target };
  }
  const gbBlocked = !!blockReason(R.Googlebot, base);
  const ctlBlocked = !!blockReason(R['control-bot'], base);
  const robotsBy = {};
  (robotsAccess || []).forEach(a => { robotsBy[a.token] = a; });
  const catBy = {};
  ((crawlerData && crawlerData.crawlers) || []).forEach(c => { catBy[c.token] = c; });

  const bots = PROBE_BOTS.map(token => {
    const sig = R[token];
    const why = blockReason(sig, base);
    let firewall = 'open', confidence = null;
    if (why) {
      if (!gbBlocked && !ctlBlocked) { firewall = 'blocked'; confidence = 'high'; }
      else if (!gbBlocked && ctlBlocked) { firewall = 'blocked'; confidence = 'medium'; }
      else { firewall = 'unverified'; confidence = 'low'; }
    } else if (sig && base.text_chars > 500 && sig.text_chars < base.text_chars * 0.3) {
      firewall = 'degraded'; confidence = 'medium';
    }
    const rb = robotsBy[token];
    const robots = rb ? rb.status : 'unknown';
    const meta = catBy[token] || {};
    const category = meta.category || FALLBACK_CAT[token] || 'unknown';
    const robotsBlocked = robots === 'blocked';
    let effective = 'open';
    if (robotsBlocked || (firewall === 'blocked')) effective = 'blocked';
    else if (firewall === 'unverified' || firewall === 'degraded') effective = 'warn';
    return { token, vendor: meta.vendor || (token === 'PetalBot' ? 'Huawei' : null), category, region: meta.region || (token === 'PetalBot' ? 'cn' : null), robots, firewall, confidence,
      reason: why, status: sig && sig.status, silent: firewall === 'blocked' && !robotsBlocked, effective };
  });

  const search = bots.filter(isMainSearch);
  const cn = bots.filter(isCnSearch);
  const silent = search.filter(b => b.silent);
  const blockedSearch = search.filter(b => b.effective === 'blocked');
  const page = noJsInfo(base);
  let verdict = 'open';
  if (page.noindex) verdict = 'noindex';
  else if (blockedSearch.length === search.length && search.length) verdict = 'all_blocked';
  else if (silent.length) verdict = 'silent_block';
  else if (blockedSearch.length) verdict = 'partly_blocked';
  else if (page.js_only) verdict = 'js_only';
  else if (bots.some(b => b.effective === 'warn')) verdict = 'warn';

  return {
    verdict, cdn, target: probe.target,
    controls: { googlebot_spoof_blocked: gbBlocked, unknown_bot_blocked: ctlBlocked },
    counts: { search_total: search.length, search_blocked: blockedSearch.length, silent: silent.length,
      training_blocked: bots.filter(b => b.category === 'training' && b.effective === 'blocked').length,
      cn_total: cn.length, cn_blocked: cn.filter(b => b.effective === 'blocked').length },
    page, bots
  };
}
