/* robots.js — RFC 9309 robots.txt 解析与匹配引擎
 * 纯函数，无 DOM / 网络依赖：浏览器 <script src> 引入得到 window.ROBOTS，Node 下 require()。
 * Worker 端由 scripts/build-worker.mjs 包一层 ESM 导出。
 *
 * 依据 RFC 9309（https://www.rfc-editor.org/rfc/rfc9309）：
 *  - 2.1  行格式、注释、不区分大小写的键名
 *  - 2.2.1 user-agent：产品 token 不区分大小写；多个匹配组的规则合并；无匹配时用 * 组；都没有 = 全允许
 *  - 2.2.2 allow/disallow：最长匹配优先；allow 与 disallow 等价时 allow 胜；百分号编码规范化
 *  - 2.2.3 * 与 $ 特殊字符
 *  - 2.3.1 抓取结果语义：4xx（unavailable）= 可以全抓；5xx/网络不可达（unreachable）= 必须全禁；
 *          超过 5 次重定向可视为 unavailable
 *  - 2.4  /robots.txt 本身总是允许
 *  - 2.5  解析上限至少 500 KiB
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.ROBOTS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_BYTES = 500 * 1024; // RFC 9309 §2.5：至少 500 KiB
  var UNRESERVED = /[A-Za-z0-9\-._~]/;

  /* ---------------- 编码工具 ---------------- */
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8');
    var u = unescape(encodeURIComponent(str)), out = new Uint8Array(u.length);
    for (var i = 0; i < u.length; i++) out[i] = u.charCodeAt(i);
    return out;
  }
  function byteLen(s) { return utf8Bytes(s || '').length; }
  function hex2(b) { return '%' + (b < 16 ? '0' : '') + b.toString(16).toUpperCase(); }

  /* 把字节截断到 limit，并解码为字符串（UTF-8，去 BOM，非法字节替换为 U+FFFD） */
  function decodeLimited(input, limit) {
    limit = limit || MAX_BYTES;
    var bytes;
    if (typeof input === 'string') bytes = utf8Bytes(input);
    else bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    var truncated = bytes.length > limit;
    if (truncated) bytes = bytes.subarray(0, limit);
    var text, invalid = false;
    if (typeof TextDecoder !== 'undefined') {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) { invalid = true; text = new TextDecoder('utf-8').decode(bytes); }
    } else {
      text = Buffer.from(bytes).toString('utf8');
    }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return { text: text, truncated: truncated, bytes: bytes.length, invalidUtf8: invalid };
  }

  /* RFC 9309 §2.2.2：非 ASCII 与不安全字符做百分号编码；%XX 统一大写；
   * 编码后是 unreserved 字符的 %XX 解码回字面量（其余保留字符保持编码，二者不等价）。
   * keepWild=true 时保留模式里的 * 与末尾 $ 作为特殊字符。 */
  function normalizePath(p, keepWild) {
    p = String(p == null ? '' : p);
    var out = '';
    var chars = Array.from(p);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], code = ch.codePointAt(0);
      if (ch === '%' && i + 2 < chars.length + 0 && /^[0-9A-Fa-f]{2}$/.test((chars[i + 1] || '') + (chars[i + 2] || ''))) {
        var b = parseInt(chars[i + 1] + chars[i + 2], 16);
        var c = String.fromCharCode(b);
        if (b < 0x80 && UNRESERVED.test(c)) out += c;
        else out += hex2(b);
        i += 2;
        continue;
      }
      if (code > 0x7E || code < 0x21 || '"<>\\^`{|}'.indexOf(ch) >= 0) {
        var bs = utf8Bytes(ch);
        for (var k = 0; k < bs.length; k++) out += hex2(bs[k]);
        continue;
      }
      out += ch;
    }
    return out;
  }

  /* 从 URL 或路径取出 path+query（不含 fragment） */
  function pathOf(urlOrPath) {
    var s = String(urlOrPath == null ? '/' : urlOrPath);
    var m = /^[a-z][a-z0-9+.-]*:\/\/[^\/?#]*([^#]*)/i.exec(s);
    if (m) s = m[1];
    s = s.split('#')[0];
    if (!s) s = '/';
    if (s.charAt(0) !== '/') s = '/' + s;
    return s;
  }

  /* 模式匹配：起始锚定；* 匹配任意序列；末尾 $ 表示结尾锚定。线性贪心，无正则，避免 ReDoS。 */
  function matchPattern(pattern, path) {
    var anchored = pattern.length > 0 && pattern.charAt(pattern.length - 1) === '$';
    if (anchored) pattern = pattern.slice(0, -1);
    var parts = pattern.split('*');
    if (parts.length === 1) return anchored ? path === pattern : path.indexOf(pattern) === 0;
    if (path.indexOf(parts[0]) !== 0) return false;
    var pos = parts[0].length;
    for (var i = 1; i < parts.length - 1; i++) {
      var idx = path.indexOf(parts[i], pos);
      if (idx < 0) return false;
      pos = idx + parts[i].length;
    }
    var last = parts[parts.length - 1];
    if (!anchored) return path.indexOf(last, pos) >= 0;
    return path.length - last.length >= pos && path.slice(path.length - last.length) === last;
  }

  /* user-agent 行的值 → 产品 token（小写）。RFC：token 只含 [a-zA-Z_-]；
   * 常见写法 "GPTBot/1.0" 取前缀 "gptbot"，并给出提示。 */
  function normalizeToken(raw) {
    var v = String(raw || '').trim();
    if (v === '*') return { token: '*', clean: true };
    var m = /^[A-Za-z_\-]+/.exec(v);
    if (!m) return { token: '', clean: false };
    return { token: m[0].toLowerCase(), clean: m[0].length === v.length };
  }

  var KEY_ALIASES = {
    'user-agent': 'user-agent', 'useragent': 'user-agent', 'user agent': 'user-agent',
    'allow': 'allow', 'disallow': 'disallow', 'dissallow': 'disallow', 'disalow': 'disallow',
    'sitemap': 'sitemap', 'site-map': 'sitemap'
  };

  /* ---------------- 解析 ---------------- */
  function parse(input, opts) {
    opts = opts || {};
    var dec = decodeLimited(input == null ? '' : input, opts.maxBytes || MAX_BYTES);
    var lines = dec.text.split(/\r\n|\r|\n/);
    // 截断时最后一行可能是半行：丢弃
    if (dec.truncated && lines.length > 1) lines.pop();
    var groups = [], sitemaps = [], others = [], warnings = [];
    var cur = null, lastWasAgent = false;
    if (dec.invalidUtf8) warnings.push({ line: 0, code: 'encoding', msg: '文件不是合法 UTF-8，非法字节已按替换字符处理' });
    if (dec.truncated) warnings.push({ line: lines.length, code: 'truncated', msg: '文件超过 500 KiB，超出部分按 RFC 9309 §2.5 忽略' });

    for (var i = 0; i < lines.length; i++) {
      var ln = i + 1, raw = lines[i];
      var noComment = raw.replace(/#.*$/, '');
      var line = noComment.trim();
      if (!line) continue;
      var c = line.indexOf(':');
      if (c < 0) {
        warnings.push({ line: ln, code: 'no_colon', msg: '这一行没有冒号，不是合法的 键: 值 格式，已忽略' });
        continue;
      }
      var keyRaw = line.slice(0, c).trim(), value = line.slice(c + 1).trim();
      var keyLower = keyRaw.toLowerCase();
      var key = KEY_ALIASES[keyLower];
      if (key && key !== keyLower) {
        warnings.push({ line: ln, code: 'key_typo', msg: '键名 "' + keyRaw + '" 不是标准写法（应为 ' + (key === 'user-agent' ? 'User-agent' : key.charAt(0).toUpperCase() + key.slice(1)) + '），部分解析器会忽略' });
      }
      if (key === 'user-agent') {
        var nt = normalizeToken(value);
        if (!nt.token) {
          warnings.push({ line: ln, code: 'bad_agent', msg: 'User-agent 的值 "' + value + '" 不是合法的产品 token，已忽略' });
          continue;
        }
        if (!nt.clean) warnings.push({ line: ln, code: 'agent_extra', msg: 'User-agent 应只写产品 token，"' + value + '" 按 "' + nt.token + '" 匹配（版本号、括号等会被忽略）' });
        if (!cur || !lastWasAgent) {
          cur = { line: ln, agents: [], rules: [] };
          groups.push(cur);
        }
        cur.agents.push({ token: nt.token, raw: value, line: ln });
        lastWasAgent = true;
        continue;
      }
      if (key === 'allow' || key === 'disallow') {
        lastWasAgent = false;
        if (!cur) {
          warnings.push({ line: ln, code: 'rule_before_agent', msg: '规则出现在任何 User-agent 之前，不属于任何组，会被忽略' });
          continue;
        }
        if (value === '') {
          // 空 Disallow = 不限制；空 Allow 无意义。记录但不作为规则参与匹配。
          cur.rules.push({ type: key, path: '', norm: '', line: ln, raw: line, empty: true });
          continue;
        }
        if (value.charAt(0) !== '/' && value.charAt(0) !== '*') {
          warnings.push({ line: ln, code: 'path_no_slash', msg: '路径 "' + value + '" 没有以 / 开头，按 RFC 9309 不会匹配任何 URL' });
        }
        cur.rules.push({ type: key, path: value, norm: normalizePath(value, true), line: ln, raw: line });
        continue;
      }
      if (key === 'sitemap') {
        sitemaps.push({ url: value, line: ln });
        continue; // sitemap 不属于组，也不打断组
      }
      lastWasAgent = false;
      others.push({ key: keyRaw, keyLower: keyLower, value: value, line: ln });
    }
    groups.forEach(function (g) {
      if (!g.rules.length) warnings.push({ line: g.line, code: 'empty_group', msg: '这个 User-agent 组没有任何规则（等于全部允许）' });
    });
    return {
      groups: groups, sitemaps: sitemaps, others: others, warnings: warnings,
      lineCount: lines.length, bytes: dec.bytes, truncated: dec.truncated, text: dec.text, lines: lines
    };
  }

  /* ---------------- 组选择 ---------------- */
  /* 找出某 token 的匹配组：specific（名字相同的所有组合并）> wildcard（所有 * 组合并）> none。
   * opts.noWildcard：AIPREF 策略 token 不匹配 *（draft-kelley-aipref-training-preference-signal §4.2） */
  function selectGroups(parsed, token, opts) {
    opts = opts || {};
    var t = String(token || '').toLowerCase();
    var spec = parsed.groups.filter(function (g) { return g.agents.some(function (a) { return a.token === t; }); });
    if (spec.length) return { source: 'specific', token: t, groups: spec };
    if (!opts.noWildcard) {
      var wild = parsed.groups.filter(function (g) { return g.agents.some(function (a) { return a.token === '*'; }); });
      if (wild.length) return { source: 'wildcard', token: '*', groups: wild };
    }
    return { source: 'none', token: null, groups: [] };
  }

  /* 依次尝试多个 token（如 Applebot 无专属组时按 Googlebot 规则），都没有专属组才回落 * */
  function selectGroupsMulti(parsed, tokens, opts) {
    tokens = [].concat(tokens || []);
    for (var i = 0; i < tokens.length; i++) {
      var s = selectGroups(parsed, tokens[i], { noWildcard: true });
      if (s.source === 'specific') { s.via = i === 0 ? null : tokens[i]; return s; }
    }
    if (opts && opts.noWildcard) return { source: 'none', token: null, groups: [] };
    return selectGroups(parsed, '\u0000no-such-token', opts);
  }

  function rulesOf(groups) {
    var out = [];
    groups.forEach(function (g) { g.rules.forEach(function (r) { if (!r.empty) out.push(r); }); });
    return out;
  }

  /* 对一条路径做判定：最长匹配（按规范化后模式的字节长度），平局 allow 胜。 */
  function decide(rules, urlOrPath) {
    var path = normalizePath(pathOf(urlOrPath), false);
    if (path === '/robots.txt') return { allowed: true, rule: null, implicit: 'robots_txt' };
    var best = null, bestLen = -1;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!matchPattern(r.norm, path)) continue;
      var len = r.norm.length;
      if (len > bestLen || (len === bestLen && r.type === 'allow' && best.type !== 'allow')) {
        best = r; bestLen = len;
      }
    }
    if (!best) return { allowed: true, rule: null };
    return { allowed: best.type === 'allow', rule: best };
  }

  /* 一站式：token(s) + 路径 → 是否允许 */
  function isAllowed(parsed, tokens, urlOrPath, opts) {
    var sel = Array.isArray(tokens) ? selectGroupsMulti(parsed, tokens, opts) : selectGroups(parsed, tokens, opts);
    var d = decide(rulesOf(sel.groups), urlOrPath);
    d.source = sel.source; d.groups = sel.groups; d.via = sel.via || null;
    return d;
  }

  /* RFC 9309 §2.3.1：抓取状态 → 语义 */
  function statusPolicy(httpStatus, opts) {
    opts = opts || {};
    if (opts.unreachable) return 'disallow_all';
    if (opts.tooManyRedirects) return 'allow_all';
    if (httpStatus == null) return 'disallow_all';
    if (httpStatus >= 200 && httpStatus < 300) return 'parse';
    if (httpStatus >= 400 && httpStatus < 500) return 'allow_all';
    if (httpStatus >= 500) return 'disallow_all';
    return 'disallow_all';
  }

  return {
    MAX_BYTES: MAX_BYTES,
    parse: parse,
    normalizePath: normalizePath,
    normalizeToken: normalizeToken,
    matchPattern: matchPattern,
    pathOf: pathOf,
    selectGroups: selectGroups,
    selectGroupsMulti: selectGroupsMulti,
    rulesOf: rulesOf,
    decide: decide,
    isAllowed: isAllowed,
    statusPolicy: statusPolicy,
    decodeLimited: decodeLimited,
    byteLen: byteLen
  };
});
