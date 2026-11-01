/* worker/og.js — 分享图（1200×630 PNG），workers-og = satori + resvg wasm。
 * 只被 index.js 动态 import，node 单测不会加载它。 */
import { ImageResponse } from 'workers-og';
import f700 from './fonts/inter-700.ttf';
import f500 from './fonts/inter-500.ttf';
import logo from '../en/brand/vaksel-horizontal-reverse.svg';

const BG = {
  ok: 'linear-gradient(120deg,#0b3d24,#1f9d55)',
  warn: 'linear-gradient(120deg,#5a3500,#c27c0e)',
  bad: 'linear-gradient(120deg,#3a0010,#d70015 55%,#bf5af2)',
  gray: 'linear-gradient(120deg,#2c2c2e,#636366)'
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOGO = 'data:image/svg+xml;base64,' + btoa(logo);
const FONTS = [{ name: 'Inter', data: f700, weight: 700, style: 'normal' }, { name: 'Inter', data: f500, weight: 500, style: 'normal' }];
const shell = (inner, right) => `<div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:64px 72px;background:#11142A;color:#fff;font-family:Inter">
  <div style="display:flex;align-items:center;justify-content:space-between"><img src="${LOGO}" width="212" height="40"/><div style="display:flex;font-size:24px;color:#9aa0b4;font-weight:500">${right}</div></div>${inner}</div>`;

export async function reportImage(d) {
  const dom = esc(d.domain);
  const size = d.domain.length > 26 ? 52 : d.domain.length > 18 ? 66 : 84;
  const stat = d.total
    ? `<div style="display:flex;align-items:flex-end;margin-top:auto;font-size:30px;color:#c7cbe0;font-weight:500"><span style="font-size:64px;font-weight:700;color:#fff;margin-right:16px;line-height:1">${d.reach} / ${d.total}</span><span style="display:flex;padding-bottom:6px">AI search crawlers ${d.live ? 'can reach it' : 'allowed by robots.txt'}</span></div>`
    : '<div style="display:flex;margin-top:auto"></div>';
  const html = shell(`
  <div style="display:flex;font-size:${size}px;font-weight:700;letter-spacing:-2px;margin-top:64px">${dom}</div>
  <div style="display:flex;margin-top:22px;padding:14px 26px;border-radius:18px;background-image:${BG[d.tone] || BG.gray};font-size:32px;font-weight:700;align-self:flex-start;max-width:1056px">${esc(d.title)}</div>
  ${stat}
  <div style="display:flex;justify-content:flex-end;margin-top:-34px;font-size:22px;color:#7d8299;font-weight:500">vaksel.com</div>`, 'AI crawler access report');
  return new ImageResponse(html, { width: 1200, height: 630, fonts: FONTS });
}

export async function siteImage() {
  const html = shell(`
  <div style="display:flex;flex-direction:column;font-size:76px;font-weight:700;letter-spacing:-2.5px;line-height:1.05;margin-top:70px"><span>Can AI search actually</span><span style="background-image:linear-gradient(95deg,#3aa0ff,#ba62fc 45%,#f2416b 75%,#ff7a33);background-clip:text;color:transparent">reach your site?</span></div>
  <div style="display:flex;margin-top:auto;font-size:28px;color:#c7cbe0;font-weight:500">Free check · robots.txt · firewall &amp; CDN · page readability</div>`, 'vaksel.com');
  return new ImageResponse(html, { width: 1200, height: 630, fonts: FONTS });
}
