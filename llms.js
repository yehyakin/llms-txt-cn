/* llms.js — llms.txt 解析 / 校验 / 生成引擎
 * 纯函数，无 DOM 依赖：浏览器直接 <script src> 引入，Node 下 require() 可跑测试。
 * 校验分级：error 错误 / warn 警告 / suggest 建议 / info 提示。
 * 依据：llmstxt.org v2 规范 + 竞品检查项提炼。           */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.LLMS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- 工具 ---------------- */
  function ulen(s) { return Array.from(s || '').length; }
  function byteLen(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s || '').length;
    return Buffer.byteLength(s || '', 'utf8');
  }
  // 去掉 markdown 链接/自动链接，避免 HTML 检测误报 [a](<url>) 里的尖括号
  function stripMdLinks(line) {
    return line
      .replace(/\[[^\]]*\]\(\s*<[^>]*>\s*\)/g, '[x](u)')
      .replace(/\[[^\]]*\]\([^)]*\)/g, '[x](u)')
      .replace(/<https?:\/\/[^>\s]*>/g, 'URL');
  }
  function checkURL(raw) {
    var u = String(raw == null ? '' : raw).trim().replace(/^<|>$/g, '').trim();
    if (!u) return { kind: 'empty' };
    try {
      var x = new URL(u);
      if (x.protocol === 'http:' || x.protocol === 'https:') return { kind: 'absolute', url: x.href };
      return { kind: 'bad-proto', url: u };
    } catch (e) {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) return { kind: 'bad-proto', url: u };
      if (/\s/.test(u)) return { kind: 'malformed', url: u };
      return { kind: 'relative', url: u };
    }
  }
  function normURL(u) { return u.replace(/\/+$/, '').toLowerCase(); }

  /* 从列表项正文里提取所有 [name](url)（括号配对扫描，容忍 URL 内括号） */
  function extractLinks(body) {
    var out = [], i = 0;
    while (i < body.length) {
      var a = body.indexOf('[', i);
      if (a < 0) break;
      var b = body.indexOf('](', a);
      if (b < 0) break;
      var name = body.slice(a + 1, b), depth = 1, j = b + 2;
      while (j < body.length && depth > 0) {
        if (body[j] === '(') depth++;
        else if (body[j] === ')') depth--;
        j++;
      }
      if (depth !== 0) { // 括号不配对：仍产出一条 broken 记录，让校验报 E5
        out.push({ name: name, url: body.slice(b + 2).trim(), desc: '', rest: '', broken: true });
        break;
      }
      var url = body.slice(b + 2, j - 1);
      var rest = body.slice(j).trim(), desc = '', m = /^[:：]\s*([\s\S]*)$/.exec(rest);
      if (m) desc = m[1];
      out.push({ name: name, url: url, desc: desc, rest: rest });
      i = j;
    }
    return out;
  }

  /* ---------------- 解析 ---------------- */
  function parseLLMS(text) {
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var h1s = [], h2s = [], blockquotes = [], items = [], details = [], beforeH1 = [];
    var phase = 0, cur = null, skipNext = false; // 0:H1前 1:H1后 2:H2区
    for (var i = 0; i < lines.length; i++) {
      if (skipNext) { skipNext = false; continue; }
      var line = lines[i], t = line.trim(), ln = i + 1, m;
      // setext H1：文本行 + 下一行 ===
      if (phase === 0 && t && !/^#{1,6}\s/.test(t) && /^=+\s*$/.test((lines[i + 1] || '').trim())) {
        h1s.push({ line: ln, text: t, setext: true }); phase = 1; skipNext = true; continue;
      }
      if ((m = /^(#{1})\s+(.*?)\s*$/.exec(t))) {
        h1s.push({ line: ln, text: m[2] }); phase = 1; continue;
      }
      if ((m = /^(#{2})\s+(.*?)\s*$/.exec(t))) {
        cur = { line: ln, text: m[2], items: [] }; h2s.push(cur); phase = 2; continue;
      }
      if (/^#{3,}\s+/.test(t)) {
        if (phase === 1) details.push({ line: ln, text: t, deep: true });
        else if (phase === 0) beforeH1.push({ line: ln, text: t });
        continue;
      }
      if (/^>\s?/.test(t)) { blockquotes.push({ line: ln, text: t.replace(/^>\s?/, '') }); continue; }
      if (/^\s*[-*]\s+/.test(line)) {
        var it = { line: ln, body: line.replace(/^\s*[-*]\s+/, ''), inSection: phase === 2 };
        items.push(it); if (cur) cur.items.push(it); continue;
      }
      if (t) {
        if (phase === 0) beforeH1.push({ line: ln, text: t });
        else if (phase === 1) details.push({ line: ln, text: t });
      }
    }
    return { lines: lines, h1s: h1s, h2s: h2s, blockquotes: blockquotes, items: items, details: details, beforeH1: beforeH1 };
  }

  /* ---------------- 校验 ---------------- */
  var UNVERIFIED = [
    { title: '链接可达性', msg: '纯前端受浏览器跨域限制，无法自动请求对方网站做死链检查', fix: '手动点开抽查，或等后端版的自动抽查' },
    { title: '可发现性', msg: '/llms.txt 能否访问、首页 rel=describedby 声明，需手动确认', fix: '浏览器打开 https://你的域名/llms.txt，看能否直接看到文本' },
    { title: 'sitemap / robots 对齐', msg: 'llms.txt 里的 URL 是否在 sitemap 中、robots 是否放行 AI 爬虫，本次未检查', fix: '对照检查一遍，保持三处一致' }
  ];

  function validateLLMS(text) {
    var p = parseLLMS(text), issues = [];
    function push(sev, code, line, msg, fix) { issues.push({ sev: sev, code: code, line: line, msg: msg, fix: fix }); }

    /* E3 H1 存在且唯一 */
    if (p.h1s.length === 0) push('error', 'E3', 1, '缺少 H1 标题：它是规范里唯一必填的章节', '在文件开头加一行「# 站点名称」');
    else if (p.h1s.length > 1)
      p.h1s.slice(1).forEach(function (h) { push('error', 'E3', h.line, 'H1 只能有一个，文件里出现了 ' + p.h1s.length + ' 个', '只保留第一个 H1，其余改成 ## 二级标题'); });
    var h1 = p.h1s[0];

    /* E4 顺序：H1 前不应有实质内容 */
    p.beforeH1.forEach(function (c) { push('error', 'E4', c.line, 'H1 之前不应有实质内容', '把这行移到 H1 之后，或删掉'); });

    /* 摘要位置：应紧跟 H1 */
    if (p.blockquotes.length && h1) {
      var between = true;
      for (var i = h1.line; i < p.blockquotes[0].line - 1; i++)
        if (p.lines[i].trim() !== '') { between = false; break; }
      if (!between) push('suggest', 'W1b', p.blockquotes[0].line, '摘要（引用块）没有紧跟 H1', '把 > 摘要移到 H1 下一行，AI 会优先读它');
    }

    /* 详情区出现三级标题 */
    p.details.forEach(function (d) {
      if (d.deep) push('suggest', 'S1', d.line, '详情区出现了三级及以下标题', '规范建议 H1 与 H2 之间只放段落和列表，标题移到 H2 分组里');
    });

    /* 逐项检查链接 */
    var seenURLs = {}, linkStats = { total: 0, abs: 0, desc: 0 };
    p.items.forEach(function (it) {
      var links = extractLinks(it.body);
      if (!links.length) { push('warn', 'E5b', it.line, '列表项里没有有效的 Markdown 链接', '改成「- [名称](https://…)」格式'); return; }
      if (!it.inSection) push('warn', 'W0', it.line, '链接出现在 H2 分组之前', '把链接放进某个 ## 分组下，结构更清晰');
      links.forEach(function (L) {
        linkStats.total++;
        if (L.broken) { push('error', 'E5', it.line, '链接括号不配对：' + it.body.slice(0, 40), '检查 [名称](URL) 的括号是否成对闭合'); return; }
        if (!L.name.trim()) push('error', 'E5', it.line, '链接名称为空：方括号里没有文字', '给链接起个名字，如 [产品文档](…)');
        var c = checkURL(L.url);
        if (c.kind === 'absolute') {
          linkStats.abs++;
          var n = normURL(c.url);
          if (seenURLs[n]) push('warn', 'W8', it.line, '这个 URL 在第 ' + seenURLs[n] + ' 行出现过', '重复链接删掉一个');
          else seenURLs[n] = it.line;
        }
        else if (c.kind === 'relative') push('warn', 'W3', it.line, '用了相对链接：' + L.url, '改成 https:// 开头的绝对 URL，AI 才能直接打开');
        else if (c.kind === 'empty') push('error', 'E5', it.line, '链接 URL 为空', '填上 https:// 开头的完整地址');
        else if (c.kind === 'malformed') push('error', 'E5', it.line, '链接 URL 含非法字符（如空格）：' + L.url, '检查地址是否写错，空格等字符需要编码');
        else push('error', 'E5', it.line, '链接 URL 无法解析：' + (L.url || '（空）'), '检查括号是否配对、地址是否完整');
        if (L.desc.trim()) {
          linkStats.desc++;
          if (ulen(L.desc) > 500) push('suggest', 'W5b', it.line, '这条描述超过 500 字，有点啰嗦', '精简到一两句话，AI 抓重点更快（我们的建议值，非官方要求）');
        } else {
          push('suggest', 'W9', it.line, '链接没有写描述', '在链接后加「: 一句话描述」，告诉 AI 这个页面是干嘛的');
        }
        if (L.rest && !/^[:：]/.test(L.rest.trim()))
          push('suggest', 'W9b', it.line, '链接后的描述建议用冒号分隔', '改成「[名称](URL): 描述」的格式');
      });
    });

    /* W2 空分组 / 无分组 */
    if (!p.h2s.length) push('suggest', 'W2b', 1, '没有任何 H2 分组', '按主题加几个 ## 分组（如产品、文档、关于），AI 更好定位');
    else p.h2s.forEach(function (h) {
      if (!h.items.length) push('warn', 'W2', h.line, '这个分组下面没有链接', '删掉空分组，或把相关链接放进来');
    });

    /* W4 重复分组名 */
    var seenH2 = {};
    p.h2s.forEach(function (h) {
      var k = h.text.trim().toLowerCase();
      if (seenH2[k]) push('warn', 'W4', h.line, '分组名「' + h.text.trim() + '」在第 ' + seenH2[k] + ' 行出现过', '合并或改名');
      else seenH2[k] = h.line;
      if (/^\s*optional\s*$/i.test(h.text)) push('info', 'W10', h.line, '名为 Optional 的分组按惯例会被 AI 跳过', '别把核心链接放在这里');
    });

    /* W5 长度卫生 */
    if (h1 && ulen(h1.text) > 100) push('suggest', 'W5', h1.line, 'H1 超过 100 字', 'H1 保持简短，一个站名就够（我们的建议值）');
    var meaningful = (h1 ? h1.text : '') + p.blockquotes.map(function (b) { return b.text; }).join('') +
      p.details.map(function (d) { return d.text; }).join('');
    if (p.h1s.length && ulen(meaningful) < 100)
      push('suggest', 'W5c', 1, '有效文字内容偏少（不足 100 字）', '摘要和详情区多写几句，告诉 AI 这个站是干嘛的');

    /* W6 体积 */
    var bytes = byteLen(text);
    if (bytes > 100 * 1024) push('warn', 'W6', 1, '文件超过 100KB（当前约 ' + Math.round(bytes / 1024) + 'KB）', 'llms.txt 的价值是省 token，精简到核心页面');
    else if (bytes > 50 * 1024) push('suggest', 'W6b', 1, '文件超过 50KB（当前约 ' + Math.round(bytes / 1024) + 'KB）', '检查是否有可删的次要链接（我们的建议值）');

    /* W7 格式卫生 */
    var blankRun = 0, badBlank = 0, trailWS = 0;
    p.lines.forEach(function (ln, idx) {
      if (ln.trim() === '') { blankRun++; if (blankRun === 3) badBlank = idx + 1; }
      else blankRun = 0;
      if (/[ \t]+$/.test(ln)) trailWS++;
    });
    if (badBlank) push('suggest', 'W7', badBlank, '出现了连续 3 个以上空行', '删掉多余空行，保持紧凑');
    if (trailWS > 3) push('suggest', 'W7b', 1, '有 ' + trailWS + ' 行行尾带空格', '顺手清掉，不影响解析但不干净');

    /* E6 HTML 污染 */
    p.lines.forEach(function (ln, idx) {
      var s = stripMdLinks(ln);
      if (/<script[\s>]/i.test(s) || /<iframe[\s>]/i.test(s)) { push('error', 'E6', idx + 1, '出现了 script/iframe 标签', '删掉，llms.txt 里不应有可执行代码'); return; }
      if (/<[a-zA-Z][^>\s]*(\s[^>]*)?>/.test(s)) push('warn', 'E6b', idx + 1, '出现了 HTML 标签', '换成纯 Markdown 写法，更干净');
    });

    /* W1 缺摘要 -> 建议（非必填，不判警告） */
    if (h1 && !p.blockquotes.length)
      push('suggest', 'W1', h1.line + 1, 'H1 后面没有一句话摘要', '加一行「> 这是什么网站，一句话讲清」，这是给 AI 的电梯演讲（非必填，但强烈推荐）');

    /* 评分 v0.1：H1 30 / 摘要 20 / H2 30 / 链接 20 */
    var dims = { h1: 0, summary: 0, sections: 0, links: 0 };
    dims.h1 = p.h1s.length === 1 ? 30 : 0;
    var bq0 = p.blockquotes[0];
    dims.summary = bq0 ? (bq0.text.trim() ? 20 : 10) : 0;
    var nonEmpty = p.h2s.filter(function (h) { return h.items.length > 0; }).length;
    dims.sections = Math.min(30, nonEmpty * 10);
    if (linkStats.total > 0)
      dims.links = Math.round(10 * linkStats.abs / linkStats.total + 10 * linkStats.desc / linkStats.total);
    var score = dims.h1 + dims.summary + dims.sections + dims.links;
    var hasError = issues.some(function (x) { return x.sev === 'error'; });
    if (hasError && score > 59) score = 59; // 有不合规项，先修复再谈分数
    var grade = hasError ? '不合规' : score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '可用' : '待改进';

    return {
      issues: issues, dims: dims, score: score, grade: grade, hasError: hasError,
      stats: { bytes: bytes, links: linkStats.total, sections: p.h2s.length },
      unverified: UNVERIFIED
    };
  }

  /* ---------------- 生成 ---------------- */
  function generateLLMS(d) {
    var L = [];
    L.push('# ' + String(d.siteName || '').trim()); L.push('');
    if (String(d.tagline || '').trim()) { L.push('> ' + String(d.tagline).trim()); L.push(''); }
    if (String(d.details || '').trim()) { L.push(String(d.details).trim()); L.push(''); }
    (d.sections || []).forEach(function (s) {
      var title = String(s.title || '').trim(); if (!title) return;
      L.push('## ' + title); L.push('');
      (s.links || []).forEach(function (x) {
        var nm = String(x.name || '').trim(), url = String(x.url || '').trim(), desc = String(x.desc || '').trim();
        if (!nm || !url) return;
        L.push('- [' + nm + '](' + url + ')' + (desc ? ': ' + desc : ''));
      });
      L.push('');
    });
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  return { parseLLMS: parseLLMS, validateLLMS: validateLLMS, generateLLMS: generateLLMS };
});
