/* en/view.js — 报告渲染（浏览器与 Worker 共用，纯字符串，无 DOM 依赖）。
 * 中英双语：renderReport(r, { lang: 'zh' }) 输出中文，默认英文。中文站 base 为 ''，英文站 '/en'（品牌域名 ''）。 */
import {renderSeo} from './seo-view.js';
import {renderGrades} from './grade-view.js';
import {gradeReport} from './grade.js';
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cleanDomain(v){v=(v||'').trim().toLowerCase().replace(/^https?:\/\//,'').split(/[\/?#]/)[0].replace(/\.$/,'');return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)?v:null}
/* 传统搜索引擎爬虫：不算“AI 搜索”，robots-only 回落时不列入 */
/* 11-04 新增、只查 robots.txt、不计入评级 */
export const UNGRADED=new Set(['MistralAI-User','MistralAI-Index','YouBot']);
export const CLASSIC=new Set(['Googlebot','Bingbot','Applebot','Baiduspider','YandexBot','Yeti']);
const isMain=b=>(b.category==='search'||b.category==='user')&&b.region!=='cn';
const isCnB=b=>(b.category==='search'||b.category==='user')&&b.region==='cn';
export const botSlug=t=>String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-');
const GUIDE={Cloudflare:'cloudflare',CloudFront:'cloudfront'};
const GUIDE_ZH={Cloudflare:'cloudflare',CloudFront:'cloudfront',EdgeOne:'edgeone','Alibaba Cloud ESA':'aliyun','Alibaba Cloud CDN':'aliyun'};
const TONE={open:'v-ok',warn:'v-warn',js_only:'v-warn',partly_blocked:'v-warn',silent_block:'v-bad',all_blocked:'v-bad',noindex:'v-bad',inconclusive:'v-gray',unknown:'v-gray'};
const ICON={'v-ok':'✓','v-warn':'!','v-bad':'✕','v-gray':'?'};

const EN={
  purpose:{search:'AI search',user:'User-triggered',training:'Training',dataset:'Dataset',unknown:'Other'},
  v:{
    open:['AI search crawlers can reach this site','robots.txt allows them and live requests got the same page a browser gets.'],
    warn:['Reachable, with caveats','Nothing is clearly blocked, but some requests were challenged or got a thinner page. See the rows marked “check”.'],
    js_only:['Reachable, but the page is nearly empty without JavaScript','Most AI crawlers don’t run JavaScript, so they see very little text.'],
    partly_blocked:['Some AI search crawlers are blocked','robots.txt or the firewall shuts out part of the AI search crawlers listed below.'],
    silent_block:['Silent block: requests as AI search crawlers are rejected','robots.txt says they’re welcome, but our requests with their user agents were rejected while a browser and a Googlebot request got through. Open a row for what we saw and how to confirm it.'],
    all_blocked:['AI search crawlers are blocked','Every AI search crawler we tested was disallowed by robots.txt or rejected in our live requests. Open a row for the evidence and its confidence.'],
    noindex:['The homepage asks not to be indexed','A noindex directive keeps it out of search and AI answers, whatever robots.txt says.'],
    inconclusive:['Inconclusive','The site blocked even our normal browser request, so we can’t tell AI crawlers apart from everyone else.'],
    unknown:['We couldn’t complete the live test','robots.txt results are still shown below.']
  },
  summaryTail:(n,m)=>'. '+n+' of '+m+' AI search crawlers can reach it',
  robots:{blocked:'Disallowed',partial:'Partly',allowed:'Allowed',na:'n/a'},
  live:{untested:'Not tested',blocked:'Blocked',challenge:' challenge',unverified:'Verified-bot rule',degraded:'Thin page',ok:' OK'},
  result:{silent:'Silent block',blocked:'Blocked',warn:'Check',ok:'Reachable'},
  ev:{
    homepage:'the homepage',operator:'the operator',page:t=>t+' page',
    ctl:(g,u)=>'Same URL as a browser: <b>200</b> · with a Googlebot user agent: <b>'+g+'</b> · as an unknown bot: <b>'+u+'</b>.',blockedWord:'blocked',
    confirm:(t,v,p)=>'In your CDN or WAF logs, look for '+t+' requests coming from '+v+'’s published IP ranges (linked on the '+p+') and check which rule they hit.',
    untestedO:r=>'Our normal browser request was blocked too, so the live test couldn’t separate crawlers from other visitors. robots.txt: <b>'+r+'</b>.',
    untestedS:t=>'We can only report what robots.txt says. The firewall’s treatment of '+t+' is unknown.',
    got:(u,t,c)=>'GET '+u+' with the '+t+' user agent returned <code>'+c+'</code>. ',
    high:t=>'The rejection follows the '+t+' user agent, not bots in general: most likely a rule aimed at AI crawlers. <b>High confidence.</b>',
    medium:t=>'Unknown bots are rejected too, so this is probably a general bot rule that also catches '+t+'. <b>Medium confidence.</b>',
    low:(t,v)=>'A request claiming to be Googlebot was rejected too, so the site probably verifies crawler IP addresses. The real '+t+', from '+v+'’s own network, may well get through. <b>Low confidence.</b>',
    thinO:(u,t)=>'GET '+u+' with the '+t+' user agent returned 200, but with far less readable text than a browser got.',
    thinS:'The site may serve crawlers a stripped or interstitial page.',
    thinK:t=>'Fetch the page with the '+t+' user agent yourself (for example with curl -A) and compare it with what a browser shows.',
    okO:(u,t,r)=>'GET '+u+' with the '+t+' user agent got the same page a browser gets. robots.txt: <b>'+r+'</b>.',
    okS:'No sign of a block for this crawler.',
    h:['What we observed','What it suggests','How to confirm']
  },
  fix:{
    cloudflare:'<p><b>Cloudflare</b> is answering these requests. In <b>Security → Settings</b>, check the AI bot controls (since Sep 15, 2026):</p><ol><li><b>Search</b>: set to <i>Allow</i>.</li><li><b>Training</b>: use <i>Disallow AI Training</i>, not <i>Block</i>. Block now also stops Googlebot, Bingbot and Applebot.</li><li><b>Agent</b>: <i>Block on pages with ads</i> blocks ChatGPT-User and Claude-User on those pages.</li><li>Look for older <b>custom WAF rules</b> matching <code>cf.verified_bot_category</code> or AI user agents, and check <b>Bot Fight Mode</b>.</li></ol>',
    cloudfront:'<p><b>Amazon CloudFront</b> is answering these requests, most likely through AWS WAF. The Bot Control rule <code>CategoryAI</code> blocks AI crawlers even when they are verified. Override it to <i>Count</i>, then re-block only the training crawlers with your own rule.</p>',
    akamai:'<p><b>Akamai</b> is answering these requests. In Bot Manager, find the AI crawler categories and change their action from deny to allow or monitor.</p>',
    edgeone:'<p><b>Tencent Cloud EdgeOne</b> is answering these requests. In <b>Security → Web Protection → Bot Management → AI Crawler Control</b>, check the action. Its list includes PerplexityBot, so <i>Block</i> also blocks an AI search crawler. Add an exception rule for the search crawlers you want, and check custom rules and Bot Basic Feature Management for user-agent blocks.</p>',
    aliyun:'<p><b>Alibaba Cloud</b> is answering these requests. In ESA, check <b>Security → AI Crawler Management</b> for crawlers set to <i>Block</i> (blocked requests get 403 by default), then <b>Security → Bots</b> and WAF custom rules for user-agent blocks.</p>',
    other:c=>'<p>Your server or security layer'+(c?' (<b>'+c+'</b>)':'')+' rejects these user agents. Look for user-agent block lists in your WAF, security plugin (Wordfence, Sucuri), or web-server config.</p>',
    allow:n=>'Crawlers to allow for AI search: <span class="mono">'+n+'</span>.',
    robo:n=>'robots.txt disallows <span class="mono">'+n+'</span>. To stay out of AI training but appear in AI search, use:',
    js:n=>'Only '+n+' characters of text exist without JavaScript. Render key content on the server (SSR or static generation) so crawlers that don’t run JavaScript can read it.',
    guide:c=>'Step-by-step '+c+' guide →',guides:'Fix guides for Cloudflare, CloudFront, WordPress and Shopify →',
    noindex:'Remove <code>noindex</code> from the homepage’s meta robots tag or <code>X-Robots-Tag</code> header if you want it indexed.'
  },
  meta:{checked:'checked',servedBy:'served by'},
  mon:d=>'<span><b>Watch '+d+'</b> · get an email if AI crawler access changes</span><span class="mb2">Early access →</span>',
  kpi:{reach:'AI search crawlers reachable',reachRobots:'AI search crawlers allowed by robots.txt',silent:'Silent firewall blocks',train:'Training crawlers blocked',text:'Text without JavaScript',chars:'chars'},
  table:{title:'Crawler by crawler',hint:'Open Details for the evidence',cols:['Crawler','Purpose','robots.txt','Live request','Result'],grpS:'AI search & user-triggered',grpC:'China search & AI engines (not graded)',grpT:'AI training',details:'Details',hide:'Hide'},
  fixTitle:'How to fix',
  method:B=>'<h4>How we test, and what it can’t tell you</h4><p>We request your homepage from a data-center IP as a normal browser, with a Googlebot user agent, as an unknown bot, and with each AI crawler’s user agent. We don’t come from the crawlers’ own networks, so a site that verifies crawler IP addresses may treat the real crawler differently. The control groups separate a rule aimed at AI crawlers (high confidence) from a general bot rule (medium) or an IP-verification rule (low). To be certain, check your CDN or WAF logs for requests from the crawler’s published IP ranges. <a href="'+B+'/research/">Methodology</a></p>',
  checks:{title:'Page checks',ptitle:'Page title',present:'Present',missing:'Missing',yes:'Yes',no:'No',js:'Content without JS',thin:'Thin',ok:'OK',na:'n/a',llms:'llms.txt (optional)',
    rNotFound:'Not found (all allowed)',rFound:'Found',rUnreach:'Unreachable',lValid:'Valid',lNone:'None',lHtml:'Serves HTML',lNonstd:'Non-standard',lUnknown:'Unknown'},
  share:{title:'Share this report',sub:'Send it to your developer or client.',link:'Report link',copy:'Copy',copied:'Copied',print:'Save as PDF'},
  locale:'en-US'
};

const ZH={
  purpose:{search:'AI 搜索',user:'用户触发',training:'训练',dataset:'数据集',unknown:'其他'},
  v:{
    open:['AI 搜索爬虫可以访问这个网站','robots.txt 允许它们，实测请求拿到的页面和浏览器一样。'],
    warn:['可以访问，但有隐患','没有明确的拦截，但部分请求遇到了验证页或拿到的内容更少。见标着“待查”的行。'],
    js_only:['可以访问，但不跑 JavaScript 时页面几乎是空的','大多数 AI 爬虫不执行 JavaScript，它们只能看到很少的文字。'],
    partly_blocked:['部分 AI 搜索爬虫被拦','robots.txt 或防火墙挡住了下面列出的一部分 AI 搜索爬虫。'],
    silent_block:['静默拦截：以 AI 搜索爬虫身份的请求被拒','robots.txt 写着欢迎，但我们用这些爬虫的 UA 发出的请求被拒绝，而浏览器和 Googlebot 请求都正常通过。展开每一行查看实测情况和确认方法。'],
    all_blocked:['AI 搜索爬虫全部被拦','我们测试的每个 AI 搜索爬虫都被 robots.txt 禁止，或在实测中被拒绝。展开每一行查看证据和可信度。'],
    noindex:['首页要求不被收录','页面带有 noindex，无论 robots.txt 怎么写，都不会出现在搜索和 AI 回答里。'],
    inconclusive:['无法判定','连我们的普通浏览器请求都被拦了，无法把 AI 爬虫和其他访客区分开。'],
    unknown:['实测没能完成','下面仍然显示 robots.txt 的结果。']
  },
  summaryTail:(n,m)=>'。'+m+' 个 AI 搜索爬虫中有 '+n+' 个能访问',
  robots:{blocked:'禁止',partial:'部分',allowed:'允许',na:'无'},
  live:{untested:'未测',blocked:'被拦',challenge:' 验证页',unverified:'爬虫核验规则',degraded:'内容缩水',ok:' 正常'},
  result:{silent:'静默拦截',blocked:'被拦',warn:'待查',ok:'可访问'},
  ev:{
    homepage:'首页',operator:'运营方',page:t=>t+' 介绍页',
    ctl:(g,u)=>'同一网址：浏览器 <b>200</b> · Googlebot UA <b>'+g+'</b> · 未知机器人 <b>'+u+'</b>。',blockedWord:'被拦',
    confirm:(t,v,p)=>'在你的 CDN 或 WAF 日志里，找来自 '+v+' 官方 IP 段（见'+p+'）的 '+t+' 请求，看它们命中了哪条规则。',
    untestedO:r=>'我们的普通浏览器请求也被拦了，实测无法把爬虫和其他访客区分开。robots.txt：<b>'+r+'</b>。',
    untestedS:t=>'只能报告 robots.txt 的结论，防火墙如何对待 '+t+' 未知。',
    got:(u,t,c)=>'用 '+t+' 的 UA 请求 '+u+'，返回 <code>'+c+'</code>。',
    high:t=>'被拒的是 '+t+' 这个 UA，而不是所有机器人，很可能是专门针对 AI 爬虫的规则。<b>高可信。</b>',
    medium:t=>'未知机器人也被拒，可能是一条通用的机器人规则顺带拦了 '+t+'。<b>中可信。</b>',
    low:(t,v)=>'冒充 Googlebot 的请求也被拒，网站很可能在核验爬虫 IP。来自 '+v+' 自家网络的真实 '+t+' 很可能可以通过。<b>低可信。</b>',
    thinO:(u,t)=>'用 '+t+' 的 UA 请求 '+u+' 返回 200，但可读文字比浏览器少很多。',
    thinS:'网站可能给爬虫返回了精简页或过渡页。',
    thinK:t=>'自己用 '+t+' 的 UA 抓一次（例如 curl -A），和浏览器看到的对比。',
    okO:(u,t,r)=>'用 '+t+' 的 UA 请求 '+u+'，拿到的页面和浏览器一样。robots.txt：<b>'+r+'</b>。',
    okS:'没有发现针对这个爬虫的拦截。',
    h:['实测看到了什么','说明什么','怎么确认']
  },
  fix:{
    cloudflare:'<p>这些请求由 <b>Cloudflare</b> 应答。在 <b>Security → Settings</b> 里检查 AI 爬虫三项设置（2026 年 9 月 15 日起）：</p><ol><li><b>Search</b>：设为 <i>Allow</i>。</li><li><b>Training</b>：用 <i>Disallow AI Training</i>，不要用 <i>Block</i>。现在 Block 会连 Googlebot、Bingbot、Applebot 一起拦。</li><li><b>Agent</b>：<i>Block on pages with ads</i> 会在有广告的页面拦掉 ChatGPT-User 和 Claude-User。</li><li>检查早先写的 <b>自定义 WAF 规则</b> 里有没有匹配 <code>cf.verified_bot_category</code> 或 AI 爬虫 UA 的，以及 <b>Bot Fight Mode</b>。</li></ol>',
    cloudfront:'<p>这些请求由 <b>Amazon CloudFront</b> 应答，多半是 AWS WAF 在拦。Bot Control 的 <code>CategoryAI</code> 规则连已验证的 AI 爬虫也会拦。把它覆盖为 <i>Count</i>，再用你自己的规则只拦训练爬虫。</p>',
    akamai:'<p>这些请求由 <b>Akamai</b> 应答。在 Bot Manager 里找到 AI 爬虫分类，把动作从拒绝改为允许或监控。</p>',
    edgeone:'<p>这些请求由 <b>腾讯云 EdgeOne</b> 应答。到 <b>安全防护 → Web 防护 → 域名级防护策略 → Bot 管理 → AI 爬虫处置</b> 看处置方式。它的识别名单里有 PerplexityBot，设成“拦截”会连这个 AI 搜索爬虫一起拦。用“防护例外规则”放行你要的搜索爬虫，再查自定义规则和 Bot 基础特征管理里的 UA 拦截。</p>',
    aliyun:'<p>这些请求由 <b>阿里云</b> 应答。ESA 用户到 <b>安全防护 → AI 爬虫管理</b> 看哪些爬虫是“拦截”（默认返回 403），再查 <b>安全防护 → Bots</b> 和 WAF 自定义规则里的 UA 拦截。</p>',
    other:c=>'<p>你的服务器或安全层'+(c?'（<b>'+c+'</b>）':'')+'拒绝了这些 UA。检查 WAF、安全插件（如宝塔防火墙、Wordfence）或 Web 服务器配置里的 UA 黑名单。</p>',
    allow:n=>'想出现在 AI 搜索里，需要放行：<span class="mono">'+n+'</span>。',
    robo:n=>'robots.txt 禁止了 <span class="mono">'+n+'</span>。既想拒绝 AI 训练、又想出现在 AI 搜索里，可以这样写：',
    js:n=>'不执行 JavaScript 时只有 '+n+' 个字符的文字。把关键内容放到服务端渲染（SSR 或静态生成），不跑 JavaScript 的爬虫才读得到。',
    guide:c=>c+' 分步修复指南 →',guides:'Cloudflare、CloudFront、WordPress、Shopify 修复指南 →',
    noindex:'如果希望被收录，请去掉首页 meta robots 或 <code>X-Robots-Tag</code> 响应头里的 <code>noindex</code>。'
  },
  meta:{checked:'检测于',servedBy:'应答方'},
  mon:d=>'<span><b>监控 '+d+'</b> · AI 爬虫访问一有变化就邮件通知你</span><span class="mb2">加入早期体验 →</span>',
  kpi:{reach:'可访问的 AI 搜索爬虫',reachRobots:'robots.txt 允许的 AI 搜索爬虫',silent:'防火墙静默拦截',train:'被拦的训练爬虫',text:'不跑 JS 时的文字',chars:'字符'},
  table:{title:'逐个爬虫',hint:'点“详情”查看证据',cols:['爬虫','用途','robots.txt','实测请求','结论'],grpS:'AI 搜索与用户触发',grpC:'中文搜索与 AI 引擎（不计入评级）',grpT:'AI 训练',details:'详情',hide:'收起'},
  fixTitle:'怎么修',
  method:B=>'<h4>我们怎么测，以及测不出什么</h4><p>我们从数据中心 IP 分别以普通浏览器、Googlebot UA、未知机器人和每个 AI 爬虫的 UA 请求你的首页。我们不是从这些爬虫自己的网络发出请求，所以核验爬虫 IP 的网站可能会区别对待真实爬虫。对照组用来区分专门针对 AI 爬虫的规则（高可信）、通用机器人规则（中）和 IP 核验规则（低）。要百分之百确定，请在 CDN 或 WAF 日志里查看来自爬虫官方 IP 段的请求。<a href="'+B+'/research/">方法说明</a></p>',
  checks:{title:'页面检查',ptitle:'页面标题',present:'有',missing:'缺失',yes:'是',no:'否',js:'不跑 JS 的内容',thin:'很少',ok:'正常',na:'无',llms:'llms.txt（可选）',
    rNotFound:'没有（全部允许）',rFound:'有',rUnreach:'无法访问',lValid:'有效',lNone:'没有',lHtml:'返回的是网页',lNonstd:'不规范',lUnknown:'未知'},
  share:{title:'分享这份报告',sub:'发给你的开发或客户。',link:'报告链接',copy:'复制',copied:'已复制',print:'存为 PDF'},
  locale:'zh-CN'
};
const T=lang=>lang==='zh'?ZH:EN;

export function summary(r,lang){const L=T(lang);const a=(r&&r.access)||{};const bots=a.bots||[];const s=bots.filter(b=>isMain(b));const reach=s.filter(b=>b.effective!=='blocked').length;const v=L.v[a.verdict]||L.v.unknown;return v[0]+(s.length?L.summaryTail(reach,s.length):'')+(lang==='zh'?'。':'.')}
export function bindReport(root,lang){const L=T(lang||(document.documentElement.lang==='zh-CN'||document.documentElement.lang==='zh'?'zh':'en'));const tg=(id,force)=>{const e=root.querySelector('#ev-'+id),b=root.querySelector('[aria-controls="ev-'+id+'"]');if(!e)return;const open=force!=null?force:e.hidden;e.hidden=!open;if(b){b.setAttribute('aria-expanded',open);b.textContent=open?L.table.hide:L.table.details}};root.querySelectorAll('tr.row').forEach(tr=>tr.onclick=e=>{if(e.target.closest('a,button'))return;tg(tr.dataset.i)});root.querySelectorAll('button.evb').forEach(b=>b.onclick=()=>tg(b.getAttribute('aria-controls').slice(3)));root.querySelectorAll('.copy').forEach(b=>b.onclick=()=>{navigator.clipboard.writeText(b.parentNode.textContent.replace(/^(Copy|复制)/,''));b.textContent=L.share.copied});const cp=root.querySelector('#cp');if(cp){const sl=root.querySelector('#sl');if(sl&&!sl.value)sl.value=location.href;cp.onclick=()=>{navigator.clipboard.writeText(sl.value);cp.textContent=L.share.copied}}const pr=root.querySelector('#pdf');if(pr)pr.onclick=()=>{root.querySelectorAll('tr.ev').forEach(e=>e.hidden=false);window.print()};root.querySelectorAll('time[datetime]').forEach(t=>{const d=new Date(t.getAttribute('datetime'));if(!isNaN(d))t.textContent=d.toLocaleString(L.locale,{dateStyle:'medium',timeStyle:'short'})})}

function robotsTag(s,L){return s==='blocked'?'<span class="tag t-bad">'+L.robots.blocked+'</span>':s==='partial'?'<span class="tag t-warn">'+L.robots.partial+'</span>':s==='allowed'?'<span class="tag t-ok">'+L.robots.allowed+'</span>':'<span class="tag t-gray">'+L.robots.na+'</span>'}
function liveTag(b,L){
  if(b.firewall==='untested')return '<span class="tag t-gray">'+L.live.untested+'</span>';
  if(b.firewall==='blocked')return '<span class="tag t-bad">'+(b.status?b.status:L.live.blocked)+(b.reason==='challenge'?L.live.challenge:'')+'</span>';
  if(b.firewall==='unverified')return '<span class="tag t-warn">'+L.live.unverified+'</span>';
  if(b.firewall==='degraded')return '<span class="tag t-warn">'+L.live.degraded+'</span>';
  return '<span class="tag t-ok">'+(b.status||200)+L.live.ok+'</span>';
}
function resultTag(b,L){return b.effective==='blocked'?'<span class="tag t-bad">'+(b.silent?L.result.silent:L.result.blocked)+'</span>':b.effective==='warn'?'<span class="tag t-warn">'+L.result.warn+'</span>':'<span class="tag t-ok">'+L.result.ok+'</span>'}
function robotsWord(s,L){return L.robots[s]||esc(s)}
function evidence(b,a,B,L){
  const E=L.ev;const c=a.controls||{};const url=esc(a.target||E.homepage);const tok=esc(b.token);const ven=esc(b.vendor||E.operator);
  const page='<a href="'+B+'/bots/'+botSlug(b.token)+'/">'+E.page(tok)+'</a>';
  const col=(h,t)=>'<div><h4>'+h+'</h4><p>'+t+'</p></div>';
  const ctl=E.ctl(c.googlebot_spoof_blocked?E.blockedWord:'200',c.unknown_bot_blocked?E.blockedWord:'200');
  const confirm=E.confirm(tok,ven,page);
  let o,s2,k;
  if(b.firewall==='untested'){o=E.untestedO(robotsWord(b.robots,L));s2=E.untestedS(tok);k=confirm}
  else if(b.firewall==='blocked'){o=E.got(url,tok,esc(b.reason))+ctl;s2=b.confidence==='high'?E.high(tok):E.medium(tok);k=confirm}
  else if(b.firewall==='unverified'){o=E.got(url,tok,esc(b.reason))+ctl;s2=E.low(tok,ven);k=confirm}
  else if(b.firewall==='degraded'){o=E.thinO(url,tok);s2=E.thinS;k=E.thinK(tok)}
  else{o=E.okO(url,tok,robotsWord(b.robots,L));s2=E.okS;k=''}
  return '<div class="evg">'+col(E.h[0],o)+col(E.h[1],s2)+(k?col(E.h[2],k):'')+'</div>';
}
function fixFor(a,B,L){
  const F=L.fix;
  const blocked=(a.bots||[]).filter(b=>b.firewall==='blocked');
  const robo=(a.bots||[]).filter(b=>b.robots==='blocked'&&isMain(b));
  let h='';
  if(blocked.length){
    const names=blocked.filter(b=>b.category!=='training').map(b=>b.token);
    h+=a.cdn==='Cloudflare'?F.cloudflare:a.cdn==='CloudFront'?F.cloudfront:a.cdn==='Akamai'?F.akamai:a.cdn==='EdgeOne'?F.edgeone:/^Alibaba Cloud/.test(a.cdn||'')?F.aliyun:F.other(a.cdn?esc(a.cdn):'');
    if(names.length)h+='<p style="margin-top:8px">'+F.allow(names.map(esc).join(', '))+'</p>';
  }
  if(robo.length)h+='<p style="margin-top:10px">'+F.robo(robo.map(b=>esc(b.token)).join(', '))+'</p><pre><button class="copy">'+L.share.copy+'</button>User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nUser-agent: Claude-SearchBot\nAllow: /</pre>';
  if(a.page&&a.page.js_only)h+='<p style="margin-top:10px">'+F.js(a.page.text_chars)+'</p>';
  if(blocked.length){const g=(L===ZH?GUIDE_ZH:GUIDE)[a.cdn];h+='<p style="margin-top:10px"><a href="'+B+'/guides/'+(g?g+'/':'')+'">'+(g?F.guide(esc(a.cdn)):F.guides)+'</a></p>'}
  if(a.page&&a.page.noindex)h+='<p style="margin-top:10px">'+F.noindex+'</p>';
  return h;
}
/* 分享图用：结论、色调、AI 搜索爬虫可达数（分享图只出英文） */
export function ogData(r,lang){const L=T(lang);const a=(r&&r.access)||{};const verdict=L.v[a.verdict]?a.verdict:'unknown';const ra=(r&&r.robots&&r.robots.analysis&&r.robots.analysis.access)||[];const live=a.bots&&a.bots.length;
  const bots=live?a.bots:ra.filter(b=>isMain(b)&&!CLASSIC.has(b.token)&&!UNGRADED.has(b.token)).map(b=>({category:b.category,effective:b.status==='blocked'?'blocked':'ok'}));
  const s=bots.filter(b=>isMain(b));
  return {verdict:a.verdict||'unknown',title:L.v[verdict][0],tone:{'v-ok':'ok','v-warn':'warn','v-bad':'bad','v-gray':'gray'}[TONE[verdict]],reach:s.filter(b=>b.effective!=='blocked').length,total:s.length,live:!!live,grades:(G=>({access:G.access.grade,read:G.read.grade,cite:G.cite.grade}))(gradeReport(r||{}))}}
export function renderReport(r,opt){
  opt=opt||{};const L=T(opt.lang);const when=opt.when||new Date().toISOString();const shareUrl=opt.url||'';
  const a=r.access||{verdict:'unknown'};
  const vk=L.v[a.verdict]?a.verdict:'unknown';const v=L.v[vk];const tone=TONE[vk];
  const ra=(r.robots&&r.robots.analysis&&r.robots.analysis.access)||[];
  const untested=!(a.bots&&a.bots.length);
  const B=opt.base==null?(opt.lang==='zh'?'':'/en'):opt.base;
  const roRow=b=>({token:b.token,vendor:b.vendor,category:b.category,region:b.region,robots:b.status,firewall:'untested',effective:b.status==='blocked'?'blocked':'ok'});
  // 实测报告也列出只做 robots.txt 分析的爬虫（UNGRADED，如 Mistral、You.com），防火墙一栏显示未测，不计入可访问数
  const bots=!untested?a.bots.concat(ra.filter(b=>UNGRADED.has(b.token)&&['search','user','training'].includes(b.category)&&!a.bots.some(x=>x.token===b.token)).map(roRow)):ra.filter(b=>['search','user','training'].includes(b.category)&&!CLASSIC.has(b.token)).map(roRow);
  const search=bots.filter(b=>isMain(b));
  const train=bots.filter(b=>b.category==='training');
  const sg=search.filter(b=>!UNGRADED.has(b.token));const reach=sg.filter(b=>b.effective!=='blocked').length;
  const llm=r.llms||{};
  const robots=r.robots||{};
  const meta=(a.target?esc(a.target)+' · ':'')+L.meta.checked+' <time datetime="'+esc(when)+'">'+esc(when.slice(0,16).replace('T',' '))+' UTC</time>'+(a.cdn?' · '+L.meta.servedBy+' '+esc(a.cdn):'');
  let rows='';
  const grp=(t,list)=>{if(!list.length)return;rows+='<tr class="grp"><td colspan="5">'+t+'</td></tr>';list.forEach(b=>{rows+='<tr class="row" data-i="'+b.token+'"><td><div class="bot"><a href="'+B+'/bots/'+botSlug(b.token)+'/">'+esc(b.token)+'</a></div><div class="vd">'+esc(b.vendor||'')+'</div></td><td class="hide-s">'+(L.purpose[b.category]||L.purpose.unknown)+'</td><td>'+robotsTag(b.robots,L)+'</td><td class="hide-s">'+liveTag(b,L)+'</td><td><div class="rcell">'+resultTag(b,L)+'<button type="button" class="evb" aria-expanded="false" aria-controls="ev-'+b.token+'">'+L.table.details+'</button></div></td></tr><tr class="ev" id="ev-'+b.token+'" hidden><td colspan="5">'+evidence(b,a,B,L)+'</td></tr>'})};
  grp(L.table.grpS,search);grp(L.table.grpC,bots.filter(isCnB));grp(L.table.grpT,train);
  const page=Object.assign({},a.page||{});
  {const tc=r.seo&&Array.isArray(r.seo.checks)&&r.seo.checks.find(c=>c.id==='text');if(tc&&tc.data&&typeof tc.data.chars==='number')page.text_chars=tc.data.chars;}
  const fix=fixFor(a,B,L);
  const C=L.checks;
  const chk=(label,val,cls)=>'<li><span>'+label+'</span><span class="tag '+cls+'">'+val+'</span></li>';
  const robotsState=robots.http_status===404?[C.rNotFound,'t-gray']:robots.http_status===200?[C.rFound,'t-ok']:[C.rUnreach,'t-warn'];
  const llmsState=llm.verdict==='real'?[C.lValid,'t-ok']:llm.verdict==='missing'?[C.lNone,'t-gray']:llm.verdict==='html_spoof'?[C.lHtml,'t-warn']:llm.verdict==='nonstandard'?[C.lNonstd,'t-warn']:[C.lUnknown,'t-gray'];
  const K=L.kpi,TB=L.table;
  const html='<div class="fade">'+
   '<div class="verdict '+tone+'"><div class="vi" aria-hidden="true">'+ICON[tone]+'</div><div><h2>'+v[0]+'</h2><p>'+v[1]+'</p></div></div>'+
   (r.domain?'<a class="monbar" href="'+B+'/pricing/?site='+encodeURIComponent(r.domain)+'#join">'+L.mon(esc(r.domain))+'</a>':'')+
   renderGrades(r,opt.lang)+
   '<div class="kpis"><div class="kpi"><div class="k">'+(untested?K.reachRobots:K.reach)+'</div><div class="v">'+(sg.length?reach+'<small> / '+sg.length+'</small>':'–')+'</div></div>'+
   '<div class="kpi"><div class="k">'+K.silent+'</div><div class="v">'+(untested?'–':((a.counts&&a.counts.silent)||0))+'</div></div>'+
   '<div class="kpi"><div class="k">'+K.train+'</div><div class="v">'+train.filter(b=>b.effective==='blocked').length+'<small> / '+train.length+'</small></div></div>'+
   '<div class="kpi"><div class="k">'+K.text+'</div><div class="v">'+(page.text_chars!=null?page.text_chars.toLocaleString():'–')+'<small> '+K.chars+'</small></div></div></div>'+
   '<div class="cols"><div>'+
    (bots.length?'<div class="panel" id="crawlers"><h3>'+TB.title+' <span>'+TB.hint+'</span></h3><table><thead><tr><th>'+TB.cols[0]+'</th><th class="hide-s">'+TB.cols[1]+'</th><th>'+TB.cols[2]+'</th><th class="hide-s">'+TB.cols[3]+'</th><th>'+TB.cols[4]+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'')+
    (fix?'<div class="panel fix"><h3>'+L.fixTitle+'</h3><div class="body">'+fix+'</div></div>':'')+
    renderSeo(r.seo,opt.lang)+
    '<div class="method">'+L.method(B)+'</div>'+
   '</div><div class="side">'+
    '<div class="panel"><h3>'+C.title+'</h3><ul class="checks">'+
      chk(C.ptitle,page.title?C.present:(page.text_chars==null?C.na:C.missing),page.title?'t-ok':(page.text_chars==null?'t-gray':'t-warn'))+
      chk('noindex',page.noindex?C.yes:C.no,page.noindex?'t-bad':'t-ok')+
      chk('nosnippet',page.nosnippet?C.yes:C.no,page.nosnippet?'t-warn':'t-ok')+
      chk(C.js,page.js_only?C.thin:(page.text_chars!=null?C.ok:C.na),page.js_only?'t-warn':(page.text_chars!=null?'t-ok':'t-gray'))+
      chk('robots.txt',robotsState[0],robotsState[1])+
      chk(C.llms,llmsState[0],llmsState[1])+
    '</ul></div>'+
    '<div class="panel"><h3>'+L.share.title+'</h3><div class="share">'+L.share.sub+'<div class="row2"><input readonly id="sl" aria-label="'+L.share.link+'" value="'+esc(shareUrl)+'"><button id="cp">'+L.share.copy+'</button></div><button id="pdf" class="pdfb" type="button">'+L.share.print+'</button></div></div>'+
   '</div></div></div>';
  return {meta,html,verdict:a.verdict||'unknown',title:v[0],summary:summary(r,opt.lang)};
}
