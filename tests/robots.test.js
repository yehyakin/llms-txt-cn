/* robots.js / aiaudit.js 回归测试：node tests/robots.test.js */
'use strict';
var R = require('../lib/robots.js');
var A = require('../lib/aiaudit.js');
var D = require('../data/ai-crawlers.json');

var pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok  - ' + name); }
  catch (e) { fail++; console.log('FAIL - ' + name + '\n       ' + (e && e.message)); }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' 期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || '断言失败'); }
function allowed(txt, tok, path) { return R.isAllowed(R.parse(txt), tok, path).allowed; }
function find(rep, id) { return rep.findings.filter(function (f) { return f.id === id; })[0]; }
function acc(rep, tok) { return rep.access.filter(function (a) { return a.token === tok; })[0]; }

/* ---------- 抓取状态语义（RFC 9309 §2.3.1） ---------- */
t('无 robots.txt（404）= 全允许、训练未表态', function () {
  var r = A.analyze({ http_status: 404 }, D);
  eq(r.fetch.policy, 'allow_all');
  ok(r.access.every(function (a) { return a.status === 'allowed'; }), '应全部允许');
  eq(r.training.aipref.state, 'none');
  ok(find(r, 'fetch_unavailable'));
});
t('403 / 410 等其他 4xx 同样 = 全允许', function () {
  eq(A.analyze({ http_status: 403 }, D).fetch.policy, 'allow_all');
  eq(A.analyze({ http_status: 410 }, D).fetch.policy, 'allow_all');
});
t('5xx = 全禁止', function () {
  var r = A.analyze({ http_status: 503 }, D);
  eq(r.fetch.policy, 'disallow_all');
  ok(r.access.every(function (a) { return a.status === 'blocked'; }));
  eq(find(r, 'fetch_unreachable').sev, 'error');
});
t('网络不可达 = 全禁止', function () {
  eq(A.analyze({ unreachable: true }, D).fetch.policy, 'disallow_all');
});
t('重定向超过 5 次 = 视为 unavailable（全允许）', function () {
  eq(A.analyze({ tooManyRedirects: true, http_status: null }, D).fetch.policy, 'allow_all');
});

/* ---------- 解析与组 ---------- */
t('User-agent: * Disallow: / 全禁', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: *\nDisallow: /\n' }, D);
  eq(acc(r, 'GPTBot').status, 'blocked'); eq(acc(r, 'GPTBot').source, 'wildcard');
  eq(acc(r, 'Googlebot').status, 'blocked');
});
t('产品 token 不区分大小写；"GPTBot/1.1" 按 gptbot 匹配并提示', function () {
  eq(allowed('user-agent: gptbot\ndisallow: /', 'GPTBot', '/x'), false);
  var p = R.parse('User-agent: GPTBot/1.1\nDisallow: /');
  eq(R.isAllowed(p, 'GPTBot', '/').allowed, false);
  ok(p.warnings.some(function (w) { return w.code === 'agent_extra'; }));
});
t('连续多行 User-agent 共享一组', function () {
  var txt = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n';
  eq(allowed(txt, 'GPTBot', '/'), false); eq(allowed(txt, 'ClaudeBot', '/'), false); eq(allowed(txt, 'Googlebot', '/'), true);
});
t('同名多组规则合并（RFC 9309 §2.2.1）', function () {
  var txt = 'User-agent: GPTBot\nDisallow: /a/\n\nUser-agent: Bingbot\nDisallow: /\n\nUser-agent: gptbot\nDisallow: /b/\n';
  eq(allowed(txt, 'GPTBot', '/a/1'), false); eq(allowed(txt, 'GPTBot', '/b/1'), false); eq(allowed(txt, 'GPTBot', '/c'), true);
});
t('专属组不继承 * 组', function () {
  var txt = 'User-agent: *\nDisallow: /admin/\n\nUser-agent: GPTBot\nAllow: /\n';
  eq(allowed(txt, 'GPTBot', '/admin/x'), true);
  eq(allowed(txt, 'SomeBot', '/admin/x'), false);
  ok(find(A.analyze({ http_status: 200, text: txt }, D), 'no_inherit'));
});
t('多个 * 组合并', function () {
  var txt = 'User-agent: *\nDisallow: /a\n\nUser-agent: *\nDisallow: /b\n';
  eq(allowed(txt, 'X', '/a'), false); eq(allowed(txt, 'X', '/b'), false);
});
t('规则在 User-agent 之前被忽略并告警；注释被去掉', function () {
  var p = R.parse('Disallow: /\n# 注释\nUser-agent: * # 行尾注释\nDisallow: /x # 也是注释\n');
  eq(R.isAllowed(p, 'A', '/y').allowed, true); eq(R.isAllowed(p, 'A', '/x').allowed, false);
  ok(p.warnings.some(function (w) { return w.code === 'rule_before_agent' && w.line === 1; }));
});
t('空 Disallow = 不限制', function () { eq(allowed('User-agent: *\nDisallow:\n', 'A', '/x'), true); });

/* ---------- 匹配 ---------- */
t('最长匹配优先', function () {
  var txt = 'User-agent: *\nDisallow: /a\nAllow: /a/b\n';
  eq(allowed(txt, 'X', '/a/b/c'), true); eq(allowed(txt, 'X', '/a/c'), false);
  var txt2 = 'User-agent: *\nAllow: /a\nDisallow: /a/b\n';
  eq(allowed(txt2, 'X', '/a/b'), false); eq(allowed(txt2, 'X', '/a/x'), true);
});
t('Allow 与 Disallow 等长平局时 Allow 胜（与顺序无关）', function () {
  eq(allowed('User-agent: *\nDisallow: /page\nAllow: /page\n', 'X', '/page'), true);
  eq(allowed('User-agent: *\nAllow: /page\nDisallow: /page\n', 'X', '/page'), true);
  eq(allowed('User-agent: *\nDisallow: /*.html\nAllow: /p*.htm\n', 'X', '/p.html'), true, '模式等长 8 字节');
});
t('* 通配与 $ 结尾锚定', function () {
  var txt = 'User-agent: *\nDisallow: /*.pdf$\nDisallow: /*/private/\n';
  eq(allowed(txt, 'X', '/doc/a.pdf'), false); eq(allowed(txt, 'X', '/doc/a.pdf?x=1'), true);
  eq(allowed(txt, 'X', '/u/private/1'), false); eq(allowed(txt, 'X', '/private/1'), true);
  ok(R.matchPattern('/fish*', '/fish.html') && R.matchPattern('/fish', '/fish.html'), '/fish* 等价 /fish');
  ok(!R.matchPattern('/fish$', '/fish.html') && R.matchPattern('/fish$', '/fish'));
  ok(R.matchPattern('/*', '/') && R.matchPattern('*', '/anything'));
  ok(R.matchPattern('/a$b', '/a$b'), '中间的 $ 是字面量');
});
t('匹配包含查询串', function () { eq(allowed('User-agent: *\nDisallow: /*?sort=\n', 'X', '/list?sort=1'), false); });
t('百分号编码规范化（非 ASCII、unreserved 解码、保留字符不等价）', function () {
  eq(allowed('User-agent: *\nDisallow: /中文/\n', 'X', '/%E4%B8%AD%E6%96%87/1'), false);
  eq(allowed('User-agent: *\nDisallow: /%e4%b8%ad%e6%96%87/\n', 'X', '/中文/1'), false);
  eq(allowed('User-agent: *\nDisallow: /%7Euser\n', 'X', '/~user/x'), false);
  eq(allowed('User-agent: *\nDisallow: /a%2Fb\n', 'X', '/a/b'), true, '%2F 与 / 不等价');
  eq(allowed('User-agent: *\nDisallow: /a%2fb\n', 'X', '/a%2Fb'), false, '十六进制大小写不敏感');
});
t('/robots.txt 本身总是允许', function () { eq(allowed('User-agent: *\nDisallow: /\n', 'X', '/robots.txt'), true); });
t('UTF-8 BOM 被去掉，CRLF / CR 行尾均可', function () {
  var p = R.parse('\uFEFFUser-agent: *\r\nDisallow: /a\rDisallow: /b\n');
  eq(p.groups.length, 1); eq(p.groups[0].rules.length, 2);
});
t('超大文件：只解析前 500 KiB，之后的规则忽略', function () {
  var filler = '# ' + new Array(1000).join('x') + '\n';
  var big = 'User-agent: *\nDisallow: /early/\n';
  while (big.length < 520 * 1024) big += filler;
  big += 'Disallow: /late/\n';
  var p = R.parse(big);
  ok(p.truncated, '应标记截断'); eq(p.bytes, 500 * 1024);
  eq(R.isAllowed(p, 'X', '/early/1').allowed, false); eq(R.isAllowed(p, 'X', '/late/1').allowed, true);
  ok(find(A.analyze({ http_status: 200, text: big }, D), 'truncated'));
});
t('非法 UTF-8 不崩溃并提示', function () {
  var bytes = new Uint8Array([0x55, 0x73, 0x65, 0x72, 0x2d, 0x61, 0x67, 0x65, 0x6e, 0x74, 0x3a, 0x20, 0x2a, 0x0a, 0xff, 0xfe, 0x0a]);
  var p = R.parse(bytes);
  ok(p.warnings.some(function (w) { return w.code === 'encoding'; }));
});

/* ---------- AIPREF 训练偏好 ---------- */
t('AIPREF：全禁 + 路径例外', function () {
  var txt = 'User-Agent: __usage_ai-training\nDisallow: /\nAllow: /press-kit/\n';
  var r = A.analyze({ http_status: 200, text: txt }, D);
  eq(r.training.aipref.state, 'disallow_with_exceptions');
  eq(r.training.aipref.exceptions[0].path, '/press-kit/');
  var p = R.parse(txt);
  eq(R.isAllowed(p, '__usage_ai-training', '/press-kit/logo.png', { noWildcard: true }).allowed, true);
  eq(R.isAllowed(p, '__usage_ai-training', '/blog/1', { noWildcard: true }).allowed, false);
  eq(acc(r, 'GPTBot').status, 'allowed', '训练偏好不是抓取指令，不影响 GPTBot 抓取');
  ok(find(r, 'aipref_not_crawl'));
});
t('AIPREF：User-agent: * 不匹配策略 token（未表态）', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: *\nDisallow: /\n' }, D);
  eq(r.training.aipref.state, 'none');
  ok(find(r, 'wildcard_not_aipref'));
});
t('AIPREF：token 大小写不敏感', function () {
  eq(A.analyze({ http_status: 200, text: 'user-agent: __USAGE_AI-TRAINING\ndisallow: /\n' }, D).training.aipref.state, 'disallow');
});
t('AIPREF 拒绝但 Google-Extended 显式允许 → 冲突（厂商规则优先）', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: __usage_ai-training\nDisallow: /\n\nUser-agent: Google-Extended\nAllow: /\n' }, D);
  var f = find(r, 'aipref_overridden_google-extended');
  ok(f, '应报冲突'); eq(f.sev, 'warn'); ok(f.lines.indexOf(1) >= 0 && f.lines.indexOf(4) >= 0, '证据行号');
  var g = r.training.vendors.filter(function (v) { return v.token === 'Google-Extended'; })[0];
  ok(g.explicitAllow);
});
t('AIPREF 拒绝、厂商 token 未写 → 无覆盖冲突，提示待厂商实现', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: __usage_ai-training\nDisallow: /\n' }, D);
  ok(!r.findings.some(function (f) { return /^aipref_overridden_/.test(f.id); }));
  var g = r.training.vendors.filter(function (v) { return v.token === 'GPTBot'; })[0];
  ok(/实现/.test(g.reading));
});
t('AIPREF token 拼错会被指出', function () {
  ok(find(A.analyze({ http_status: 200, text: 'User-agent: __usage_ai_training\nDisallow: /\n' }, D), 'aipref_typo'));
});
t('AIPREF 与 * 写在同一组 → 告警（规则也限制所有爬虫抓取）', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: *\nUser-agent: __usage_ai-training\nDisallow: /\n' }, D);
  ok(find(r, 'aipref_mixed_group')); eq(r.training.aipref.state, 'disallow');
});

/* ---------- 冲突分析 ---------- */
t('* 全禁但 GPTBot 单独放开 → 冲突', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n' }, D);
  var f = find(r, 'wildcard_block_specific_open');
  ok(f && /GPTBot/.test(f.title)); eq(acc(r, 'GPTBot').status, 'allowed');
  ok(f.lines.indexOf(4) >= 0);
});
t('搜索类爬虫被 * 连带禁止 → 合并成一条，含 OAI-SearchBot 后果', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: *\nDisallow: /\n' }, D);
  var f = find(r, 'search_blocked_wildcard');
  ok(f && /OAI-SearchBot/.test(f.detail) && /ChatGPT 搜索/.test(f.detail));
});
t('单独禁止 OAI-SearchBot → 指出影响 ChatGPT 搜索展示', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: OAI-SearchBot\nDisallow: /\n' }, D);
  var f = find(r, 'search_blocked_oai-searchbot');
  ok(f && /ChatGPT 搜索/.test(f.detail)); eq(f.lines.join(','), '1,2');
});
t('只禁 GPTBot：训练拒绝、搜索不受影响', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: GPTBot\nDisallow: /\n' }, D);
  eq(acc(r, 'GPTBot').status, 'blocked'); eq(acc(r, 'OAI-SearchBot').status, 'allowed');
  ok(!r.findings.some(function (f) { return /^search_blocked/.test(f.id); }));
  ok(find(r, 'suggest_aipref'));
});
t('Applebot 无专属组时跟随 Googlebot', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: Googlebot\nDisallow: /private/\n' }, D);
  eq(acc(r, 'Applebot').status, 'partial'); eq(acc(r, 'Applebot').via, 'Googlebot');
  ok(find(r, 'applebot_follows_googlebot'));
});
t('禁 Googlebot 却没禁 Google-Extended → 提示用错 token', function () {
  ok(find(A.analyze({ http_status: 200, text: 'User-agent: Googlebot\nDisallow: /\n' }, D), 'googlebot_for_ai'));
});
t('用户触发类被禁止 → 提示可能不遵守 robots', function () {
  var f = find(A.analyze({ http_status: 200, text: 'User-agent: Perplexity-User\nDisallow: /\n' }, D), 'user_ignores');
  ok(f && /Perplexity-User/.test(f.title));
});
t('Crawl-delay 与 Content-Signal 被识别', function () {
  var r = A.analyze({ http_status: 200, text: 'User-agent: *\nCrawl-delay: 10\nContent-Signal: ai-train=no\nAllow: /\n' }, D);
  ok(find(r, 'crawl_delay')); ok(find(r, 'content_signal'));
});

/* ---------- 生成器 ---------- */
t('生成器输出可被分析器按预期解读', function () {
  var txt = A.generateRobots({ defaultPolicy: 'allow', disallowPaths: ['/admin/'], crawlers: { GPTBot: 'block', ClaudeBot: 'block', 'OAI-SearchBot': 'allow' },
    blockAllowPaths: ['/press/'], aipref: 'disallow', aiprefExceptions: ['/press-kit/'], sitemaps: ['https://example.com/sitemap.xml'] });
  var r = A.analyze({ http_status: 200, text: txt }, D);
  eq(acc(r, 'GPTBot').status, 'blocked'); eq(acc(r, 'OAI-SearchBot').status, 'partial');
  var p = R.parse(txt);
  eq(R.isAllowed(p, 'OAI-SearchBot', '/admin/x').allowed, false, '放行组应复制通用禁止路径');
  eq(R.isAllowed(p, 'GPTBot', '/press/a').allowed, true);
  eq(r.training.aipref.state, 'disallow_with_exceptions');
  eq(p.sitemaps.length, 1);
  ok(!find(r, 'no_inherit'), '生成结果不应触发不继承告警');
});
t('生成器：默认全禁 + 放开搜索爬虫', function () {
  var txt = A.generateRobots({ defaultPolicy: 'disallow', crawlers: { Googlebot: 'allow', Baiduspider: 'allow' } });
  var p = R.parse(txt);
  eq(R.isAllowed(p, 'Googlebot', '/x').allowed, true); eq(R.isAllowed(p, 'Baiduspider', '/x').allowed, true);
  eq(R.isAllowed(p, 'GPTBot', '/x').allowed, false);
});

/* ---------- 数据文件 ---------- */
t('爬虫清单字段完整且覆盖要求的 UA', function () {
  var need = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Google-Extended', 'Googlebot', 'Applebot', 'Applebot-Extended', 'PerplexityBot', 'Perplexity-User', 'Bingbot', 'CCBot', 'Bytespider', 'meta-externalagent', 'Amazonbot', 'DuckAssistBot', 'Baiduspider'];
  var have = D.crawlers.map(function (c) { return c.token; });
  need.forEach(function (n) { ok(have.indexOf(n) >= 0, '缺少 ' + n); });
  D.crawlers.forEach(function (c) {
    ['vendor', 'category', 'respects_robots', 'docs_url', 'verified_on', 'verification'].forEach(function (k) { ok(c[k], c.token + ' 缺字段 ' + k); });
    ok(/^https:\/\//.test(c.docs_url), c.token + ' docs_url');
    ok(['training', 'training_control', 'search', 'user', 'dataset'].indexOf(c.category) >= 0, c.token + ' category');
  });
});

console.log('\n' + pass + ' 通过，' + fail + ' 失败');
if (fail) process.exit(1);
