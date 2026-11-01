/* worker/mail.js — 早鸟确认邮件（HTML + 纯文本）。表格布局 + 内联样式，兼容 Gmail / Outlook / Apple Mail。 */
const SITE = 'https://vaksel.com';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAN = { pro: ['Pro', 'up to 10 sites', '$19/month'], agency: ['Agency', 'up to 50 client sites', '$79/month'] };

export function confirmEmail(plan, site) {
  const [name, sites, price] = PLAN[plan] || PLAN.pro;
  const subject = 'You’re on the VAKSEL early-access list';
  const checkUrl = site ? `${SITE}/report/${site}` : `${SITE}/`;
  const text = [
    `You're on the list for VAKSEL ${name} (${sites}).`,
    '',
    "What happens next:",
    '1. We email you once when your monitoring account is ready.',
    '2. You pay nothing until then. Joining commits you to nothing.',
    `3. Your founding price (${price}) stays for as long as you remain subscribed.`,
    '',
    site ? `Meanwhile, here is today's free check for ${site}: ${checkUrl}` : `Meanwhile, free checks are at ${checkUrl}`,
    '',
    `To be removed from the list, use ${SITE}/contact/ (replies to this address are not read).`,
    '',
    'VAKSEL · Can AI search actually reach your site?'
  ].join('\n');
  const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";
  const step = (n, t) => `<tr><td valign="top" style="padding:0 12px 12px 0;width:28px"><div style="width:24px;height:24px;border-radius:12px;background:#0C63F1;color:#fff;font:600 13px/24px ${F};text-align:center">${n}</div></td><td style="padding:2px 0 12px;font:15px/1.55 ${F};color:#333336">${t}</td></tr>`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">We’ll email you once when your monitoring account is ready. Nothing to pay until then.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px"><a href="${SITE}/"><img src="${SITE}/brand/email-lockup.png" width="164" height="31" alt="VAKSEL" style="display:block;border:0"></a></td></tr>
<tr><td style="background:#ffffff;border-radius:18px;padding:32px 30px">
  <div style="font:600 12px/1 ${F};color:#0C63F1;letter-spacing:.04em;text-transform:uppercase">Early access · ${esc(name)}</div>
  <h1 style="margin:12px 0 10px;font:700 26px/1.2 ${F};color:#080B14;letter-spacing:-.5px">You’re on the list.</h1>
  <p style="margin:0 0 22px;font:16px/1.55 ${F};color:#333336">Thanks for joining VAKSEL ${esc(name)} (${esc(sites)}). Monitoring re-tests your sites every day and emails you when an AI crawler gets cut off.</p>
  <table role="presentation" cellpadding="0" cellspacing="0">${step(1, 'We email you <b>once</b> when your monitoring account is ready.')}${step(2, 'You pay nothing until then. Joining commits you to nothing.')}${step(3, `Your founding price, <b>${esc(price)}</b>, stays for as long as you remain subscribed.`)}</table>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td style="border-radius:10px;background:#080B14"><a href="${checkUrl}" style="display:inline-block;padding:12px 20px;font:600 15px/1 ${F};color:#ffffff;text-decoration:none">${site ? 'See today’s check for ' + esc(site) : 'Run a free check'}</a></td></tr></table>
</td></tr>
<tr><td style="padding:18px 6px 0;font:12px/1.6 ${F};color:#6e6e73">You’re getting this because this address joined the VAKSEL early-access list. To be removed, use the <a href="${SITE}/contact/" style="color:#6e6e73">contact form</a>; replies to this address are not read.<br><a href="${SITE}/privacy/" style="color:#6e6e73">Privacy</a> · <a href="${SITE}/" style="color:#6e6e73">vaksel.com</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
