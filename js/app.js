/* cetxt 主脚本：外壳（加载动画/光标/Tab/命令面板）+ llms.txt 生成器 + 校验器。由原 index.html 内联脚本拆出。 */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE = window.matchMedia('(pointer: fine)').matches;
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function initialTab(){
  var h = (location.hash || '').replace('#','');
  if (h === 'gen' || h === 'val' || h === 'robots' || h === 'check') return h;
  if ((location.search || '').indexOf('demo=val') > -1) return 'val';
  return 'check';
}
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ============ Toast（Sonner 纪律：一句话） ============ */
var toastT = null;
var CHECK_SVG = '<svg class="tk" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';
function toast(msg, kind){
  $('toastMsg').textContent = msg;
  $('toastIcon').innerHTML = (kind === 'ok') ? CHECK_SVG : '';
  var t = $('toast'); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}

/* ============ Preloader ============ */
var loader = $('loader');
/* scramble：hero mono 标签字符 churn 后 settle（OriginKit 手法） */
function scramble(el){
  var final = el.getAttribute('data-text') || el.textContent;
  el.setAttribute('data-text', final);
  if (RM) return;
  var glyphs = '█▓▒░<>/·—_+#';
  var t0 = null, dur = 620;
  function fr(now){
    if (!t0) t0 = now;
    var p = Math.min(1, (now - t0) / dur);
    var n = Math.floor(final.length * (1 - Math.pow(1 - p, 2)));
    var out = final.slice(0, n);
    for (var i = n; i < final.length; i++){
      out += (final[i] === ' ' || final[i] === '·') ? final[i]
        : glyphs[Math.floor(Math.random() * glyphs.length)];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(fr); else el.textContent = final;
  }
  requestAnimationFrame(fr);
}
function heroIn(id){
  var h = $(id); h.classList.remove('in'); void h.offsetWidth; h.classList.add('in');
  var k = h.querySelector('.hero-kicker'); if (k) scramble(k);
}
(function(){
  var QS = location.search || '';
  if (RM || sessionStorage.getItem('cetxt_seen') || QS.indexOf('noloader') > -1) {
    loader.style.display = 'none';
    heroIn('hero' + cap(initialTab()));
    return;
  }
  var c = $('lCount'), fill = $('lbarFill'), n = 0, t0 = null;
  function step(ts){
    if(!t0) t0 = ts;
    var p = Math.min(1, (ts - t0) / 1150);
    n = Math.round(100 * (1 - Math.pow(1-p, 3)));
    c.textContent = ('00' + n).slice(-3);
    fill.style.transform = 'scaleX(' + n/100 + ')';
    if (p < 1) requestAnimationFrame(step);
    else {
      sessionStorage.setItem('cetxt_seen','1');
      loader.classList.add('done');
      setTimeout(function(){ heroIn('hero' + cap(initialTab())); }, 350);
      setTimeout(function(){ loader.style.display = 'none'; }, 1400);
    }
  }
  requestAnimationFrame(step);
})();

/* ============ 自定义光标 ============ */
(function(){
  if (!FINE || RM) return;
  var dot = $('cur'), ring = $('curR');
  var mx = -100, my = -100, rx = -100, ry = -100, sc = .53;
  document.addEventListener('mousemove', function(e){
    mx = e.clientX; my = e.clientY;
    dot.style.transform = 'translate(' + (mx-3) + 'px,' + (my-3) + 'px)';
  });
  (function loop(){
    rx += (mx - rx) * .16; ry += (my - ry) * .16;
    sc += (((ring.classList.contains('big')) ? 1 : .53) - sc) * .18;
    ring.style.transform = 'translate(' + (rx-32) + 'px,' + (ry-32) + 'px) scale(' + sc.toFixed(3) + ')';
    requestAnimationFrame(loop);
  })();
  document.addEventListener('mouseover', function(e){
    if (e.target.closest('a,button,input,textarea,select,label.upload,.chip')) ring.classList.add('big');
  });
  document.addEventListener('mouseout', function(e){
    if (e.target.closest('a,button,input,textarea,select,label.upload,.chip')) ring.classList.remove('big');
  });
})();

/* ============ Hero spotlight ============ */
document.querySelectorAll('.hero').forEach(function(h){
  h.addEventListener('pointermove', function(e){
    var r = h.getBoundingClientRect();
    h.style.setProperty('--mx', ((e.clientX - r.left)/r.width*100) + '%');
    h.style.setProperty('--my', ((e.clientY - r.top)/r.height*100) + '%');
  });
});

/* ============ 磁吸按钮 ============ */
if (FINE && !RM) document.querySelectorAll('.mag').forEach(function(b){
  b.addEventListener('pointermove', function(e){
    var r = b.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2);
    b.style.transform = 'translate(' + dx*.12 + 'px,' + dy*.18 + 'px)';
  });
  b.addEventListener('pointerleave', function(){ b.style.transform = ''; });
});

/* ============ 滚动揭示 ============ */
var io = new IntersectionObserver(function(es){
  es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, {threshold:.1, rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('[data-rv]').forEach(function(el){ io.observe(el); });

/* ============ Marquee 无缝 ============ */
(function(){ var t = $('mqTrack'); t.innerHTML += t.innerHTML; })();

/* ============ Tab 切换 ============ */
var TABS = ['check','gen','val','robots'];
function switchTab(which){
  if (which === true) which = 'gen';
  else if (which === false) which = 'val';
  var tabs = TABS;
  if (tabs.indexOf(which) < 0) which = 'check';
  var show = $('tab' + cap(which));
  var hides = tabs.filter(function(x){ return x !== which; }).map(function(x){ return $('tab' + cap(x)); });
  if (!show.hidden) { heroIn('hero' + cap(which)); return; }
  function commit(){
    hides.forEach(function(h){ h.hidden = true; h.classList.remove('switching'); });
    show.hidden = false;
    show.classList.add('switching'); void show.offsetWidth; show.classList.remove('switching');
    tabs.forEach(function(x){
      var on = x === which;
      $('tabBtn' + cap(x)).classList.toggle('on', on);
      $('tabBtn' + cap(x)).setAttribute('aria-selected', on ? 'true' : 'false');
    });
    window.scrollTo({top:0, behavior: RM ? 'auto' : 'smooth'});
    heroIn('hero' + cap(which));
    closePal();
  }
  if (RM) { commit(); return; }
  hides.forEach(function(h){ h.classList.add('switching'); });
  setTimeout(commit, 200);
}
$('tabBtnGen').addEventListener('click', function(){ switchTab(true); });
$('tabBtnVal').addEventListener('click', function(){ switchTab(false); });
$('tabBtnCheck').addEventListener('click', function(){ switchTab('check'); });
$('tabBtnRobots').addEventListener('click', function(){ switchTab('robots'); });
$('brandHome').addEventListener('click', function(){ switchTab('check'); });
// 动态结果卡片使用行内 onclick 调用；脚本包在 IIFE 内，需显式暴露到全局
window.switchTab = switchTab;

/* ============ 生成器 ============ */
var state = { sections: [] };
/* 空状态幽灵样张：排印标本 */
var SPECIMEN = [
'# 我的博客','',
'> 一个记录独立开发实战的中文博客','',
'主要写出海 SaaS、AI 工具评测和独立开发收入复盘，每周更新。','',
'## 文章','',
'- [关于独立开发](https://example.com/indie): 独立开发入门指南',
'- [AI 工具评测](https://example.com/ai-tools): 每周更新的工具实测','',
'## 关于','',
'- [关于我](https://example.com/about): 博主介绍与联系方式'
];
var SPECIMEN_HTML = SPECIMEN.map(function(l){ return '<span class="pv-spec">' + esc(l) + '</span>'; }).join('\n');
var TPLS = {
  blog: { name:'我的博客', url:'https://example.com', tagline:'一个记录独立开发实战的中文博客',
    details:'主要写出海 SaaS、AI 工具评测和独立开发收入复盘，每周更新。',
    sections:[ {title:'文章', links:[
      {name:'关于独立开发', url:'https://example.com/indie', desc:'独立开发入门指南'},
      {name:'AI 工具评测', url:'https://example.com/ai-tools', desc:'每周更新的工具实测'} ]},
      {title:'关于', links:[ {name:'关于我', url:'https://example.com/about', desc:'博主介绍与联系方式'} ]} ] },
  company: { name:'示例公司', url:'https://example.com', tagline:'为中小团队提供 SaaS 工具',
    details:'成立于 2020 年，专注提升团队协作效率。',
    sections:[ {title:'产品', links:[
      {name:'产品介绍', url:'https://example.com/product', desc:'核心功能与定价'},
      {name:'客户案例', url:'https://example.com/cases', desc:'各行业落地案例'} ]},
      {title:'支持', links:[
      {name:'帮助中心', url:'https://example.com/help', desc:'常见问题与教程'},
      {name:'联系我们', url:'https://example.com/contact', desc:'商务合作与客服'} ]} ] },
  docs: { name:'示例文档', url:'https://example.com', tagline:'产品的使用文档与 API 参考',
    details:'面向开发者的完整文档，包含快速开始、概念讲解和 API 参考。',
    sections:[ {title:'快速开始', links:[
      {name:'安装', url:'https://example.com/docs/install', desc:'5 分钟跑起来'},
      {name:'第一个项目', url:'https://example.com/docs/quickstart', desc:'手把手教程'} ]},
      {title:'API 参考', links:[ {name:'REST API', url:'https://example.com/docs/api', desc:'完整接口文档'} ]} ] }
};

function syncFromInputs(){
  state.name = $('fName').value; state.url = $('fUrl').value;
  state.tagline = $('fTagline').value; state.details = $('fDetails').value;
}
function buildData(){
  syncFromInputs();
  return { siteName: state.name, siteUrl: state.url, tagline: state.tagline,
    details: state.details, sections: state.sections };
}
function renderSections(){
  var box = $('secList'); box.innerHTML = '';
  state.sections.forEach(function(sec, si){
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="rowhead"><h3>分组 ' + (si+1) + '</h3>' +
      '<button class="iconbtn sec-del" data-si="'+si+'" title="删除分组" aria-label="删除分组">' +
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 4h12M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M4 4l.8 9.2a1 1 0 001 .8h4.4a1 1 0 001-.8L12 4"/></svg></button></div>' +
      '<div class="field"><input type="text" data-sec="'+si+'" placeholder="分组标题，例如：产品文档" value="'+esc(sec.title)+'" aria-label="分组标题"></div>' +
      '<div data-links="'+si+'"></div>' +
      '<button class="chip addlink" data-addlink="'+si+'">+ 添加链接</button>';
    var linksBox = wrap.querySelector('[data-links="'+si+'"]');
    sec.links.forEach(function(lk, li){
      var row = document.createElement('div');
      row.className = 'linkrow';
      row.innerHTML =
        '<input type="text" placeholder="名称 *" value="'+esc(lk.name)+'" data-lk="'+si+':'+li+':name" aria-label="链接名称">' +
        '<input type="url" placeholder="https://… *" value="'+esc(lk.url)+'" data-lk="'+si+':'+li+':url" inputmode="url" aria-label="链接地址">' +
        '<input type="text" class="full" placeholder="一句话描述（推荐写）" value="'+esc(lk.desc)+'" data-lk="'+si+':'+li+':desc" aria-label="链接描述">' +
        '<button class="iconbtn full" data-dellink="'+si+':'+li+'" title="删除链接" aria-label="删除链接">' +
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10"/></svg></button>';
      linksBox.appendChild(row);
    });
    box.appendChild(wrap);
  });
  box.querySelectorAll('[data-sec]').forEach(function(inp){
    inp.addEventListener('input', function(){ state.sections[+inp.dataset.sec].title = inp.value; renderPreview(false); });
  });
  box.querySelectorAll('[data-lk]').forEach(function(inp){
    inp.addEventListener('input', function(){
      var p = inp.dataset.lk.split(':'), si = +p[0], li = +p[1], k = p[2];
      state.sections[si].links[li][k] = inp.value; renderPreview(false);
    });
  });
  box.querySelectorAll('[data-addlink]').forEach(function(b){
    b.addEventListener('click', function(){
      state.sections[+b.dataset.addlink].links.push({name:'',url:'',desc:''});
      renderSections(); renderPreview(true);
    });
  });
  box.querySelectorAll('[data-dellink]').forEach(function(b){
    b.addEventListener('click', function(){
      var p = b.dataset.dellink.split(':');
      state.sections[+p[0]].links.splice(+p[1],1);
      renderSections(); renderPreview(true);
    });
  });
  box.querySelectorAll('.sec-del').forEach(function(b){
    b.addEventListener('click', function(){
      state.sections.splice(+b.dataset.si,1);
      renderSections(); renderPreview(true);
    });
  });
}

function renderPreview(animate){
  var md = LLMS.generateLLMS(buildData());
  var has = (state.name||'').trim() !== '';
  var pv = $('preview');
  if (!has) {
    pv.innerHTML = SPECIMEN_HTML;   /* 幽灵样张：空状态的排印标本 */
    pv.classList.add('still');
  }
  else {
    var lines = md.split('\n');
    pv.innerHTML = lines.map(function(l,i){
      return '<span class="pv-line" style="--i:'+i+'">'+esc(l)+'</span>';
    }).join('\n');
    pv.classList.toggle('still', !animate || RM);
  }
  $('btnCopy').disabled = $('btnDl').disabled = $('btnToVal').disabled = !has;
  $('exWarn').hidden = !(has && /example\.com/.test(md));
  if (has) {
    $('stLines').textContent = md.split('\n').length;
    $('stChars').textContent = md.length;
    $('stLinks').textContent = (md.match(/\]\(((https?:)?\/\/[^)]+)\)/g) || []).length;
  } else { $('stLines').textContent = $('stChars').textContent = $('stLinks').textContent = '0'; }
}
function applyTpl(key){
  document.querySelectorAll('#tplChips .chip').forEach(function(c){ c.classList.toggle('on', c.dataset.tpl === key); });
  if (key === 'clear') {
    $('fName').value = $('fUrl').value = $('fTagline').value = $('fDetails').value = '';
    state.sections = [{title:'', links:[{name:'',url:'',desc:''}]}];
  } else {
    var t = TPLS[key];
    $('fName').value = t.name; $('fUrl').value = t.url;
    $('fTagline').value = t.tagline; $('fDetails').value = t.details;
    state.sections = JSON.parse(JSON.stringify(t.sections));
  }
  syncFromInputs(); renderSections(); renderPreview(true);
}
document.querySelectorAll('#tplChips .chip').forEach(function(c){
  c.addEventListener('click', function(){ applyTpl(c.dataset.tpl); });
});
['fName','fUrl','fTagline','fDetails'].forEach(function(id){
  $(id).addEventListener('input', function(){ syncFromInputs(); renderPreview(false); });
});
$('btnAddSec').addEventListener('click', function(){
  state.sections.push({title:'', links:[{name:'',url:'',desc:''}]});
  renderSections(); renderPreview(true);
});
$('btnCopy').addEventListener('click', function(){
  var txt = $('preview').textContent;
  function done(){ toast('已复制到剪贴板','ok'); renderPreview(true); }
  function fallback(){
    var ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch(e){ toast('复制失败，请手动选择复制'); }
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(fallback);
  } else fallback();
});
$('btnToVal').addEventListener('click', function(){
  $('vInput').value = $('preview').textContent;
  switchTab('val');
  setTimeout(function(){ $('btnValidate').click(); }, 250);
});
$('btnDl').addEventListener('click', function(){
  var blob = new Blob([$('preview').textContent], {type:'text/plain;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'llms.txt';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('llms.txt 已开始下载','ok');
});

/* ============ 校验器 ============ */
var SEV_TXT = { error:'错误', warn:'警告', suggest:'建议', info:'提示' };
var DIM_TXT = { h1:'H1 标题', summary:'摘要', sections:'H2 分组', links:'链接质量' };
var DIM_MAX = { h1:30, summary:20, sections:30, links:20 };
var SAMPLE = '# 我的博客\n\n> 一个写独立开发的中文博客\n\n这里记录出海、独立开发和 AI 工具的实战。\n\n## 文章\n\n- [第一篇](https://example.com/p1): 关于独立开发\n- [第二篇](/p2): 关于 AI 工具\n\n## 关于\n\n- [关于我](https://example.com/about)\n';
$('btnSample').addEventListener('click', function(){
  $('vInput').value = SAMPLE; toast('示例已载入','ok');
});
$('fileUp').addEventListener('change', function(){
  var f = this.files[0]; if (!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try {
      var dec = new TextDecoder($('encSel').value, {fatal:false});
      $('vInput').value = dec.decode(rd.result);
      toast('文件已读取：' + f.name,'ok');
    } catch(e) { toast('解码失败：浏览器不支持该编码'); }
  };
  rd.readAsArrayBuffer(f);
  this.value = '';
});
$('btnValidate').addEventListener('click', function(){
  var text = $('vInput').value;
  if (!text.trim()) {
    var ta = $('vInput');
    ta.classList.remove('shake'); void ta.offsetWidth; ta.classList.add('shake');
    ta.focus(); toast('先粘贴或上传文件内容'); return;
  }
  var btn = $('btnValidate'), orig = btn.innerHTML;
  btn.classList.add('working'); btn.innerHTML = '<span class="orb"></span>校验中';
  setTimeout(function(){
    renderResult(LLMS.validateLLMS(text));
    btn.classList.remove('working'); btn.innerHTML = orig;
    $('resultCard').hidden = false; $('emptyCard').hidden = true;
    io.observe($('resultCard'));
    $('resultCard').scrollIntoView({behavior: RM ? 'auto' : 'smooth', block:'start'});
  }, RM ? 0 : 650);
});
/* NumberFlow 式：逐位滚动，只动变化的位，短路径 */
function renderScore(to){
  var el = $('scoreNum');
  var str = String(Math.max(0, Math.min(100, Math.round(to))));
  el.innerHTML = '';
  str.split('').forEach(function(ch, i){
    var col = document.createElement('span'); col.className = 'dcol';
    var strip = document.createElement('span'); strip.className = 'dstrip';
    for (var d = 0; d <= 9; d++){
      var s = document.createElement('span'); s.className = 'dd'; s.textContent = d;
      strip.appendChild(s);
    }
    col.appendChild(strip); el.appendChild(col);
    (function(st, target, idx){
      requestAnimationFrame(function(){
        if (!RM) st.style.transitionDelay = (idx * 65) + 'ms';
        st.style.transform = 'translateY(' + (-target) + 'em)';
      });
    })(strip, +ch, i);
  });
}
function renderResult(r){
  var pct = Math.max(0, Math.min(100, r.score));
  renderScore(pct);
  var ec = r.issues.filter(function(i){return i.sev==='error';}).length,
      wc = r.issues.filter(function(i){return i.sev==='warn';}).length,
      sc = r.issues.filter(function(i){return i.sev==='suggest'||i.sev==='info';}).length;
  $('gradeTitle').textContent = r.hasError ? '存在不合规项'
    : ({'优秀':'写得很好','良好':'文件可用','可用':'基本可用','待改进':'需要改进'})[r.grade] || r.grade;
  $('gradeDesc').textContent = '发现 ' + ec + ' 个错误 · ' + wc + ' 个警告 · ' + sc + ' 条建议 · ' +
    r.stats.links + ' 个链接 · ' + r.stats.sections + ' 个分组 · 约 ' +
    (r.stats.bytes > 1024 ? Math.round(r.stats.bytes/1024) + 'KB' : r.stats.bytes + 'B');
  var dimsBox = $('dimsBox'); dimsBox.innerHTML = '';
  Object.keys(DIM_TXT).forEach(function(k){
    var p = DIM_MAX[k] ? Math.round(r.dims[k]/DIM_MAX[k]*100) : 0;
    var cls = p < 60 ? 'low' : p < 85 ? 'mid' : '';
    var row = document.createElement('div'); row.className = 'dim ' + cls;
    row.innerHTML = '<span class="k">' + DIM_TXT[k] + '</span>' +
      '<div class="bar"><i></i></div><b>' + r.dims[k] + '/' + DIM_MAX[k] + '</b>';
    dimsBox.appendChild(row);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      row.querySelector('i').style.width = p + '%';
    });});
  });
  var box = $('issuesBox'); box.innerHTML = ''; box.classList.remove('in');
  var order = { error:0, warn:1, suggest:2, info:3 };
  var items = r.issues.slice().sort(function(a,b){ return (order[a.sev]-order[b.sev]) || (a.line-b.line); });
  if (!items.length) box.innerHTML = '<div class="empty"><div class="big">很干净。</div><p>没有发现问题。</p></div>';
  items.forEach(function(it, idx){
    var d = document.createElement('div'); d.className = 'issue';
    d.style.setProperty('--i', Math.min(idx, 14));
    d.innerHTML = '<span class="sev ' + it.sev + '">' + SEV_TXT[it.sev] + '</span>' +
      '<div class="msg"><b>' + esc(it.msg) + '</b><span class="fix">' + esc(it.fix) + '</span></div>' +
      '<span class="ln">L' + it.line + '</span>';
    box.appendChild(d);
  });
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ box.classList.add('in'); }); });
  var ub = $('unverBox'); ub.innerHTML = '';
  r.unverified.forEach(function(u){
    var li = document.createElement('li');
    li.innerHTML = '<b>' + esc(u.title) + '</b>：' + esc(u.msg) + '（' + esc(u.fix) + '）';
    ub.appendChild(li);
  });
}

/* ============ ⌘K 命令面板 ============ */
var CMDS = [
  {t:'前往生成器', k:'G', fn:function(){ switchTab(true); }},
  {t:'前往校验器', k:'V', fn:function(){ switchTab(false); }},
  {t:'复制生成的 llms.txt', k:'C', fn:function(){ if(!$('btnCopy').disabled) $('btnCopy').click(); }},
  {t:'下载 llms.txt', k:'D', fn:function(){ if(!$('btnDl').disabled) $('btnDl').click(); }},
  {t:'生成后继续校验', k:'E', fn:function(){ if(!$('btnToVal').disabled) $('btnToVal').click(); }},
  {t:'载入校验示例', k:'S', fn:function(){ switchTab(false); $('btnSample').click(); }},
  {t:'开始校验', k:'↵', fn:function(){ switchTab(false); $('btnValidate').click(); }},
  {t:'查看 2026 中文网站 llms.txt 调查报告', k:'→', fn:function(){ location.href = '/survey/'; }},
  {t:'体检：查我的站（robots + 训练偏好 + llms.txt）', k:'T', fn:function(){ switchTab('check'); }},
  {t:'robots.txt / 训练偏好生成器', k:'R', fn:function(){ switchTab('robots'); }},
];
var palSel = 0, palItems = [];
function openPal(){
  var box = document.querySelector('.pal-box');
  try {
    var r = $('palOpen').getBoundingClientRect(), br = box.getBoundingClientRect();
    box.style.transformOrigin = ((r.left + r.width/2) - br.left) + 'px ' +
      ((r.top + r.height/2) - br.top) + 'px';
  } catch(e){}
  $('pal').classList.add('open'); palSel = 0;
  $('palInput').value = ''; renderPal('');
  setTimeout(function(){ $('palInput').focus(); }, 60);
}
function closePal(){ $('pal').classList.remove('open'); }
function renderPal(q){
  var list = $('palList'); list.innerHTML = ''; palItems = [];
  CMDS.filter(function(c){ return c.t.toLowerCase().indexOf(q.toLowerCase()) > -1; })
    .forEach(function(c, i){
      palItems.push(c);
      var b = document.createElement('button');
      b.className = 'pal-item' + (i === palSel ? ' sel' : '');
      b.innerHTML = '<span>' + esc(c.t) + '</span><span class="k">' + esc(c.k) + '</span>';
      b.addEventListener('click', function(){ closePal(); c.fn(); });
      b.addEventListener('mousemove', function(){ palSel = i; paintPalSel(); });
      list.appendChild(b);
    });
}
function paintPalSel(){
  $('palList').querySelectorAll('.pal-item').forEach(function(el, i){
    el.classList.toggle('sel', i === palSel);
  });
}
$('palOpen').addEventListener('click', openPal);

/* ---------- 调查通栏 ---------- */
(function(){
  var KEY = 'cetxt_announce';
  try {
    if (localStorage.getItem(KEY) === 'off') return;
  } catch(e){}
  document.body.classList.add('has-ann');
  $('announceX').addEventListener('click', function(){
    document.body.classList.remove('has-ann');
    try { localStorage.setItem(KEY, 'off'); } catch(e){}
  });
})();
$('pal').addEventListener('click', function(e){ if (e.target === $('pal')) closePal(); });
$('palInput').addEventListener('input', function(){ palSel = 0; renderPal(this.value); });
$('palInput').addEventListener('keydown', function(e){
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palSel+1, palItems.length-1); paintPalSel(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(palSel-1, 0); paintPalSel(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (palItems[palSel]) { closePal(); palItems[palSel].fn(); } }
  else if (e.key === 'Escape') closePal();
});
document.addEventListener('keydown', function(e){
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('pal').classList.contains('open') ? closePal() : openPal(); }
  else if (e.key === 'Escape') closePal();
});

/* ============ 共享给 audit-ui.js / robots-ui.js ============ */
window.CE = { $: $, esc: esc, toast: toast, switchTab: switchTab, RM: RM, io: io };

/* ============ 初始化 ============ */
state.sections = [{title:'', links:[{name:'',url:'',desc:''}]}];
renderSections(); renderPreview(false);
if ((location.search || '').indexOf('review') > -1) document.documentElement.classList.add('rev');
(function(){
  var it = initialTab();
  // 首屏默认是体检页（HTML 里就是可见的）；其他 tab 由 hash 进入
  if (it !== 'check') switchTab(it);
})();
if ((location.search || '').indexOf('demo=val') > -1) {
  switchTab(false);
  setTimeout(function(){ $('btnSample').click(); $('btnValidate').click(); }, 400);
}
})();
