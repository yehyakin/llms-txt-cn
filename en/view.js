/* en/view.js — 报告渲染（浏览器与 Worker 共用，纯字符串，无 DOM 依赖） */
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cleanDomain(v){v=(v||'').trim().toLowerCase().replace(/^https?:\/\//,'').split(/[\/?#]/)[0].replace(/\.$/,'');return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v)?v:null}
export function summary(r){const a=(r&&r.access)||{};const bots=a.bots||[];const s=bots.filter(b=>b.category==='search'||b.category==='user');const reach=s.filter(b=>b.effective!=='blocked').length;const v=V[a.verdict]||V.unknown;return v[2]+(s.length?'. '+reach+' of '+s.length+' AI search crawlers can reach it':'')+'.'}
export function bindReport(root){root.querySelectorAll('tr.row').forEach(tr=>tr.onclick=()=>{const e=root.querySelector('tr[data-e="'+tr.dataset.i+'"]');if(e)e.hidden=!e.hidden});root.querySelectorAll('.copy').forEach(b=>b.onclick=()=>{navigator.clipboard.writeText(b.parentNode.textContent.replace(/^Copy/,''));b.textContent='Copied'});const cp=root.querySelector('#cp');if(cp){const sl=root.querySelector('#sl');if(sl&&!sl.value)sl.value=location.href;cp.onclick=()=>{navigator.clipboard.writeText(sl.value);cp.textContent='Copied'}}root.querySelectorAll('time[datetime]').forEach(t=>{const d=new Date(t.getAttribute('datetime'));if(!isNaN(d))t.textContent=d.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})})}
const PURPOSE={search:'AI search',user:'User-triggered',training:'Training',dataset:'Dataset',unknown:'Other'};
const V={
  open:['v-ok','✓','AI search crawlers can reach this site','robots.txt allows them and live requests got the same page a browser gets.'],
  warn:['v-warn','!','Reachable, with caveats','Nothing is clearly blocked, but some requests were challenged or got a thinner page. See the rows marked “check”.'],
  js_only:['v-warn','!','Reachable, but the page is nearly empty without JavaScript','Most AI crawlers don’t run JavaScript, so they see very little text.'],
  partly_blocked:['v-warn','!','Some AI search crawlers are blocked','robots.txt or the firewall shuts out part of the AI search crawlers listed below.'],
  silent_block:['v-bad','✕','Silent block: the firewall rejects AI search crawlers','robots.txt says they’re welcome, but live requests as these crawlers were rejected while a browser and Googlebot got through.'],
  all_blocked:['v-bad','✕','AI search crawlers are blocked','Every AI search crawler we tested was blocked by robots.txt or the firewall. This site is unlikely to be cited in AI answers.'],
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
function evidence(b,a){
  if(b.firewall==='untested')return 'The live test was inconclusive for this site, so only robots.txt was evaluated: <b>'+esc(b.robots)+'</b>.';
  const c=a.controls||{};
  if(b.firewall==='blocked')return 'Request as <b>'+esc(b.token)+'</b> got <code>'+esc(b.reason)+'</code>. Same URL as a browser: 200. As Googlebot: '+(c.googlebot_spoof_blocked?'blocked':'200')+'. As an unknown bot: '+(c.unknown_bot_blocked?'blocked':'200')+'. '+(b.confidence==='high'?'<b>High confidence</b>: the rule targets AI crawlers specifically.':'<b>Medium confidence</b>: unknown bots are blocked too, so this may be a general bot rule.');
  if(b.firewall==='unverified')return 'Got <code>'+esc(b.reason)+'</code>, but a spoofed Googlebot was blocked too. The site likely verifies crawler IPs, so the real crawler from its official IP range probably gets through. <b>Low confidence.</b>';
  if(b.firewall==='degraded')return 'Got 200, but far less readable text than a browser. The site may serve crawlers a stripped or interstitial page.';
  return 'Got the same page a browser gets. robots.txt: '+esc(b.robots)+'.';
}
function fixFor(a){
  const blocked=(a.bots||[]).filter(b=>b.firewall==='blocked');
  const robo=(a.bots||[]).filter(b=>b.robots==='blocked'&&(b.category==='search'||b.category==='user'));
  let h='';
  if(blocked.length){
    const names=blocked.filter(b=>b.category!=='training').map(b=>b.token);
    if(a.cdn==='Cloudflare')h+='<p><b>Cloudflare</b> is answering these requests. Check, in this order:</p><ol><li><b>Security → Settings → Block AI bots</b>: set it to block only on hostnames with ads, or off.</li><li><b>AI Crawl Control</b>: set the search crawlers you want to <i>Allow</i>.</li><li><b>Security rules</b>: look for custom WAF rules matching <code>cf.verified_bot_category</code> or user-agent strings.</li><li><b>Bot Fight Mode</b> can challenge crawlers too; turn it off or use Super Bot Fight Mode with verified bots allowed.</li></ol>';
    else if(a.cdn==='CloudFront')h+='<p><b>Amazon CloudFront</b> is answering these requests, most likely through AWS WAF. In your web ACL, check the <b>Bot Control</b> managed rule group for the AI and search-engine categories and override them to <i>Count</i> or <i>Allow</i> for the crawlers you want.</p>';
    else if(a.cdn==='Akamai')h+='<p><b>Akamai</b> is answering these requests. In Bot Manager, find the AI crawler categories and change their action from deny to allow or monitor.</p>';
    else h+='<p>Your server or security layer'+(a.cdn?' (<b>'+esc(a.cdn)+'</b>)':'')+' rejects these user agents. Look for user-agent block lists in your WAF, security plugin (Wordfence, Sucuri), or web-server config.</p>';
    if(names.length)h+='<p style="margin-top:8px">Crawlers to allow for AI search: <span class="mono">'+names.map(esc).join(', ')+'</span>.</p>';
  }
  if(robo.length){
    h+='<p style="margin-top:10px">robots.txt disallows <span class="mono">'+robo.map(b=>esc(b.token)).join(', ')+'</span>. To stay out of AI training but appear in AI search, use:</p><pre><button class="copy">Copy</button>User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nUser-agent: Claude-SearchBot\nAllow: /</pre>';
  }
  if(a.page&&a.page.js_only)h+='<p style="margin-top:10px">Only '+a.page.text_chars+' characters of text exist without JavaScript. Render key content on the server (SSR or static generation) so crawlers that don’t run JavaScript can read it.</p>';
  if(a.page&&a.page.noindex)h+='<p style="margin-top:10px">Remove <code>noindex</code> from the homepage’s meta robots tag or <code>X-Robots-Tag</code> header if you want it indexed.</p>';
  return h;
}
export function renderReport(r,opt){
  opt=opt||{};const when=opt.when||new Date().toISOString();const shareUrl=opt.url||'';
  const a=r.access||{verdict:'unknown'};
  const v=V[a.verdict]||V.unknown;
  const ra=(r.robots&&r.robots.analysis&&r.robots.analysis.access)||[];
  const untested=!(a.bots&&a.bots.length);
  const bots=!untested?a.bots:ra.filter(b=>['search','user','training'].includes(b.category)).map(b=>({token:b.token,vendor:b.vendor,category:b.category,robots:b.status,firewall:'untested',effective:b.status==='blocked'?'blocked':'ok'}));
  const search=bots.filter(b=>b.category==='search'||b.category==='user');
  const train=bots.filter(b=>b.category==='training');
  const reach=search.filter(b=>b.effective!=='blocked').length;
  const llm=r.llms||{};
  const robots=r.robots||{};
  const meta=(a.target?esc(a.target)+' · ':'')+'checked <time datetime="'+esc(when)+'">'+esc(when.slice(0,16).replace('T',' '))+' UTC</time>'+(a.cdn?' · served by '+esc(a.cdn):'');
  let rows='';
  const grp=(t,list)=>{if(!list.length)return;rows+='<tr class="grp"><td colspan="5">'+t+'</td></tr>';list.forEach((b,i)=>{rows+='<tr class="row" data-i="'+b.token+'"><td><div class="bot">'+esc(b.token)+'</div><div class="vd">'+esc(b.vendor||'')+'</div></td><td class="hide-s">'+PURPOSE[b.category]+'</td><td>'+robotsTag(b.robots)+'</td><td class="hide-s">'+liveTag(b)+'</td><td>'+resultTag(b)+'</td></tr><tr class="ev" data-e="'+b.token+'" hidden><td colspan="5">'+evidence(b,a)+'</td></tr>'})};
  grp('AI search & user-triggered',search);grp('AI training',train);
  const page=a.page||{};
  const fix=fixFor(a);
  const chk=(label,val,cls)=>'<li><span>'+label+'</span><span class="tag '+cls+'">'+val+'</span></li>';
  const robotsState=robots.http_status===404?['Not found (all allowed)','t-gray']:robots.http_status===200?['Found','t-ok']:['Unreachable','t-warn'];
  const llmsState=llm.verdict==='real'?['Valid','t-ok']:llm.verdict==='missing'?['None','t-gray']:llm.verdict==='html_spoof'?['Serves HTML','t-warn']:llm.verdict==='nonstandard'?['Non-standard','t-warn']:['Unknown','t-gray'];
  const html='<div class="fade">'+
   '<div class="verdict '+v[0]+'"><div class="vi">'+v[1]+'</div><div><h2>'+v[2]+'</h2><p>'+v[3]+'</p></div></div>'+
   '<div class="kpis"><div class="kpi"><div class="k">AI search crawlers '+(untested?'allowed by robots.txt':'reachable')+'</div><div class="v">'+(search.length?reach+'<small> / '+search.length+'</small>':'–')+'</div></div>'+
   '<div class="kpi"><div class="k">Silent firewall blocks</div><div class="v">'+(untested?'–':((a.counts&&a.counts.silent)||0))+'</div></div>'+
   '<div class="kpi"><div class="k">Training crawlers blocked</div><div class="v">'+train.filter(b=>b.effective==='blocked').length+'<small> / '+train.length+'</small></div></div>'+
   '<div class="kpi"><div class="k">Text without JavaScript</div><div class="v">'+(page.text_chars!=null?page.text_chars.toLocaleString():'–')+'<small> chars</small></div></div></div>'+
   '<div class="cols"><div>'+
    (bots.length?'<div class="panel"><h3>Crawler by crawler <span>Tap a row for evidence</span></h3><table><thead><tr><th>Crawler</th><th class="hide-s">Purpose</th><th>robots.txt</th><th class="hide-s">Live request</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'')+
    (fix?'<div class="panel fix"><h3>How to fix</h3><div class="body">'+fix+'</div></div>':'')+
    '<p class="note">How we test: we request your homepage from a data-center IP as a normal browser, as Googlebot, as an unknown bot, and as each AI crawler. Real crawlers come from their own IP ranges, so a site that verifies crawler IPs may treat them differently; the control groups are how we tell a targeted AI block (high confidence) from a verified-bot rule (low confidence).</p>'+
   '</div><div class="side">'+
    '<div class="panel"><h3>Page checks</h3><ul class="checks">'+
      chk('Page title',page.title?'Present':(page.text_chars==null?'n/a':'Missing'),page.title?'t-ok':(page.text_chars==null?'t-gray':'t-warn'))+
      chk('noindex',page.noindex?'Yes':'No',page.noindex?'t-bad':'t-ok')+
      chk('nosnippet',page.nosnippet?'Yes':'No',page.nosnippet?'t-warn':'t-ok')+
      chk('Content without JS',page.js_only?'Thin':(page.text_chars!=null?'OK':'n/a'),page.js_only?'t-warn':(page.text_chars!=null?'t-ok':'t-gray'))+
      chk('robots.txt',robotsState[0],robotsState[1])+
      chk('llms.txt (optional)',llmsState[0],llmsState[1])+
    '</ul></div>'+
    '<div class="panel"><h3>Share this report</h3><div class="share">Send it to your developer or client.<div class="row2"><input readonly id="sl" value="'+esc(shareUrl)+'"><button id="cp">Copy</button></div></div></div>'+
   '</div></div></div>';
  return {meta,html,verdict:a.verdict||'unknown',title:v[2],summary:summary(r)};
}
