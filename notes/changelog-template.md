# 变更日志自动条目模版（KiN 2026-11-04 同意：符合模版的条目自动发布，不经审核）

每日定时任务“AI 爬虫文档变更 → 自动写日志”使用。输入：`node scripts/watch-docs.mjs --report /tmp/doc-changes.json` 的报告。

## 什么算一条（发布）
只在官方页面上能找到原句支持时才写，且必须属于以下五类之一：
1. new：新增爬虫 / UA token（report.new_ua_candidates，或 added_relevant 里出现新 token）
2. removed：某个 token 不再出现在官方页（report.lost 或 gone_ua_candidates）
3. robots：robots.txt 能控制的范围变了（例如某爬虫改为不遵守 / 开始遵守 robots.txt，或改由另一个 token 控制）
4. ua：UA 字符串（版本号、格式）变了
5. ip：IP 段公布地址或验证方式变了

## 什么不写（发草稿给 KiN 或忽略）
- 只改措辞、排版、导航、日期、示例 → 忽略，只 --record 更新基线
- 能看出有实质变化但对不上五类，或原句含义不确定 → 不发布，把原句和你的判断发给 KiN
- JS 渲染页（Bing、头条 Bytespider、Petal）脚本看不到 → 不处理

## 字段
```json
{ "date": "YYYY-MM-DD（北京时间当天）", "kind": "vendor", "type": "new|removed|robots|ua|ip",
  "tokens": ["官方写法的 token"], "source": "官方页面 URL（报告里的 url）",
  "quote": "官方原句，逐字复制，≤220 字符，英文页保持原文",
  "en": "按下方句式", "zh": "按下方句式" }
```
新条目插在 entries 数组最前面。

## 句式（只填事实，不加评价、建议、推测）
- new：EN “{Operator} added {token} to its crawler documentation. {一句话：官方写的用途}.” ZH “{运营方}在官方爬虫文档中新增 {token}。{官方写的用途}。”
- removed：EN “{Operator} no longer lists {token} on its crawler page.” ZH “{运营方}的爬虫文档不再列出 {token}。”
- robots：EN “{Operator} changed how robots.txt applies to {token}: {变化}.” ZH “{运营方}调整了 {token} 与 robots.txt 的关系：{变化}。”
- ua：EN “{Operator} updated the user-agent string for {token} to {新写法}.” ZH “{运营方}更新了 {token} 的 UA 字符串：{新写法}。”
- ip：EN “{Operator} changed how it publishes IP ranges for {token}: {变化}.” ZH “{运营方}调整了 {token} 的 IP 段公布方式：{变化}。”
运营方名：英文用 data 里 operator 的英文名（中国公司见 build-en.mjs 的 VENDOR_EN），中文用 data 里的 operator。

## 不做
- 不改 data/ai-crawlers.json、评级规则或爬虫页正文；新爬虫是否收录进目录由 KiN 决定（在汇报里提出）。
