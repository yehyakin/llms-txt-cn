/* en/view.js — 报告渲染（浏览器与 Worker 共用，纯字符串，无 DOM 依赖） */
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cleanDomain(v){v=(v||'').trim().toLowerCase().replace(/^https?:\/\//,'').split(/[\/?#]/)[0].replace(/\.$/,'');return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)?v:null}
export function summary(r){const a=(r&&r.access)||{};const bots=a.bots||[];const s=bots.filter(b=>b.category==='search'||b.category==='user');const reach=s.filter(b=>b.effective!=='blocked').length;const v=V[a.verdict]||V.unknown;return v[2]+(s.length?'. '+reach+' of '+s.length+' AI search crawlers can reach it':'')+'.'}
export function bindReport(root){const tg=(id,force)=>{const e=root.querySelector('#ev-'+id),b=root.querySelector('[aria-controls="ev-'+id+'"]');if(!e)return;const open=force!=null?force:e.hidden;e.hidden=!open;if(b){b.setAttribute('aria-expanded',open);b.textContent=open?'Hide':'Details'}};root.querySelectorAll('tr.row').forEach(tr=>tr.onclick=e=>{if(e.target.closest('a,button'))return;tg(tr.dataset.i)});root.querySelectorAll('button.evb').forEach(b=>b.onclick=()=>tg(b.getAttribute('aria-controls').slice(3)));root.querySelectorAll('.copy').forEach(b=>b.onclick=()=>{navigator.clipboard.writeText(b.parentNode.textContent.replace(/^Copy/,''));b.textContent='Copied'});const cp=root.querySelector('#cp');if(cp){const sl=root.querySelector('#sl');if(sl&&!sl.value)sl.value=location.href;cp.onclick=()=>{navigator.clipboard.writeText(sl.value);cp.textContent='Copied'}}root.querySelectorAll('time[datetime]').forEach(t=>{const d=new Date(t.getAttribute('datetime'));if(!isNaN(d))t.textContent=d.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})})}
const PURPOSE={search:'AI search',user:'User-triggered',training:'Training',dataset:'Dataset',unknown:'Other'};
/* 传统搜索引擎爬虫：不算“AI 搜索”，robots-only 回落时不列入 */
export const CLASSIC=new Set(['Googlebot','Bingbot','Applebot','Baiduspider']);
export const botSlug=t=>String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-');
const GUIDE={Cloudflare:'cloudflare',CloudFront:'cloudfront'};
const V={
  open:['v-ok','✓','AI search crawlers can reach this site','robots.txt allows them and live requests got the same page a browser gets.'],
  warn:['v-warn','!','Reachable, with caveats','Nothing is clearly blocked, but some requests were challenged or got a thinner page. See the rows marked “check”.'],
  js_only:['v-warn','!','Reachable, but the page is nearly empty without JavaScript','Most AI crawlers don’t run JavaScript, so they see very little text.'],
  partly_blocked:['v-warn','!','Some AI search crawlers are blocked','robots.txt or the firewall shuts out part of the AI search crawlers listed below.'],
  silent_block:['v-bad','✕','Silent block: requests as AI search crawlers are rejected','robots.txt says they’re welcome, but our requests with their user agents were rejected while a browser and a Googlebot request got through. Open a row for what we saw and how to confirm it.'],
  all_blocked:['v-bad','✕','AI search crawlers are blocked','Every AI search crawler we tested was disallowed by robots.txt or rejected in our live requests. Open a row for the evidence and its confidence.'],
  noindex:['v-bad','✕','The homepage asks not to be indexed','A noindex directive keeps it out of search and AI answers, whatever robots.txt says.'],
  inconclusive:['v-gray','?','Inconclusive','The site blocked even our normal browser request, so we can’t tell AI crawlers apart from everyone else.'],
  unknown:['v-gray','?','We couldn’t complete the live test','robots.txt results are still shown below.']
};
function robotsTag(s){return s==='blocked'?'<span class="tag t-bad">Disallowed</span>':s==='partial'?'<span class="tag t-warn">Partly</span>':s==='allowed'?'<span class="tag t-ok">Allowed</span>':'<span class="tag t-gray">n/a</span>'}
function liveTag(b){
  if(b.firewall==='untested')return '<span class="tag t-gray">Not tested</span>';
  if(b.firewall==='blocked')return '<span class="tag t-bad">'+(b.status?b.status:'Blocked')+(b.reason==='challenge'?' challenge':'')+'</span>';
  if(b.firewall==='unverified')return '<span class="tag t-warn">Verified-bot rule</span>';
  if(b.firewall==='degraded')return '<span class="tag t-warn">Thin page</span>';
  return '<span class="tag t-ok">'+(b.status||200)+' OK</span>';
}
function resultTag(b){return b.effective==='blocked'?'<span class="tag t-bad">'+(b.silent?'Silent block':'Blocked')+'</span>':b.effective==='warn'?'<span class="tag t-warn">Check</span>':'<span class="tag t-ok">Reachable</span>'}
const VNAME={OpenAI:'OpenAI',Anthropic:'Anthropic',Perplexity:'Perplexity'};
function evidence(b,a,B){
  const c=a.controls||{};const url=esc(a.target||'the homepage');const tok=esc(b.token);const ven=esc(b.vendor||'the operator');
  const page='<a href="'+B+'/bots/'+botSlug(b.token)+'/">'+tok+' page</a>';
  const col=(h,t)=>'<div><h4>'+h+'</h4><p>'+t+'</p></div>';
  const ctl='Same URL as a browser: <b>200</b> · with a Googlebot user agent: <b>'+(c.googlebot_spoof_blocked?'blocked':'200')+'</b> · as an unknown bot: <b>'+(c.unknown_bot_blocked?'blocked':'200')+'</b>.';
  const confirm='In your CDN or WAF logs, look for '+tok+' requests coming from '+ven+'’s published IP ranges (linked on the '+page+') and check which rule they hit.';
  let o,s2,k;
  if(b.firewall==='untested'){o='Our normal browser request was blocked too, so the live test couldn’t separate crawlers from other visitors. robots.txt: <b>'+esc(b.robots)+'</b>.';s2='We can only report what robots.txt says. The firewall’s treatment of '+tok+' is unknown.';k=confirm}
  else if(b.firewall==='blocked'){o='GET '+url+' with the '+tok+' user agent returned <code>'+esc(b.reason)+'</code>. '+ctl;
    s2=b.confidence==='high'?'The rejection follows the '+tok+' user agent, not bots in general: most likely a rule aimed at AI crawlers. <b>High confidence.</b>':'Unknown bots are rejected too, so this is probably a general bot rule that also catches '+tok+'. <b>Medium confidence.</b>';k=confirm}
  else if(b.firewall==='unverified'){o='GET '+url+' with the '+tok+' user agent returned <code>'+esc(b.reason)+'</code>. '+ctl;
    s2='A request claiming to be Googlebot was rejected too, so the site probably verifies crawler IP addresses. The real '+tok+', from '+ven+'’s own network, may well get through. <b>Low confidence.</b>';k=confirm}
  else if(b.firewall==='degraded'){o='GET '+url+' with the '+tok+' user agent returned 200, but with far less readable text than a browser got.';s2='The site may serve crawlers a stripped or interstitial page.';k='Fetch the page with the '+tok+' user agent yourself (for example with curl -A) and compare it with what a browser shows.'}
  else{o='GET '+url+' with the '+tok+' user agent got the same page a browser gets. robots.txt: <b>'+esc(b.robots)+'</b>.';s2='No sign of a block for this crawler.';k=''}
  return '<div class="evg">'+col('What we observed',o)+col('What it suggests',s2)+(k?col('How to confirm',k):'')+'</div>';
}
function fixFor(a,B){
  const blocked=(a.bots||[]).filter(b=>b.firewall==='blocked');
  const robo=(a.bots||[]).filter(b=>b.robots==='blocked'&&(b.category==='search'||b.category==='user'));
  let h='';
  if(blocked.length){
    const names=blocked.filter(b=>b.category!=='training').map(b=>b.token);
    if(a.cdn==='Cloudflare')h+='<p><b>Cloudflare</b> is answering these requests. In <b>Security → Settings</b>, check the AI bot controls (since Sep 15, 2026):</p><ol><li><b>Search</b>: set to <i>Allow</i>.</li><li><b>Training</b>: use <i>Disallow AI Training</i>, not <i>Block</i>. Block now also stops Googlebot, Bingbot and Applebot.</li><li><b>Agent</b>: <i>Block on pages with ads</i> blocks ChatGPT-User and Claude-User on those pages.</li><li>Look for older <b>custom WAF rules</b> matching <code>cf.verified_bot_category</code> or AI user agents, and check <b>Bot Fight Mode</b>.</li></ol>';
    else if(a.cdn==='CloudFront')h+='<p><b>Amazon CloudFront</b> is answering these requests, most likely through AWS WAF. The Bot Control rule <code>CategoryAI</code> blocks AI crawlers even when they are verified. Override it to <i>Count</i>, then re-block only the training crawlers with your own rule.</p>';
    else if(a.cdn==='Akamai')h+='<p><b>Akamai</b> is answering these requests. In Bot Manager, find the AI crawler categories and change their action from deny to allow or monitor.</p>';
    else h+='<p>Your server or security layer'+(a.cdn?' (<b>'+esc(a.cdn)+'</b>)':'')+' rejects these user agents. Look for user-agent block lists in your WAF, security plugin (Wordfence, Sucuri), or web-server config.</p>';
    if(names.length)h+='<p style="margin-top:8px">Crawlers to allow for AI search: <span class="mono">'+names.map(esc).join(', ')+'</span>.</p>';
  }
  if(robo.length){
    h+='<p style="margin-top:10px">robots.txt disallows <span class="mono">'+robo.map(b=>esc(b.token)).join(', ')+'</span>. To stay out of AI training but appear in AI search, use:</p><pre><button class="copy">Copy</button>User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nUser-agent: Claude-SearchBot\nAllow: /</pre>';
  }
  if(a.page&&a.page.js_only)h+='<p style="margin-top:10px">Only '+a.page.text_chars+' characters of text exist without JavaScript. Render key content on the server (SSR or static generation) so crawlers that don’t run JavaScript can read it.</p>';
  if(blocked.length){const g=GUIDE[a.cdn];h+='<p style="margin-top:10px"><a href="'+B+'/guides/'+(g?g+'/':'')+'">'+(g?'Step-by-step '+esc(a.cdn)+' guide →':'Fix guides for Cloudflare, CloudFront, WordPress and Shopify →')+'</a></p>'}
  if(a.page&&a.page.noindex)h+='<p style="margin-top:10px">Remove <code>noindex</code> from the homepage’s meta robots tag or <code>X-Robots-Tag</code> header if you want it indexed.</p>';
  return h;
}
/* 分享图用：结论、色调、AI 搜索爬虫可达数 */
export function ogData(r){const a=(r&&r.access)||{};const v=V[a.verdict]||V.unknown;const ra=(r&&r.robots&&r.robots.analysis&&r.robots.analysis.access)||[];const live=a.bots&&a.bots.length;
  const bots=live?a.bots:ra.filter(b=>(b.category==='search'||b.category==='user')&&!CLASSIC.has(b.token)).map(b=>({category:b.category,effective:b.status==='blocked'?'blocked':'ok'}));
  const s=bots.filter(b=>b.category==='search'||b.category==='user');
  return {verdict:a.verdict||'unknown',title:v[2],tone:{'v-ok':'ok','v-warn':'warn','v-bad':'bad','v-gray':'gray'}[v[0]],reach:s.filter(b=>b.effective!=='blocked').length,total:s.length,live:!!live}}
export function renderReport(r,opt){
  opt=opt||{};const when=opt.when||new Date().toISOString();const shareUrl=opt.url||'';
  const a=r.access||{verdict:'unknown'};
  const v=V[a.verdict]||V.unknown;
  const ra=(r.robots&&r.robots.analysis&&r.robots.analysis.access)||[];
  const untested=!(a.bots&&a.bots.length);
  const B=opt.base==null?'/en':opt.base;
  const bots=!untested?a.bots:ra.filter(b=>['search','user','training'].includes(b.category)&&!CLASSIC.has(b.token)).map(b=>({token:b.token,vendor:b.vendor,category:b.category,robots:b.status,firewall:'untested',effective:b.status==='blocked'?'blocked':'ok'}));
  const search=bots.filter(b=>b.category==='search'||b.category==='user');
  const train=bots.filter(b=>b.category==='training');
  const reach=search.filter(b=>b.effective!=='blocked').length;
  const llm=r.llms||{};
  const robots=r.robots||{};
  const meta=(a.target?esc(a.target)+' · ':'')+'checked <time datetime="'+esc(when)+'">'+esc(when.slice(0,16).replace('T',' '))+' UTC</time>'+(a.cdn?' · served by '+esc(a.cdn):'');
  let rows='';
  const grp=(t,list)=>{if(!list.length)return;rows+='<tr class="grp"><td colspan="5">'+t+'</td></tr>';list.forEach((b,i)=>{rows+='<tr class="row" data-i="'+b.token+'"><td><div class="bot"><a href="'+B+'/bots/'+botSlug(b.token)+'/">'+esc(b.token)+'</a></div><div class="vd">'+esc(b.vendor||'')+'</div></td><td class="hide-s">'+PURPOSE[b.category]+'</td><td>'+robotsTag(b.robots)+'</td><td class="hide-s">'+liveTag(b)+'</td><td><div class="rcell">'+resultTag(b)+'<button type="button" class="evb" aria-expanded="false" aria-controls="ev-'+b.token+'">Details</button></div></td></tr><tr class="ev" id="ev-'+b.token+'" hidden><td colspan="5">'+evidence(b,a,B)+'</td></tr>'})};
  grp('AI search & user-triggered',search);grp('AI training',train);
  const page=a.page||{};
  const fix=fixFor(a,B);
  const chk=(label,val,cls)=>'<li><span>'+label+'</span><span class="tag '+cls+'">'+val+'</span></li>';
  const robotsState=robots.http_status===404?['Not found (all allowed)','t-gray']:robots.http_status===200?['Found','t-ok']:['Unreachable','t-warn'];
  const llmsState=llm.verdict==='real'?['Valid','t-ok']:llm.verdict==='missing'?['None','t-gray']:llm.verdict==='html_spoof'?['Serves HTML','t-warn']:llm.verdict==='nonstandard'?['Non-standard','t-warn']:['Unknown','t-gray'];
  const html='<div class="fade">'+
   '<div class="verdict '+v[0]+'"><div class="vi" aria-hidden="true">'+v[1]+'</div><div><h2>'+v[2]+'</h2><p>'+v[3]+'</p></div></div>'+
   (r.domain?'<a class="monbar" href="'+B+'/pricing/?site='+encodeURIComponent(r.domain)+'#join"><span><b>Watch '+esc(r.domain)+'</b> · get an email if AI crawler access changes</span><span class="mb2">Early access →</span></a>':'')+
   '<div class="kpis"><div class="kpi"><div class="k">AI search crawlers '+(untested?'allowed by robots.txt':'reachable')+'</div><div class="v">'+(search.length?reach+'<small> / '+search.length+'</small>':'–')+'</div></div>'+
   '<div class="kpi"><div class="k">Silent firewall blocks</div><div class="v">'+(untested?'–':((a.counts&&a.counts.silent)||0))+'</div></div>'+
   '<div class="kpi"><div class="k">Training crawlers blocked</div><div class="v">'+train.filter(b=>b.effective==='blocked').length+'<small> / '+train.length+'</small></div></div>'+
   '<div class="kpi"><div class="k">Text without JavaScript</div><div class="v">'+(page.text_chars!=null?page.text_chars.toLocaleString():'–')+'<small> chars</small></div></div></div>'+
   '<div class="cols"><div>'+
    (bots.length?'<div class="panel"><h3>Crawler by crawler <span>Open Details for the evidence</span></h3><table><thead><tr><th>Crawler</th><th class="hide-s">Purpose</th><th>robots.txt</th><th class="hide-s">Live request</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'')+
    (fix?'<div class="panel fix"><h3>How to fix</h3><div class="body">'+fix+'</div></div>':'')+
    '<div class="method"><h4>How we test, and what it can’t tell you</h4><p>We request your homepage from a data-center IP as a normal browser, with a Googlebot user agent, as an unknown bot, and with each AI crawler’s user agent. We don’t come from the crawlers’ own networks, so a site that verifies crawler IP addresses may treat the real crawler differently. The control groups separate a rule aimed at AI crawlers (high confidence) from a general bot rule (medium) or an IP-verification rule (low). To be certain, check your CDN or WAF logs for requests from the crawler’s published IP ranges. <a href="'+B+'/research/">Methodology</a></p></div>'+
   '</div><div class="side">'+
    '<div class="panel"><h3>Page checks</h3><ul class="checks">'+
      chk('Page title',page.title?'Present':(page.text_chars==null?'n/a':'Missing'),page.title?'t-ok':(page.text_chars==null?'t-gray':'t-warn'))+
      chk('noindex',page.noindex?'Yes':'No',page.noindex?'t-bad':'t-ok')+
      chk('nosnippet',page.nosnippet?'Yes':'No',page.nosnippet?'t-warn':'t-ok')+
      chk('Content without JS',page.js_only?'Thin':(page.text_chars!=null?'OK':'n/a'),page.js_only?'t-warn':(page.text_chars!=null?'t-ok':'t-gray'))+
      chk('robots.txt',robotsState[0],robotsState[1])+
      chk('llms.txt (optional)',llmsState[0],llmsState[1])+
    '</ul></div>'+
    '<div class="panel"><h3>Share this report</h3><div class="share">Send it to your developer or client.<div class="row2"><input readonly id="sl" aria-label="Report link" value="'+esc(shareUrl)+'"><button id="cp">Copy</button></div></div></div>'+
   '</div></div></div>';
  return {meta,html,verdict:a.verdict||'unknown',title:v[2],summary:summary(r)};
}
