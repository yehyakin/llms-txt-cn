/* llms.js 测试：node test.js */
const { validateLLMS, generateLLMS, parseLLMS } = require('./llms.js');
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok  - ' + name); }
  catch (e) { fail++; console.log('FAIL- ' + name + ' :: ' + e.message); }
}
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' 期望 ' + JSON.stringify(b) + '，得到 ' + JSON.stringify(a)); }
function hasCode(r, code) { return r.issues.some(i => i.code === code); }
function sevCount(r, sev) { return r.issues.filter(i => i.sev === sev).length; }

const GOOD = `# 我的博客

> 一个写独立开发的中文博客

这里记录出海、独立开发和 AI 工具的实战。

## 文章

- [第一篇](https://example.com/p1): 关于独立开发
- [第二篇](https://example.com/p2): 关于 AI 工具

## 关于

- [关于我](https://example.com/about): 博主介绍
`;

t('标准文件：无 error，分数 90', () => {
  const r = validateLLMS(GOOD);
  eq(sevCount(r, 'error'), 0, 'error 数');
  eq(r.score, 90, '分数'); // H1 30 + 摘要 20 + H2 2个 20 + 链接 20
  eq(r.grade, '优秀');
});

t('缺 H1：E3 + 分数封顶 59', () => {
  const r = validateLLMS(`> 摘要\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'E3'), true, 'E3');
  eq(r.hasError, true);
  eq(r.score <= 59, true, '封顶');
  eq(r.grade, '不合规');
});

t('双 H1：E3', () => {
  const r = validateLLMS(`# A\n\n# B\n`);
  eq(hasCode(r, 'E3'), true);
});

t('setext H1 被识别', () => {
  const r = validateLLMS(`我的站\n===\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'E3'), false, '不应报缺 H1');
});

t('H1 前有内容：E4', () => {
  const r = validateLLMS(`hello\n\n# 站\n`);
  eq(hasCode(r, 'E4'), true);
});

t('缺摘要：只是 suggest（W1），不是 error', () => {
  const r = validateLLMS(`# 站\n\n## A\n\n- [x](https://a.com): 描述`);
  eq(hasCode(r, 'W1'), true);
  eq(r.issues.find(i => i.code === 'W1').sev, 'suggest', '级别');
  eq(sevCount(r, 'error'), 0);
});

t('相对链接：W3 警告', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](/about): 描述`);
  eq(hasCode(r, 'W3'), true);
  eq(r.dims.links < 20, true, '链接分被扣');
});

t('空链接名：E5', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [](https://a.com): 描述`);
  eq(hasCode(r, 'E5'), true);
});

t('URL 无法解析：E5', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](not a url): 描述`);
  eq(hasCode(r, 'E5'), true);
});

t('非 http 协议：E5', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](javascript:alert(1)): 描述`);
  eq(hasCode(r, 'E5'), true);
});

t('列表项无链接：E5b 警告', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- 只是文字`);
  eq(hasCode(r, 'E5b'), true);
  eq(r.issues.find(i => i.code === 'E5b').sev, 'warn');
});

t('链接在 H2 之前：W0', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n- [x](https://a.com): 描述\n\n## A\n\n- [y](https://b.com): 描述`);
  eq(hasCode(r, 'W0'), true);
});

t('空分组：W2；无分组：W2b 建议', () => {
  const r1 = validateLLMS(`# 站\n\n> 摘要\n\n## 空的\n\n## 有\n\n- [x](https://a.com): d`);
  eq(hasCode(r1, 'W2'), true);
  const r2 = validateLLMS(`# 站\n\n> 摘要\n`);
  eq(hasCode(r2, 'W2b'), true);
  eq(r2.issues.find(i => i.code === 'W2b').sev, 'suggest');
});

t('重复分组名：W4', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](https://a.com): d\n\n## A\n\n- [y](https://b.com): d`);
  eq(hasCode(r, 'W4'), true);
});

t('重复 URL：W8（尾斜杠归一）', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](https://a.com/p): d\n- [y](https://a.com/p/): d`);
  eq(hasCode(r, 'W8'), true);
});

t('无描述：W9 建议；冒号分隔：W9b', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](https://a.com)\n- [y](https://b.com) 描述没冒号`);
  eq(hasCode(r, 'W9'), true);
  eq(hasCode(r, 'W9b'), true);
});

t('URL 含括号能解析', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## A\n\n- [x](https://a.com/wiki/a_(b)): 描述`);
  eq(hasCode(r, 'E5'), false, '不应误报 E5');
  eq(sevCount(r, 'error'), 0);
});

t('自动链接 <https://> 不误报 HTML', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n详见 <https://a.com> 说明\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'E6b'), false, '不应误报 HTML');
});

t('HTML 标签：警告；script：错误', () => {
  const r1 = validateLLMS(`# 站\n\n> 摘要\n\n<div>hi</div>\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r1, 'E6b'), true);
  eq(r1.issues.find(i => i.code === 'E6b').sev, 'warn');
  const r2 = validateLLMS(`# 站\n\n> 摘要\n\n<script>alert(1)</script>\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r2, 'E6'), true);
  eq(r2.issues.find(i => i.code === 'E6').sev, 'error');
});

t('H1 超 100 字：W5 建议', () => {
  const r = validateLLMS(`# ${'站'.repeat(101)}\n\n> 摘要\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'W5'), true);
});

t('超 50KB：W6b；超 100KB：W6', () => {
  const big50 = `# 站\n\n> 摘要\n\n## A\n\n` + `- [x](https://a.com/${'p'.repeat(200)}): 描述\n`.repeat(300);
  const r1 = validateLLMS(big50);
  eq(hasCode(r1, 'W6b') || hasCode(r1, 'W6'), true, '体积提示');
  const big100 = big50.repeat(3);
  const r2 = validateLLMS(big100);
  eq(hasCode(r2, 'W6'), true, '超 100KB 警告');
});

t('连续空行：W7', () => {
  const r = validateLLMS(`# 站\n\n\n\n> 摘要\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'W7'), true);
});

t('Optional 分组：info 提示', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n## Optional\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'W10'), true);
  eq(r.issues.find(i => i.code === 'W10').sev, 'info');
});

t('摘要没紧跟 H1：W1b', () => {
  const r = validateLLMS(`# 站\n\n一些详情\n\n> 摘要\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'W1b'), true);
});

t('详情区三级标题：S1', () => {
  const r = validateLLMS(`# 站\n\n> 摘要\n\n### 小标题\n\n## A\n\n- [x](https://a.com): d`);
  eq(hasCode(r, 'S1'), true);
});

t('空文件：E3 + 0 分', () => {
  const r = validateLLMS(``);
  eq(hasCode(r, 'E3'), true);
  eq(r.score, 0);
});

t('生成器 round-trip：生成→校验 0 error', () => {
  const md = generateLLMS({
    siteName: '测试站', tagline: '一句话', details: '补充说明',
    sections: [
      { title: '产品', links: [{ name: 'A', url: 'https://t.com/a', desc: '好' }, { name: 'B', url: 'https://t.com/b', desc: '' }] },
      { title: '文档', links: [{ name: 'C', url: '/relative', desc: '相对' }] }
    ]
  });
  eq(md.startsWith('# 测试站\n'), true, 'H1');
  eq(md.includes('> 一句话'), true, '摘要');
  const r = validateLLMS(md);
  eq(sevCount(r, 'error'), 0, '无 error');
  eq(hasCode(r, 'W3'), true, '相对链接被检出');
  eq(hasCode(r, 'W9'), true, '无描述被检出');
});

t('中文内容正常计分', () => {
  const r = validateLLMS(`# 中文站\n\n> 中文摘要写清楚\n\n## 产品\n\n- [中文名](https://t.com/a): 中文描述\n\n## 文档\n\n- [文二](https://t.com/b): 描述二\n\n## 关于\n\n- [文三](https://t.com/c): 描述三`);
  eq(r.score, 100, '满分');
});

console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
