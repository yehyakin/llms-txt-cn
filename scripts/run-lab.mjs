// 用我们自己的引擎跑一遍对照测试集，写 data/lab-results.json。用法：node scripts/run-lab.mjs [API 基址]
import { writeFileSync } from 'node:fs';
import { FIXTURES, LAB_SUFFIX } from '../worker/lab.js';
import { gradeReport, GRADE_VERSION } from '../en/grade.js';
const API = process.argv[2] || 'https://cetxt-preview.kin3.workers.dev';
const out = { run_at: new Date().toISOString(), rules: GRADE_VERSION, api: API, results: [] };
for (const f of FIXTURES) {
  const domain = f.slug + LAB_SUFFIX;
  let r = null, err = null;
  for (let i = 0; i < 2 && !r; i++) {
    try { const res = await fetch(`${API}/api/check?domain=${domain}&access=1&fresh=1`, { headers: { 'user-agent': 'vaksel-lab-runner' } }); r = await res.json(); } catch (e) { err = String(e); }
  }
  const g = r ? gradeReport(r) : null;
  const got = g ? [g.access.grade, g.read.grade, g.cite.grade] : [null, null, null];
  const cn = g && g.cn;
  const cnGot = cn ? (cn.open === cn.total ? 'all_open' : cn.open === 0 ? 'all_blocked' : 'some_blocked') : null;
  const ok = got.every((x, i) => x === f.expect[i]) && (!f.cn || f.cn === cnGot);
  out.results.push({ slug: f.slug, domain, expect: f.expect, got, cn_expect: f.cn || null, cn_got: cnGot, ok, why: g && { access: g.access.why, read: g.read.why, cite: g.cite.why }, error: err });
  console.log((ok ? 'ok  ' : 'DIFF') + ' ' + f.slug.padEnd(22) + ' expect ' + f.expect.join('/') + '  got ' + got.join('/') + (f.cn ? '  cn ' + f.cn + '→' + cnGot : ''));
  await new Promise((s) => setTimeout(s, 3500));
}
writeFileSync(new URL('../data/lab-results.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.results.filter((x) => x.ok).length + '/' + out.results.length + ' match');
