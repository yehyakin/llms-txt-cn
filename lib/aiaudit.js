/* aiaudit.js — AI 爬虫与训练规则分析 + robots.txt 生成器
 * 依赖 robots.js（浏览器全局 ROBOTS / Node require）。纯函数，前后端共用。
 * 报告分三块：access 可访问 / training 可训练 / discover 可发现（llms.txt，由前端用 llms.js 打分）。
 * 不出综合总分。 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./robots.js'));
  else root.AIAUDIT = factory(root.ROBOTS);
})(typeof self !== 'undefined' ? self : this, function (ROBOTS) {
  'use strict';

  var POLICY_TOKEN = '__usage_ai-training';
  var CAT_ZH = { training: '训练', training_control: '训练控制', search: '搜索索引', user: '用户触发', dataset: '开放数据集' };

  function lc(s) { return String(s || '').toLowerCase(); }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (x != null && !s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function agentLines(groups) { var o = []; groups.forEach(function (g) { g.agents.forEach(function (a) { o.push(a.line); }); }); return o; }
  function ruleLines(groups) { var o = []; groups.forEach(function (g) { g.rules.forEach(function (r) { o.push(r.line); }); }); return o; }

  /* 某 token 的访问状态：allowed（无生效的禁止规则）/ partial（根允许，部分路径禁止）/ blocked（根禁止） */
  function accessOf(parsed, crawler) {
    var tokens = [crawler.token].concat(crawler.fallback_tokens || []);
    var d = ROBOTS.isAllowed(parsed, tokens, '/');
    var rules = ROBOTS.rulesOf(d.groups);
    var disallows = rules.filter(function (r) { return r.type === 'disallow'; });
    var allows = rules.filter(function (r) { return r.type === 'allow'; });
    var status = !d.allowed ? 'blocked' : (disallows.length ? 'partial' : 'allowed');
    return {
      status: status, source: d.source, via: d.via,
      rule: d.rule ? { line: d.rule.line, raw: d.rule.raw } : null,
      lines: uniq(agentLines(d.groups).concat(d.rule ? [d.rule.line] : [])).sort(function (a, b) { return a - b; }),
      groupLines: agentLines(d.groups),
      exceptions: !d.allowed ? allows.map(function (r) { return { path: r.path, line: r.line }; }) : disallows.map(function (r) { return { path: r.path, line: r.line }; }),
      rulesCount: rules.length
    };
  }

  /* AIPREF 训练偏好：只看 __usage_ai-training 组（不匹配 *） */
  function aiprefOf(parsed) {
    var sel = ROBOTS.selectGroups(parsed, POLICY_TOKEN, { noWildcard: true });
    if (sel.source === 'none') return { state: 'none', lines: [] };
    var rules = ROBOTS.rulesOf(sel.groups);
    var root = ROBOTS.decide(rules, '/');
    var opp = rules.filter(function (r) { return root.allowed ? r.type === 'disallow' : r.type === 'allow'; });
    var mixedWith = [];
    sel.groups.forEach(function (g) { g.agents.forEach(function (a) { if (a.token !== POLICY_TOKEN) mixedWith.push(a); }); });
    return {
      state: root.allowed ? (opp.length ? 'allow_with_exceptions' : 'allow') : (opp.length ? 'disallow_with_exceptions' : 'disallow'),
      rootAllowed: root.allowed,
      rootRule: root.rule ? { line: root.rule.line, raw: root.rule.raw } : null,
      exceptions: opp.map(function (r) { return { path: r.path, type: r.type, line: r.line }; }),
      lines: uniq(agentLines(sel.groups).concat(ruleLines(sel.groups))).sort(function (a, b) { return a - b; }),
      groupLines: agentLines(sel.groups),
      mixedWith: mixedWith
    };
  }

  function F(list, o) { list.push(o); return o; }

  /* ---------------- 主分析 ----------------
   * input: { text, http_status, unreachable, tooManyRedirects, truncated? }
   * data:  data/ai-crawlers.json 内容 */
  function analyze(input, data) {
    input = input || {};
    var crawlers = (data && data.crawlers) || [];
    var policy = ROBOTS.statusPolicy(input.http_status, { unreachable: input.unreachable, tooManyRedirects: input.tooManyRedirects });
    var findings = [];
    var parsed;
    if (policy === 'parse') parsed = ROBOTS.parse(input.text || '');
    else if (policy === 'allow_all') parsed = ROBOTS.parse('');
    else parsed = ROBOTS.parse('User-agent: *\nDisallow: /');

    var fetch = { policy: policy, http_status: input.http_status == null ? null : input.http_status };
    if (policy === 'disallow_all') {
      F(findings, { id: 'fetch_unreachable', sev: 'error', block: 'access',
        title: input.unreachable ? 'robots.txt 无法访问（网络错误/超时）' : 'robots.txt 返回 ' + input.http_status + ' 服务器错误',
        detail: '按 RFC 9309 §2.3.1.4，robots.txt 处于"不可达"状态时，遵守规范的爬虫必须假定整站禁止抓取。也就是说，现在所有遵守 robots 的搜索和 AI 爬虫都会把你的站当成全禁。',
        fix: '让 /robots.txt 稳定返回 200（哪怕内容为空），或者在确实没有该文件时返回 404。检查 WAF/CDN 是否对爬虫返回 5xx 或超时。',
        lines: [], refs: ['https://www.rfc-editor.org/rfc/rfc9309#section-2.3.1.4'] });
    } else if (policy === 'allow_all') {
      F(findings, { id: 'fetch_unavailable', sev: 'info', block: 'access',
        title: input.tooManyRedirects ? 'robots.txt 重定向超过 5 次' : '没有 robots.txt（HTTP ' + input.http_status + '）',
        detail: '按 RFC 9309 §2.3.1.3，robots.txt 不可用（4xx，或重定向超过 5 次）时爬虫可以抓取任何资源：所有爬虫都被允许，也没有表达任何训练偏好。' + (input.http_status === 429 ? '注意：429 虽是 4xx，但 Google 等会把它当作服务器错误处理，可能反而全禁。' : '') +
          ([401, 403, 412, 429, 451].indexOf(input.http_status) >= 0 ? '另外，' + input.http_status + ' 常见于 WAF / 防火墙拦截了我们的检测请求，真实爬虫看到的结果可能不同——建议用浏览器打开 /robots.txt 确认，或把内容粘贴到「robots 生成」页的分析框。' : ''),
        fix: '如果你有想限制的爬虫或训练用途，用下方 robots.txt 生成器写一份放到根目录。',
        lines: [], refs: ['https://www.rfc-editor.org/rfc/rfc9309#section-2.3.1.3'] });
    }
    if (parsed.truncated || input.truncated) {
      F(findings, { id: 'truncated', sev: 'warn', block: 'access', title: 'robots.txt 超过 500 KiB',
        detail: 'RFC 9309 §2.5 要求解析器至少处理前 500 KiB；超出部分可能被忽略，写在后面的规则对部分爬虫无效。',
        fix: '精简规则（合并重复组、用通配符代替逐条列举），把关键规则放在文件前部。', lines: [], refs: ['https://www.rfc-editor.org/rfc/rfc9309#section-2.5'] });
    }

    // 解析警告：同类合并成一条，避免长 robots.txt 刷屏
    if (policy === 'parse') {
      var byCode = {}, codes = [];
      parsed.warnings.forEach(function (w) {
        if (w.code === 'truncated') return;
        if (!byCode[w.code]) { byCode[w.code] = []; codes.push(w.code); }
        byCode[w.code].push(w);
      });
      codes.forEach(function (code) {
        var ws = byCode[code];
        F(findings, { id: 'parse_' + code, sev: (code === 'rule_before_agent' || code === 'path_no_slash' || code === 'key_typo') ? 'warn' : 'info',
          block: 'access', title: ws.length === 1 ? ws[0].msg : (WARN_TITLE[code] || ws[0].msg) + '（' + ws.length + ' 处）',
          detail: ws.length > 1 ? ws.slice(0, 6).map(function (w) { return 'L' + w.line + '：' + w.msg; }).join('\n') + (ws.length > 6 ? '\n……' : '') : '',
          fix: fixForWarning(code), lines: ws.map(function (w) { return w.line; }).filter(Boolean) });
      });
    }

    /* ---- 可访问 ---- */
    var access = crawlers.map(function (c) {
      var a = accessOf(parsed, c);
      a.token = c.token; a.vendor = c.vendor; a.category = c.category; a.region = c.region || null; a.respects_robots = c.respects_robots;
      a.control_only = !!c.control_only; a.verification = c.verification;
      return a;
    });
    var byToken = {}; access.forEach(function (a) { byToken[lc(a.token)] = a; });
    var cByToken = {}; crawlers.forEach(function (c) { cByToken[lc(c.token)] = c; });

    if (policy === 'parse') {
      var wildSel = ROBOTS.selectGroups(parsed, '\u0000', {});
      var wildRules = ROBOTS.rulesOf(wildSel.groups);
      var wildRoot = ROBOTS.decide(wildRules, '/');
      var wildDisallows = wildRules.filter(function (r) { return r.type === 'disallow'; });

      // C1：* 全禁，但个别 AI 爬虫专属组放开
      if (wildSel.source === 'wildcard' && !wildRoot.allowed) {
        var opened = access.filter(function (a) { return a.source === 'specific' && a.status !== 'blocked'; });
        var openedTrain = opened.filter(function (a) { return a.category === 'training' || a.category === 'training_control' || a.category === 'dataset'; });
        if (opened.length) {
          F(findings, { id: 'wildcard_block_specific_open', sev: openedTrain.length ? 'warn' : 'info', block: 'access',
            title: 'User-agent: * 全禁，但 ' + opened.map(function (a) { return a.token; }).join('、') + ' 被单独放开',
            detail: 'RFC 9309 §2.2.1：爬虫只要有自己名字的组，就只看那个组，完全不再看 * 组。所以这些爬虫可以抓取（' +
              opened.map(function (a) { return a.token + '：' + CAT_ZH[a.category]; }).join('；') + '）。' + (openedTrain.length ? '其中 ' + openedTrain.map(function (a) { return a.token; }).join('、') + ' 属于训练类，等于允许它用你的内容训练。' : '放开的都是搜索类，这是常见的白名单写法；注意它们同样不会遵守 * 组里的其他规则。'),
            fix: '确认这是有意为之。若只想放开搜索类、拒绝训练类，保留 OAI-SearchBot、Claude-SearchBot 等搜索 token 的放行组，删掉 GPTBot、ClaudeBot 等训练 token 的放行组。',
            lines: uniq([].concat.apply(agentLines(wildSel.groups).concat(wildRoot.rule ? [wildRoot.rule.line] : []), opened.map(function (a) { return a.groupLines; }))).sort(function (a, b) { return a - b; }),
            refs: ['https://www.rfc-editor.org/rfc/rfc9309#section-2.2.1'] });
        }
      }
      // C1b：专属组不继承 * 的禁止规则
      if (wildSel.source === 'wildcard' && wildDisallows.length) {
        var noInherit = [];
        parsed.groups.forEach(function (g) {
          if (g.agents.some(function (a) { return a.token === '*' || a.token === POLICY_TOKEN; })) return;
          var own = g.rules.filter(function (r) { return !r.empty; });
          if (!ROBOTS.decide(own, '/').allowed) return; // 整组根禁止，不存在"漏继承"
          var missing = wildDisallows.filter(function (wr) { return !own.some(function (r) { return r.type === 'disallow' && r.norm === wr.norm; }); });
          if (missing.length && wildRoot.allowed) noInherit.push({ g: g, missing: missing });
        });
        if (noInherit.length) {
          F(findings, { id: 'no_inherit', sev: 'warn', block: 'access',
            title: '专属组不会继承 User-agent: * 的禁止路径',
            detail: noInherit.map(function (x) { return x.g.agents.map(function (a) { return a.raw; }).join('/') + ' 组缺少 ' + x.missing.slice(0, 4).map(function (r) { return r.path; }).join('、') + (x.missing.length > 4 ? ' 等' : ''); }).join('；') +
              '。这些爬虫不会遵守 * 组里的这些禁止规则，例如后台、搜索结果页可能被它们抓取。',
            fix: '把需要对所有爬虫生效的 Disallow 行，复制到每个专属组里（生成器会自动这么做）。',
            lines: uniq([].concat.apply(wildDisallows.map(function (r) { return r.line; }), noInherit.map(function (x) { return agentLines([x.g]); }))).sort(function (a, b) { return a - b; }),
            refs: ['https://www.rfc-editor.org/rfc/rfc9309#section-2.2.1'] });
        }
      }

      // C4：搜索类爬虫被误伤（专属组禁止：逐条；被 * 连带禁止：合并成一条）
      var sb = access.filter(function (a) { return a.category === 'search' && a.status === 'blocked'; });
      sb.filter(function (a) { return a.source !== 'wildcard'; }).forEach(function (a) {
        var c = cByToken[lc(a.token)];
        F(findings, { id: 'search_blocked_' + lc(a.token), sev: 'warn', block: 'access',
          title: a.token + '（' + a.vendor + ' 搜索）被禁止' + (a.via ? '（按 ' + a.via + ' 的规则）' : ''),
          detail: c.block_consequence_zh || '',
          fix: '如果你希望出现在该搜索 / AI 答案中，改为：\nUser-agent: ' + a.token + '\nAllow: /',
          lines: a.lines, refs: [c.docs_url] });
      });
      var sbw = sb.filter(function (a) { return a.source === 'wildcard'; });
      if (sbw.length) {
        F(findings, { id: 'search_blocked_wildcard', sev: 'warn', block: 'access',
          title: 'User-agent: * 连带禁止了 ' + sbw.length + ' 个搜索类爬虫',
          detail: sbw.map(function (a) { return a.token + '（' + a.vendor + '）：' + (cByToken[lc(a.token)].block_consequence_zh || ''); }).join('\n'),
          fix: '为想保留的搜索爬虫单独放行，例如：\nUser-agent: OAI-SearchBot\nUser-agent: Claude-SearchBot\nUser-agent: Googlebot\nUser-agent: Bingbot\nUser-agent: Baiduspider\nAllow: /\n（* 组里仍需生效的 Disallow 路径要复制进这个组）',
          lines: sbw[0].lines, refs: sbw.map(function (a) { return cByToken[lc(a.token)].docs_url; }) });
      }

      // C5：用户触发类，robots 可能拦不住
      var ub = access.filter(function (a) {
        var c = cByToken[lc(a.token)];
        return a.category === 'user' && a.status !== 'allowed' && (c.respects_robots === 'no' || c.respects_robots === 'partial');
      });
      if (ub.length) {
        F(findings, { id: 'user_ignores', sev: 'info', block: 'access',
          title: ub.map(function (a) { return a.token; }).join('、') + ' 被限制，但它们可能不遵守 robots.txt',
          detail: ub.map(function (a) { return a.token + '：' + (cByToken[lc(a.token)].block_consequence_zh || ''); }).join('\n'),
          fix: '真要拦截需在 WAF / CDN 层按 UA + 官方 IP 段处理；如果只是不想被训练，禁止训练 token 即可，不必拦用户触发的访问。',
          lines: uniq([].concat.apply([], ub.map(function (a) { return a.lines; }))).sort(function (a, b) { return a - b; }),
          refs: ub.map(function (a) { return cByToken[lc(a.token)].docs_url; }) });
      }

      // C8：Applebot 跟随 Googlebot
      var ab = byToken['applebot'];
      if (ab && ab.via) {
        F(findings, { id: 'applebot_follows_googlebot', sev: 'info', block: 'access', title: 'Applebot 没有专属组，会按 Googlebot 的规则执行',
          detail: 'Apple 官方说明：robots.txt 没提到 Applebot 但提到 Googlebot 时，Applebot 遵循 Googlebot 的规则。当前 Applebot 状态：' + statusZh(ab.status) + '。',
          fix: '如需不同对待，单独写 User-agent: Applebot 组。', lines: ab.lines, refs: [cByToken['applebot'].docs_url] });
      }

      // crawl-delay
      var cd = parsed.others.filter(function (o) { return o.keyLower === 'crawl-delay'; });
      if (cd.length) F(findings, { id: 'crawl_delay', sev: 'info', block: 'access', title: '使用了 Crawl-delay（非标准指令）',
        detail: 'RFC 9309 未定义 Crawl-delay。官方文档中：Anthropic 支持；Applebot 不遵循；Amazon 的爬虫不支持。Google 抓取频率需在 Search Console 调整。',
        fix: '不要依赖 Crawl-delay 控制压力，改用各家站长工具或服务器限流。', lines: cd.map(function (o) { return o.line; }),
        refs: ['https://support.apple.com/en-us/119829', 'https://developer.amazon.com/amazonbot'] });

      // Cloudflare Content-Signal
      var cs = parsed.others.filter(function (o) { return o.keyLower === 'content-signal'; });
      if (cs.length) F(findings, { id: 'content_signal', sev: 'info', block: 'training', title: '检测到 Content-Signal 行（Cloudflare 内容信号）',
        detail: 'Content-Signal 是 Cloudflare 提出的扩展，与 IETF 的 __usage_ai-training 是两套机制；标准 RFC 9309 解析器会忽略它。本工具不把它当作 AIPREF 训练偏好。',
        fix: '如需按 AIPREF 草案表态，另写 User-agent: __usage_ai-training 组。', lines: cs.map(function (o) { return o.line; }) });
    }

    /* ---- 可训练 ---- */
    var aipref = policy === 'parse' ? aiprefOf(parsed) : { state: 'none', lines: [] };
    var vtt = (data && data.vendor_training_tokens) || {};
    var training = Object.keys(vtt).map(function (vendor) {
      var tok = vtt[vendor], a = byToken[lc(tok)];
      if (!a) return null;
      var explicitAllow = a.source === 'specific' && a.status !== 'blocked';
      var reading;
      if (policy === 'disallow_all') reading = 'robots.txt 不可达，遵守规范的爬虫视为全禁，暂不会抓取。';
      else if (a.status === 'blocked') reading = '已用厂商专用 token 拒绝（现行有效）。';
      else if (aipref.state === 'disallow' || aipref.state === 'disallow_with_exceptions') {
        reading = explicitAllow ? '你显式允许了 ' + tok + '，按草案"更具体优先"，该厂商大概率按 ' + tok + ' 的允许执行，__usage_ai-training 的拒绝对它可能无效。'
          : '现行机制下仍允许；该厂商实现 __usage_ai-training 后将按你的拒绝执行。';
      } else reading = a.status === 'partial' ? '允许，但部分路径被禁止。' : '允许（未拒绝）。';
      return { vendor: vendor, token: tok, status: a.status, source: a.source, lines: a.lines, explicitAllow: explicitAllow, reading: reading };
    }).filter(Boolean);

    var pt = ((data && data.policy_tokens) || [])[0] || null;
    if (policy === 'parse') {
      var wsel = ROBOTS.selectGroups(parsed, '\u0000', {});
      var wroot = ROBOTS.decide(ROBOTS.rulesOf(wsel.groups), '/');
      // C3：以为 * 已表态训练偏好
      if (aipref.state === 'none' && wsel.source === 'wildcard' && !wroot.allowed) {
        F(findings, { id: 'wildcard_not_aipref', sev: 'info', block: 'training', title: 'User-agent: * 全禁 ≠ 表达了训练偏好',
          detail: '按 AIPREF 草案 §4.2，* 组不匹配 __usage_ai-training，没有该 token 的组就是"未表态"。现在 * 全禁对遵守 robots 的爬虫仍然有效，但在新机制下你并没有声明拒绝训练。',
          fix: '如需明确拒绝训练，追加：\nUser-agent: __usage_ai-training\nDisallow: /', lines: agentLines(wsel.groups), refs: [pt && pt.spec_url] });
      }
      // C2：训练 token 拒绝，但厂商 token 显式允许
      if (aipref.state === 'disallow' || aipref.state === 'disallow_with_exceptions') {
        var over = training.filter(function (t) { return t.explicitAllow; });
        over.forEach(function (t) {
          var isG = t.token === 'Google-Extended';
          F(findings, { id: 'aipref_overridden_' + lc(t.token), sev: 'warn', block: 'training',
            title: '__usage_ai-training 拒绝训练，但 ' + t.token + ' 被显式允许',
            detail: isG ? 'Google 官方：只有在"未显式写 Google-Extended"时，才把 __usage_ai-training 的拒绝视同禁止 Google-Extended；显式允许 Google-Extended 的网站，内容仍可用于 Gemini 训练，并有资格出现在 Gemini Apps 的 grounding 回答中。'
              : '草案 §4.5：更具体的表达优先，厂商可把自己的专有 token 视为比 __usage_ai-training 更具体。你对 ' + t.token + ' 的显式允许很可能让 ' + t.vendor + ' 继续用于训练。',
            fix: '若本意是拒绝训练，删除 ' + t.token + ' 的 Allow 组，或改为：\nUser-agent: ' + t.token + '\nDisallow: /' + (isG ? '\n（若是为了保留 Gemini grounding 引用而有意放开，可忽略本条）' : ''),
            lines: uniq(aipref.lines.concat(t.lines)).sort(function (a, b) { return a - b; }),
            refs: isG ? ['https://developers.google.com/search/blog/2026/10/ai-training-control'] : [pt && pt.spec_url] });
        });
        F(findings, { id: 'aipref_not_crawl', sev: 'info', block: 'training', title: '__usage_ai-training 只表达用途偏好，不是抓取指令',
          detail: '草案 §4.4：该 token 不限制抓取；各厂商支持进度不同（Anthropic 已开始实现，OpenAI 未来几个月，Microsoft 2027-02-01，Google 2027 年初）。在厂商落地前，它不会立刻改变训练行为。',
          fix: '过渡期内保留 GPTBot、ClaudeBot、Google-Extended、Applebot-Extended 等厂商 token 的禁止规则，两套一起写。',
          lines: aipref.lines, refs: [pt && pt.spec_url] });
      }
      if (aipref.mixedWith && aipref.mixedWith.length) {
        F(findings, { id: 'aipref_mixed_group', sev: 'warn', block: 'training', title: '__usage_ai-training 与爬虫 token 写在了同一组',
          detail: '同组的 ' + aipref.mixedWith.map(function (a) { return a.raw; }).join('、') + ' 也会受这些规则约束——' + (aipref.mixedWith.some(function (a) { return a.token === '*'; }) ? '其中包括 *，等于对所有爬虫生效，' : '') + '规则会同时限制它们的抓取，而不仅是训练用途。',
          fix: '把 User-agent: __usage_ai-training 单独成组。', lines: aipref.groupLines.concat(aipref.mixedWith.map(function (a) { return a.line; })) });
      }
      // token 拼写错误
      parsed.groups.forEach(function (g) {
        g.agents.forEach(function (a) {
          if (a.token !== POLICY_TOKEN && /usage.{0,2}ai.{0,2}train/i.test(a.raw)) {
            F(findings, { id: 'aipref_typo', sev: 'warn', block: 'training', title: '疑似 __usage_ai-training 拼写错误："' + a.raw + '"',
              detail: '草案 §4.1 要求精确匹配（仅不区分大小写）。拼错的 token 不会被任何厂商识别，这一组等于对一个不存在的爬虫写规则。',
              fix: '改为：User-agent: __usage_ai-training（两个下划线开头，ai 与 training 之间是连字符）', lines: [a.line], refs: [pt && pt.spec_url] });
          }
        });
      });
      // Google-Extended 被禁 → grounding 也受影响
      var ge = byToken['google-extended'];
      if (ge && ge.status === 'blocked') {
        F(findings, { id: 'google_extended_grounding', sev: 'info', block: 'training', title: '禁止 Google-Extended 也会退出 Gemini Apps 的 grounding',
          detail: cByToken['google-extended'].block_consequence_zh, fix: '如果希望拒绝训练但保留 Gemini 回答中的引用，目前 Google 没有提供把两者拆开的 token；需要权衡。',
          lines: ge.lines, refs: [cByToken['google-extended'].docs_url] });
      }
      // Googlebot 被禁但 Google-Extended 没禁 → 可能想拒绝训练却用错 token
      var gb = byToken['googlebot'];
      if (gb && gb.status === 'blocked' && gb.source === 'specific' && ge && ge.status !== 'blocked') {
        F(findings, { id: 'googlebot_for_ai', sev: 'warn', block: 'training', title: '禁了 Googlebot，却没禁 Google-Extended',
          detail: '禁 Googlebot 会让你从 Google 搜索消失；控制 Gemini 训练用途的是 Google-Extended。', fix: '若目的是拒绝 AI 训练：恢复 Googlebot，改为 User-agent: Google-Extended / Disallow: /',
          lines: gb.lines, refs: [cByToken['googlebot'].docs_url] });
      }
      // 建议：已逐家拒绝训练但没写统一 token
      var blockedTrain = training.filter(function (t) { return t.status === 'blocked' && t.source === 'specific'; });
      if (aipref.state === 'none' && blockedTrain.length >= 1) {
        F(findings, { id: 'suggest_aipref', sev: 'suggest', block: 'training', title: '可以追加统一的训练偏好 token',
          detail: '你已经逐家拒绝了 ' + blockedTrain.map(function (t) { return t.token; }).join('、') + '。追加 __usage_ai-training 组可以覆盖今后支持该草案的厂商（目前是个人草案，2027-05-03 到期，可能变化）。',
          fix: 'User-agent: __usage_ai-training\nDisallow: /', lines: [], refs: [pt && pt.spec_url] });
      }
      var cc = byToken['ccbot'];
      if (cc && cc.status !== 'blocked' && blockedTrain.length >= 2) {
        F(findings, { id: 'suggest_ccbot', sev: 'suggest', block: 'training', title: '拒绝了多家训练爬虫，但 CCBot 仍允许',
          detail: 'CCBot 的抓取结果会进入任何人都可获取的 Common Crawl 公开数据集（官方说明）。是否拒绝取决于你是否在意内容进入公开语料。',
          fix: 'User-agent: CCBot\nDisallow: /', lines: cc.lines, refs: [cByToken['ccbot'].docs_url] });
      }
    }

    return {
      fetch: fetch,
      parsed: { groups: parsed.groups.length, agents: uniq([].concat.apply([], parsed.groups.map(function (g) { return g.agents.map(function (a) { return a.raw; }); }))),
        sitemaps: parsed.sitemaps, lineCount: parsed.lineCount, bytes: parsed.bytes, truncated: parsed.truncated },
      access: access,
      training: { aipref: aipref, vendors: training, consumers: pt ? pt.consumers : [], spec: pt ? { url: pt.spec_url, status_zh: pt.status_zh, published: pt.published, expires: pt.expires } : null },
      findings: findings
    };
  }

  var WARN_TITLE = {
    agent_extra: 'User-agent 的值含有产品 token 以外的字符（数字、点、空格、版本号等），按前缀字母部分匹配',
    no_colon: '有多行不是 键: 值 格式，已忽略',
    key_typo: '有多处非标准键名',
    bad_agent: '有多个非法的 User-agent 值',
    rule_before_agent: '有多条规则写在任何 User-agent 之前，会被忽略',
    path_no_slash: '有多条路径没以 / 开头，不会匹配任何 URL',
    empty_group: '有多个 User-agent 组没有任何规则（等于全部允许）'
  };
  function statusZh(s) { return { allowed: '允许', partial: '部分允许', blocked: '禁止' }[s] || s; }
  function fixForWarning(code) {
    return {
      no_colon: '每行写成 键: 值，例如 Disallow: /admin/',
      key_typo: '使用标准键名 User-agent / Allow / Disallow / Sitemap',
      bad_agent: 'User-agent 只能写产品 token（字母、_ 与 -）或 *',
      agent_extra: 'RFC 9309 的产品 token 只允许字母、_ 和 -。主流解析器（如 Google）会取前缀字母部分匹配，对本工具检查的爬虫没有影响；如果是版本号（GPTBot/1.0），直接删掉即可',
      rule_before_agent: '在这些规则前加一行 User-agent: *（或具体爬虫名）',
      path_no_slash: '路径以 / 开头，例如 Disallow: /private/',
      empty_group: '如果想全部允许，可以写 Allow: / 让意图更清楚；否则补上规则',
      encoding: '用 UTF-8 保存 robots.txt'
    }[code] || '';
  }

  /* ---------------- 生成器 ----------------
   * cfg: {
   *   defaultPolicy: 'allow' | 'disallow',      // User-agent: * 的整体策略
   *   disallowPaths: ['/admin/'],               // 对所有允许的爬虫都生效的禁止路径
   *   crawlers: { GPTBot: 'block', OAI-SearchBot: 'allow', ... }  // 'allow' | 'block' | 'default'
   *   blockAllowPaths: ['/press/'],             // 被禁止的爬虫仍可访问的路径
   *   aipref: 'none' | 'disallow' | 'allow',
   *   aiprefExceptions: ['/press-kit/'],        // 与 aipref 相反方向的路径
   *   sitemaps: ['https://example.com/sitemap.xml']
   * } */
  function cleanPaths(a) {
    return uniq((a || []).map(function (p) { return String(p || '').trim(); }).filter(Boolean).map(function (p) { return p.charAt(0) === '/' || p.charAt(0) === '*' ? p : '/' + p; }));
  }
  function generateRobots(cfg) {
    cfg = cfg || {};
    var out = [];
    var dis = cleanPaths(cfg.disallowPaths), exc = cleanPaths(cfg.blockAllowPaths);
    var stamp = cfg.date || '';
    out.push('# robots.txt — 由 cetxt.com 生成' + (stamp ? '（' + stamp + '）' : ''));
    out.push('# 规则按 RFC 9309 解析：爬虫只看自己名字的组，不继承 User-agent: * 的规则');
    out.push('');
    var crawlers = cfg.crawlers || {};
    var blocks = [], allows = [];
    Object.keys(crawlers).forEach(function (t) { if (crawlers[t] === 'block') blocks.push(t); else if (crawlers[t] === 'allow') allows.push(t); });
    if (blocks.length) {
      out.push('# 禁止的爬虫');
      blocks.forEach(function (t) { out.push('User-agent: ' + t); });
      exc.forEach(function (p) { out.push('Allow: ' + p); });
      out.push('Disallow: /');
      out.push('');
    }
    if (allows.length) {
      out.push('# 明确允许的爬虫（已复制通用禁止路径，因为专属组不继承 * 组）');
      allows.forEach(function (t) { out.push('User-agent: ' + t); });
      if (cfg.defaultPolicy === 'disallow' || !dis.length) out.push('Allow: /');
      if (cfg.defaultPolicy !== 'disallow') dis.forEach(function (p) { out.push('Disallow: ' + p); });
      out.push('');
    }
    if (cfg.aipref === 'disallow' || cfg.aipref === 'allow') {
      var ex = cleanPaths(cfg.aiprefExceptions);
      out.push('# AI 训练偏好（IETF 个人草案 draft-kelley-aipref-training-preference-signal-00，2027-05-03 到期，各厂商陆续支持中）');
      out.push('# 它只表达"能否用于 AI 训练"，不限制抓取；User-agent: * 不代表这里的偏好');
      out.push('User-agent: ' + POLICY_TOKEN);
      if (cfg.aipref === 'disallow') { ex.forEach(function (p) { out.push('Allow: ' + p); }); out.push('Disallow: /'); }
      else { out.push('Allow: /'); ex.forEach(function (p) { out.push('Disallow: ' + p); }); }
      out.push('');
    }
    out.push('# 其他所有爬虫');
    out.push('User-agent: *');
    if (cfg.defaultPolicy === 'disallow') out.push('Disallow: /');
    else if (dis.length) dis.forEach(function (p) { out.push('Disallow: ' + p); });
    else out.push('Allow: /');
    var sm = (cfg.sitemaps || []).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    if (sm.length) { out.push(''); sm.forEach(function (s) { out.push('Sitemap: ' + s); }); }
    return out.join('\n') + '\n';
  }

  return { analyze: analyze, generateRobots: generateRobots, POLICY_TOKEN: POLICY_TOKEN, CAT_ZH: CAT_ZH, statusZh: statusZh };
});
