/* audit-ui.js — 首页体检：请求 /api/check，渲染「可访问 / 可训练 / 可发现」三块报告。
 * 依赖 window.CE（app.js）、LLMS（llms.js）、AIAUDIT（lib/aiaudit.js）。 */
(function(){
'use strict';
var CE = window.CE, $ = CE.$, esc = CE.esc;
var CAT_ZH = AIAUDIT.CAT_ZH;
var SEV_TXT = { error:'错误', warn:'警告', suggest:'建议', info:'提示' };
var ST_TXT = { allowed:'允许', partial:'部分允许', blocked:'禁止' };
var SRC_TXT = { specific:'专属组', wildcard:'* 组', none:'未提及' };
var RESPECT_TXT = { yes:'遵守', partial:'可能不适用', no:'一般不遵守', unverified:'官方未说明' };
var AIPREF_TXT = {
  none:'未表态', allow:'允许训练', disallow:'拒绝训练',
  allow_with_exceptions:'允许训练（有例外路径）', disallow_with_exceptions:'拒绝训练（有例外路径）'
};
var CONSUMER_TXT = { implementing:'实现中', planned:'计划中', supported:'已支持' };

/* 爬虫清单：前端只用于展示文档链接、说明 */
var dataP = null;
function crawlerData(){
  if (!dataP) dataP = fetch('/data/ai-crawlers.json').then(function(r){ return r.json(); });
  return dataP;
}
CE.crawlerData = crawlerData;
crawlerData().then(function(d){ var el = $('crawlerCount'); if (el) el.textContent = d.crawlers.length; }).catch(function(){});

function lnLinks(lines, pfx){
  if (!lines || !lines.length) return '';
  return '<span class="lns">' + lines.slice(0, 12).map(function(n){
    return '<a href="#' + pfx + '-l' + n + '" class="lnk" data-ln="' + n + '" data-pfx="' + pfx + '">L' + n + '</a>';
  }).join('') + (lines.length > 12 ? '<span class="lnk more">+' + (lines.length - 12) + '</span>' : '') + '</span>';
}
function refLinks(refs){
  refs = (refs || []).filter(Boolean);
  if (!refs.length) return '';
  var seen = {};
  return '<span class="refs">' + refs.filter(function(u){ if (seen[u]) return false; seen[u] = 1; return true; }).slice(0, 4).map(function(u){
    var host = u.replace(/^https?:\/\//, '').split('/')[0];
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host) + ' ↗</a>';
  }).join('') + '</span>';
}
function findingsHtml(list, pfx){
  if (!list.length) return '<div class="au-clean">这一块没有发现冲突。</div>';
  var order = { error:0, warn:1, suggest:2, info:3 };
  return '<div class="issues in">' + list.slice().sort(function(a, b){ return order[a.sev] - order[b.sev]; }).map(function(f, i){
    return '<div class="issue" style="--i:' + Math.min(i, 14) + '"><span class="sev ' + f.sev + '">' + SEV_TXT[f.sev] + '</span>' +
      '<div class="msg"><b>' + esc(f.title) + '</b>' +
      (f.detail ? '<span class="det">' + esc(f.detail).replace(/\n/g, '<br>') + '</span>' : '') +
      (f.fix ? '<span class="fix">' + esc(f.fix).replace(/\n/g, '<br>') + '</span>' : '') +
      '<span class="evi">' + lnLinks(f.lines, pfx) + refLinks(f.refs) + '</span></div></div>';
  }).join('') + '</div>';
}

function crawlerTable(rows, data, pfx){
  var byTok = {}; (data && data.crawlers || []).forEach(function(c){ byTok[c.token.toLowerCase()] = c; });
  return '<div class="au-table" role="table">' +
    '<div class="au-tr au-th" role="row"><span>爬虫</span><span>厂商</span><span>用途</span><span>状态</span><span>依据</span></div>' +
    rows.map(function(a){
      var c = byTok[a.token.toLowerCase()] || {};
      var note = c.summary_zh ? ' title="' + esc(c.summary_zh) + '"' : '';
      return '<div class="au-tr" role="row">' +
        '<span class="mono tok"' + note + '>' + (c.docs_url ? '<a href="' + esc(c.docs_url) + '" target="_blank" rel="noopener">' + esc(a.token) + '</a>' : esc(a.token)) +
          (c.verification && c.verification !== 'verified' ? '<i class="unv" title="官方未写明：' + esc((c.unverified_fields || []).join('、')) + '">部分未核实</i>' : '') + '</span>' +
        '<span>' + esc(a.vendor) + '</span>' +
        '<span>' + esc(CAT_ZH[a.category] || a.category) + (a.respects_robots && a.respects_robots !== 'yes' ? '<i class="rr">robots：' + RESPECT_TXT[a.respects_robots] + '</i>' : '') + '</span>' +
        '<span><b class="st ' + a.status + '">' + ST_TXT[a.status] + '</b></span>' +
        '<span class="src">' + (a.via ? '按 ' + esc(a.via) + ' 组' : SRC_TXT[a.source]) + lnLinks(a.lines, pfx) + '</span>' +
      '</div>';
    }).join('') + '</div>';
}

function robotsViewer(text, pfx){
  var lines = String(text || '').split(/\r\n|\r|\n/);
  if (lines.length > 3000) lines = lines.slice(0, 3000).concat(['…（只显示前 3000 行）']);
  return '<details class="au-src" id="' + pfx + '-src"><summary>robots.txt 原文（' + lines.length + ' 行）</summary><pre class="au-code">' +
    lines.map(function(l, i){ return '<span class="cl" id="' + pfx + '-l' + (i + 1) + '"><i>' + (i + 1) + '</i>' + esc(l) + '</span>'; }).join('\n') +
    '</pre></details>';
}

/* 主渲染：analysis 来自 AIAUDIT.analyze；opts = { pfx, domain, robots:{state,http_status,final_url,text,...}, llms, elapsed } */
function renderAudit(box, analysis, opts, data){
  var pfx = opts.pfx || 'au';
  var h = '';
  var acc = analysis ? analysis.access : [];
  var fAccess = analysis ? analysis.findings.filter(function(f){ return f.block === 'access'; }) : [];
  var fTrain = analysis ? analysis.findings.filter(function(f){ return f.block === 'training'; }) : [];
  var rb = opts.robots || {};

  // 概览（三块，不出总分）
  var search = acc.filter(function(a){ return a.category === 'search'; });
  var trainers = analysis ? analysis.training.vendors : [];
  var sOk = search.filter(function(a){ return a.status !== 'blocked'; }).length;
  var tBlocked = trainers.filter(function(t){ return t.status === 'blocked'; }).length;
  var ap = analysis ? analysis.training.aipref : { state:'none' };
  var llmsTile = '';
  if (opts.llms) {
    var v = opts.llms.verdict;
    if ((v === 'real' || v === 'nonstandard') && opts.llms.text && !opts.llms.truncated) llmsTile = LLMS.validateLLMS(opts.llms.text).score + '<small>/100</small>';
    else llmsTile = ({ missing:'没有', html_spoof:'HTML 壳', unknown:'未能判定', real:'有（过大）', nonstandard:'有（过大）' })[v] || '—';
  }
  h += '<div class="au-tiles">' +
    '<a class="au-tile" href="#' + pfx + '-access"><span class="k">01 · 可访问</span><b>' + (analysis ? sOk + '<small>/' + search.length + '</small>' : '—') + '</b><span class="d">搜索类爬虫可访问</span></a>' +
    '<a class="au-tile" href="#' + pfx + '-train"><span class="k">02 · 可训练</span><b class="t">' + esc(AIPREF_TXT[ap.state] || '—') + '</b><span class="d">训练偏好 · 厂商 token 拒绝 ' + tBlocked + '/' + trainers.length + '</span></a>' +
    (opts.llms ? '<a class="au-tile" href="#' + pfx + '-disc"><span class="k">03 · 可发现</span><b>' + llmsTile + '</b><span class="d">llms.txt 结构分</span></a>' : '') +
    '</div>';

  // robots 抓取情况
  var meta = '';
  if (rb.state === 'ok' && rb.final_url) meta = 'GET <b>' + esc(rb.final_url || '') + '</b> · HTTP ' + rb.http_status + ' · ' + (rb.bytes != null ? (rb.bytes > 1024 ? Math.round(rb.bytes / 1024) + 'KB' : rb.bytes + 'B') : '') + (rb.truncated ? ' · 超过 500KiB 已截断' : '');
  else if (rb.state === 'unavailable') meta = 'robots.txt 返回 HTTP ' + rb.http_status + '（视为没有文件）';
  else if (rb.state === 'server_error') meta = 'robots.txt 返回 HTTP ' + rb.http_status + '（服务器错误）';
  else if (rb.state === 'unreachable') meta = 'robots.txt 无法访问：' + esc(rb.reason || '');
  else if (rb.state === 'too_many_redirects') meta = 'robots.txt 重定向超过 5 次';
  else if (rb.state === 'refused') meta = '没能判定：' + esc(rb.reason || '') + '。为了安全，我们不会跟随指向内网或非标准端口的跳转。';
  if (meta) h += '<div class="chk-meta au-meta">' + meta + '</div>';

  // 01 可访问
  h += '<section class="au-block" id="' + pfx + '-access"><div class="card-head"><span class="idx">01</span><h2>可访问</h2></div>' +
    '<p class="sub">各 AI / 搜索爬虫访问网站根路径 <span class="mono">/</span> 的结果（RFC 9309：只看自己名字的组，没有才看 *；最长匹配，平局 Allow 胜）。</p>';
  if (!analysis) h += '<div class="au-clean">robots.txt 没能判定，这一块暂无结论。</div>';
  else {
    h += findingsHtml(fAccess, pfx);
    ['search', 'user', 'training', 'training_control', 'dataset'].forEach(function(cat){
      var rows = acc.filter(function(a){ return a.category === cat; });
      if (!rows.length) return;
      h += '<h3 class="au-h3">' + esc(CAT_ZH[cat]) + '</h3>' + crawlerTable(rows, data, pfx);
    });
  }
  h += '</section>';

  // 02 可训练
  h += '<section class="au-block" id="' + pfx + '-train"><div class="card-head"><span class="idx">02</span><h2>可训练</h2></div>' +
    '<p class="sub">两套机制并行：各厂商自己的 token（现行有效）与 IETF 草案的统一 token <span class="mono">__usage_ai-training</span>（陆续落地中）。</p>';
  if (!analysis) h += '<div class="au-clean">robots.txt 没能判定，这一块暂无结论。</div>';
  else {
    var spec = analysis.training.spec || {};
    h += '<div class="au-aipref"><div class="ap-state ' + ap.state + '"><span class="k">__usage_ai-training</span><b>' + esc(AIPREF_TXT[ap.state]) + '</b>' + lnLinks(ap.lines, pfx) + '</div>';
    if (ap.exceptions && ap.exceptions.length) h += '<div class="ap-ex">例外路径：' + ap.exceptions.map(function(e){ return '<span class="mono">' + esc(e.path) + '</span>'; }).join(' ') + '</div>';
    if (ap.state === 'none') h += '<div class="ap-ex">文件里没有 <span class="mono">User-agent: __usage_ai-training</span> 组。按草案 §4.2，<span class="mono">User-agent: *</span> 不代表训练偏好，所以是"未表态"。</div>';
    h += '<div class="ap-cons">' + analysis.training.consumers.map(function(c){
      return '<div><span class="v">' + esc(c.vendor) + '</span><span class="s ' + c.status + '">' + esc(CONSUMER_TXT[c.status] || c.status) + '</span><span class="d">' + esc(c.status_zh) + '</span>' + refLinks([c.source_url]) + '</div>';
    }).join('') + '</div>';
    h += '<div class="ap-draft">草案状态：' + esc(spec.status_zh || '') + '，' + esc(spec.published || '') + ' 发布，' + esc(spec.expires || '') + ' 到期，可能变化。' + refLinks([spec.url]) + '</div></div>';
    h += '<h3 class="au-h3">各厂商训练 token（现行机制）</h3><div class="au-table">' +
      '<div class="au-tr au-th"><span>厂商</span><span>token</span><span>状态</span><span>解读</span><span>依据</span></div>' +
      trainers.map(function(t){
        return '<div class="au-tr"><span>' + esc(t.vendor) + '</span><span class="mono tok">' + esc(t.token) + '</span><span><b class="st ' + t.status + '">' + ST_TXT[t.status] + '</b></span><span class="rd">' + esc(t.reading) + '</span><span class="src">' + SRC_TXT[t.source] + lnLinks(t.lines, pfx) + '</span></div>';
      }).join('') + '</div>';
    h += '<h3 class="au-h3">冲突与建议</h3>' + findingsHtml(fTrain, pfx);
  }
  h += '</section>';

  // 03 可发现
  if (opts.llms) h += '<section class="au-block" id="' + pfx + '-disc"><div class="card-head"><span class="idx">03</span><h2>可发现（llms.txt）</h2></div><div class="check-out" id="' + pfx + '-llms"></div></section>';

  if (rb.text) h += robotsViewer(rb.text, pfx);
  box.innerHTML = h;
  box.hidden = false;
  if (opts.llms) renderLlms($(pfx + '-llms'), Object.assign({ domain: opts.domain }, opts.llms));
}

/* 证据行号：展开原文并高亮 */
document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('a.lnk[data-ln]');
  if (!a) return;
  e.preventDefault();
  var pfx = a.getAttribute('data-pfx'), n = a.getAttribute('data-ln');
  var det = $(pfx + '-src'), row = $(pfx + '-l' + n);
  if (!det || !row) return;
  det.open = true;
  document.querySelectorAll('#' + pfx + '-src .cl.hl').forEach(function(x){ x.classList.remove('hl'); });
  row.classList.add('hl');
  row.scrollIntoView({ behavior: CE.RM ? 'auto' : 'smooth', block: 'center' });
});

/* ---------- llms.txt 部分（沿用旧版文案与 verdict 语义） ---------- */
var lastCheckText = null;
function checkGoDetail(){
  if (!lastCheckText) return;
  CE.switchTab('val');
  $('vInput').value = lastCheckText;
  setTimeout(function(){ $('btnValidate').click(); }, 250);
}
window.checkGoDetail = checkGoDetail;
function renderLlms(out, r){
  var v = r.verdict, d = esc(r.domain), h = '';
  function meta(){
    var m = 'GET <b>' + esc(r.final_url || ('https://' + r.domain + '/llms.txt')) + '</b>';
    if (r.truncated) m += ' · 文件超过 200KB，只检查了前 200KB';
    return '<div class="chk-meta">' + m + '</div>';
  }
  if (v === 'real' || v === 'nonstandard'){
    lastCheckText = r.text || null;
    if (r.truncated){
      h += '<div class="chk-title">文件太大，<span class="acc">没看完</span></div>';
      h += '<p class="chk-desc"><b>' + d + '</b> 的 llms.txt 超过了 200KB，只看了前 200KB——这个分数不完整，没法跟别人比。下载完整文件，用校验器上传后再打分。</p>';
      h += meta();
      h += '<div class="chk-actions"><button class="btn btn-pri" type="button" onclick="switchTab(\'val\')">去校验器上传完整文件</button></div>';
      out.innerHTML = h; return;
    }
    var sc = LLMS.validateLLMS(r.text || '');
    var errs = sc.issues.filter(function(i){ return i.sev === 'error'; }).length;
    var warns = sc.issues.filter(function(i){ return i.sev === 'warn'; }).length;
    h += '<div class="chk-score"><div class="score-num"><span class="num">' + sc.score + '</span><small>/100</small></div>'
       + '<div><div class="chk-grade">' + esc(sc.grade || '') + '</div>'
       + '<div class="chk-meta" style="margin:8px 0 0">错误 ' + errs + ' · 警告 ' + warns + '</div></div></div>';
    if (v === 'real') h += '<p class="chk-desc"><b>' + d + '</b> 的 llms.txt 是真的，结构质量 <b>' + sc.score + ' 分</b>（只代表文件写得好不好，不代表 AI 会收录）。</p>';
    else h += '<p class="chk-desc">抓到了文件，但它不太像 Markdown（可能是纯文本或其他格式）。按规范打了 <b>' + sc.score + ' 分</b>，仅供参考。</p>';
    h += meta();
    h += '<div class="chk-actions"><button class="btn btn-pri" type="button" onclick="checkGoDetail()">在校验器中查看详情</button></div>';
  } else if (v === 'missing'){
    lastCheckText = null;
    h += '<div class="chk-title">还没有 <span class="acc">llms.txt</span></div>';
    h += '<p class="chk-desc"><b>' + d + '</b> 的 <span class="mono">/llms.txt</span> 返回 404。现在是最好下手的时候——30 秒生成一个。</p>';
    h += meta();
    h += '<div class="chk-actions"><button class="btn btn-pri" type="button" onclick="switchTab(\'gen\')">去生成一个 →</button></div>';
  } else if (v === 'html_spoof'){
    lastCheckText = null;
    h += '<div class="chk-title">AI <span class="acc">读不到</span>这个文件</div>';
    h += '<p class="chk-desc"><b>' + d + '</b> 的 <span class="mono">/llms.txt</span> 返回 200，但内容是 HTML（可能是 SPA 兜底或 WAF 拦截页）。AI 拿到的是网页壳，不是说明书——先排错，多半不用重写。</p>';
    h += meta();
    h += '<div class="chk-actions"><button class="btn btn-pri" type="button" onclick="document.getElementById(\'deploySec\').scrollIntoView({behavior:\'smooth\'})">查看部署排错 →</button><button class="btn btn-sec" type="button" onclick="switchTab(\'gen\')">去生成一个</button></div>';
  } else {
    lastCheckText = null;
    h += '<div class="chk-title">没能<span class="acc">判定</span></div>';
    h += '<p class="chk-desc">' + esc(r.reason || '未知原因') + '。这个站可能拦截了机器访问，也可以手动把文件贴到校验器。</p>';
    h += meta();
    h += '<div class="chk-actions"><button class="btn btn-sec" type="button" onclick="switchTab(\'val\')">去校验器粘贴</button></div>';
  }
  out.innerHTML = h;
}

/* ---------- 发起体检 ---------- */
var checkAbort = null;
function cleanDomainInput(s){
  s = (s || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0].split('?')[0].split('#')[0].split('@').pop();
  s = s.replace(/:\d+$/, '').replace(/\.+$/, '');
  try { if (/[^\x00-\x7f]/.test(s)) s = new URL('http://' + s).hostname; } catch (e) {}
  return s;
}
function doCheck(){
  var input = $('checkDomain'), out = $('checkOut'), rep = $('auditReport');
  var d = cleanDomainInput(input.value);
  function err(msg){ out.hidden = false; out.innerHTML = '<p class="chk-err">' + esc(msg) + '</p>'; }
  if (!d) return err('先输入一个域名，比如 example.com');
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i.test(d)) return err('域名格式不对，检查一下再试（不支持 IP 地址）');
  if (checkAbort) checkAbort.abort();
  checkAbort = new AbortController();
  var timer = setTimeout(function(){ checkAbort.abort(); }, 30000);
  out.hidden = false; rep.hidden = true;
  out.innerHTML = '<div class="chk-loading"><span class="dots"><i></i><i></i><i></i></span>正在请求 https://' + esc(d) + '/robots.txt 与 /llms.txt …</div>';
  var btn = $('btnCheck'); btn.disabled = true;
  try { history.replaceState(null, '', '#check'); } catch (e) {}
  Promise.all([
    fetch('/api/check?domain=' + encodeURIComponent(d), { signal: checkAbort.signal })
      .then(function(resp){ return resp.json().then(function(j){ return { status: resp.status, body: j }; }); }),
    crawlerData().catch(function(){ return null; })
  ]).then(function(res){
    clearTimeout(timer); btn.disabled = false;
    var r = res[0], data = res[1];
    if (r.status !== 200) return err((r.body && r.body.reason) || '请求失败，稍后再试');
    var b = r.body;
    out.innerHTML = '<div class="chk-meta">' + esc(b.domain) + ' · 用时 ' + (b.elapsed_ms || 0) + ' ms' + (b.data_version ? ' · 爬虫清单 ' + esc(b.data_version) : '') + '</div>';
    var llms = b.llms || b; // 兼容旧版只有顶层字段的响应
    if (b.robots) renderAudit(rep, b.robots.analysis, { pfx: 'au', domain: b.domain, robots: b.robots, llms: llms }, data);
    else { rep.hidden = false; rep.innerHTML = '<section class="au-block"><div class="check-out" id="au-llms"></div></section>'; renderLlms($('au-llms'), Object.assign({ domain: b.domain }, llms)); }
    rep.scrollIntoView({ behavior: CE.RM ? 'auto' : 'smooth', block: 'start' });
  }).catch(function(e){
    clearTimeout(timer); btn.disabled = false;
    err(e && e.name === 'AbortError' ? '请求超时（30 秒），对方站点响应太慢' : '网络错误，请重试');
  });
}
$('btnCheck').addEventListener('click', doCheck);
$('checkDomain').addEventListener('keydown', function(e){ if (e.key === 'Enter') doCheck(); });

CE.renderAudit = renderAudit;
})();
