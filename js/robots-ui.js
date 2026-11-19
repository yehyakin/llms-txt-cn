/* robots-ui.js — robots.txt / AI 训练偏好生成器 + 粘贴分析。纯本地。
 * 依赖 window.CE（app.js / audit-ui.js）、AIAUDIT。 */
(function(){
'use strict';
var CE = window.CE, $ = CE.$, esc = CE.esc;
var CAT_ZH = AIAUDIT.CAT_ZH;
var state = { def: 'allow', aipref: 'none', crawlers: {} };
var DATA = null;

function lines(id){ return $(id).value.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean); }
function cfg(){
  return {
    defaultPolicy: state.def, disallowPaths: lines('rgDisallow'), crawlers: state.crawlers,
    blockAllowPaths: lines('rgBlockAllow'), aipref: state.aipref, aiprefExceptions: lines('rgAiprefEx'),
    sitemaps: lines('rgSitemap'), date: new Date().toISOString().slice(0, 10)
  };
}
function setSeg(id, v){
  $(id).querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-v') === v); b.setAttribute('aria-checked', b.getAttribute('data-v') === v ? 'true' : 'false'); });
}

function renderCrawlers(){
  var box = $('rgCrawlers'); if (!DATA) return;
  var cats = ['search', 'training', 'training_control', 'dataset', 'user'];
  var h = '';
  cats.forEach(function(cat){
    var list = DATA.crawlers.filter(function(c){ return c.category === cat; });
    if (!list.length) return;
    h += '<div class="rg-cat"><div class="rg-cat-h">' + esc(CAT_ZH[cat]) + (cat === 'user' ? '<span class="hint">多数官方说明可能不遵守 robots.txt</span>' : '') + '</div>';
    list.forEach(function(c){
      var v = state.crawlers[c.token] || 'default';
      h += '<div class="rg-row"><span class="mono tok" title="' + esc(c.summary_zh || '') + '">' + esc(c.token) + '<i>' + esc(c.vendor) + '</i></span>' +
        '<div class="seg sm" data-tok="' + esc(c.token) + '">' +
        ['default', 'allow', 'block'].map(function(x){ return '<button type="button" data-v="' + x + '" class="' + (v === x ? 'on' : '') + '">' + ({ default:'默认', allow:'允许', block:'禁止' })[x] + '</button>'; }).join('') +
        '</div></div>';
    });
    h += '</div>';
  });
  box.innerHTML = h;
  box.querySelectorAll('.seg[data-tok]').forEach(function(seg){
    seg.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      var t = seg.getAttribute('data-tok'), v = b.getAttribute('data-v');
      if (v === 'default') delete state.crawlers[t]; else state.crawlers[t] = v;
      seg.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x === b); });
      document.querySelectorAll('#rgPresets .chip').forEach(function(c){ c.classList.remove('on'); });
      update();
    });
  });
}

var PRESETS = {
  open: function(){ state.def = 'allow'; state.crawlers = {}; state.aipref = 'none'; },
  notrain: function(){
    state.def = 'allow'; state.crawlers = {}; state.aipref = 'disallow';
    DATA.crawlers.forEach(function(c){ if (c.category === 'training' || c.category === 'training_control' || c.category === 'dataset') state.crawlers[c.token] = 'block'; });
  },
  searchonly: function(){
    state.def = 'disallow'; state.crawlers = {}; state.aipref = 'disallow';
    DATA.crawlers.forEach(function(c){ if (c.category === 'search') state.crawlers[c.token] = 'allow'; });
  },
  closed: function(){ state.def = 'disallow'; state.crawlers = {}; state.aipref = 'disallow'; }
};
function applyPreset(k){
  if (!DATA) return;
  PRESETS[k]();
  document.querySelectorAll('#rgPresets .chip').forEach(function(c){ c.classList.toggle('on', c.getAttribute('data-preset') === k); });
  setSeg('rgDefault', state.def); setSeg('rgAipref', state.aipref);
  renderCrawlers(); update();
}

function update(){
  var txt = AIAUDIT.generateRobots(cfg());
  var pv = $('rgPreview');
  pv.textContent = txt;
  var ls = txt.split('\n'); $('rgLines').textContent = ls.length - 1;
  $('rgGroups').textContent = ls.filter(function(l, i){ return /^user-agent:/i.test(l) && !/^user-agent:/i.test(ls[i - 1] || ''); }).length;
  $('rgAiprefExWrap').hidden = state.aipref === 'none';
  $('rgAiprefExLabel').innerHTML = (state.aipref === 'disallow' ? '仍允许训练的路径' : '不允许训练的路径') + ' <span class="hint">一行一个</span>';
  // 用同一引擎复查
  if (DATA) {
    var r = AIAUDIT.analyze({ http_status: 200, text: txt }, DATA);
    var warns = r.findings.filter(function(f){ return f.sev === 'warn' || f.sev === 'error'; });
    var search = r.access.filter(function(a){ return a.category === 'search'; });
    var train = r.training.vendors;
    $('rgCheck').innerHTML = '<div class="rg-sum"><span>搜索类可访问 <b>' + search.filter(function(a){ return a.status !== 'blocked'; }).length + '/' + search.length + '</b></span>' +
      '<span>训练 token 拒绝 <b>' + train.filter(function(t){ return t.status === 'blocked'; }).length + '/' + train.length + '</b></span>' +
      '<span>训练偏好 <b>' + ({ none:'未表态', allow:'允许', disallow:'拒绝', allow_with_exceptions:'允许·有例外', disallow_with_exceptions:'拒绝·有例外' })[r.training.aipref.state] + '</b></span></div>' +
      (warns.length ? '<ul class="rg-warn">' + warns.map(function(f){ return '<li>' + esc(f.title) + '</li>'; }).join('') + '</ul>' : '<div class="rg-ok">复查通过：没有冲突类警告。</div>');
  }
}

$('rgPresets').addEventListener('click', function(e){ var c = e.target.closest('.chip'); if (c) applyPreset(c.getAttribute('data-preset')); });
$('rgDefault').addEventListener('click', function(e){ var b = e.target.closest('button'); if (!b) return; state.def = b.getAttribute('data-v'); setSeg('rgDefault', state.def); update(); });
$('rgAipref').addEventListener('click', function(e){ var b = e.target.closest('button'); if (!b) return; state.aipref = b.getAttribute('data-v'); setSeg('rgAipref', state.aipref); update(); });
['rgDisallow', 'rgBlockAllow', 'rgAiprefEx', 'rgSitemap'].forEach(function(id){ $(id).addEventListener('input', update); });

$('rgCopy').addEventListener('click', function(){
  var txt = $('rgPreview').textContent;
  function done(){ CE.toast('已复制到剪贴板', 'ok'); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(function(){ CE.toast('复制失败，请手动选择复制'); });
  else CE.toast('浏览器不支持一键复制，请手动选择');
});
$('rgDl').addEventListener('click', function(){
  var blob = new Blob([$('rgPreview').textContent], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'robots.txt';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  CE.toast('robots.txt 已开始下载', 'ok');
});

/* 粘贴分析 */
$('rpLoad').addEventListener('click', function(){ $('rpInput').value = $('rgPreview').textContent; });
$('rpRun').addEventListener('click', function(){
  var txt = $('rpInput').value;
  if (!txt.trim()) { CE.toast('先粘贴 robots.txt 内容'); return; }
  CE.crawlerData().then(function(d){
    var r = AIAUDIT.analyze({ http_status: 200, text: txt }, d);
    CE.renderAudit($('rpOut'), r, { pfx: 'rp', robots: { state: 'ok', text: txt } }, d);
  });
});

CE.crawlerData().then(function(d){ DATA = d; renderCrawlers(); applyPreset('notrain'); }).catch(function(){ update(); });
update();
})();
