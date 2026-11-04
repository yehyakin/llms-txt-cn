# 同类体检站调研（2026-11-02）

## 评分方式
- 绝大多数：0–100 总分 + A–F（Sona、whataisee、Layer3Labs、AnyPost、AI Search Checker、CiteRank、GeoPageScan、Crawl Census、AIOScan、GeoReady）。分类权重公开，例如 whataisee 进 30/内容 25/结构 20/含义 15/信号 10；Crawl Census Reach 40/Readability 25/Structure 20/Attribution 15。
- Layer3Labs：noindex 封顶 20 分（类似 SSL Labs 的封顶规则）。
- GeoReady：公开且带版本号的评分表（rubric v2），保证不同时间的分数可比。
- Cloudflare isitagentready：0–100 + Level 1–5，偏 agent 标准（MCP、OAuth、x402 等）。
- HubSpot AI Search Grader：品牌在 AI 回答里的表现（情感 40、存在质量 20、认知 20、声量 10、竞争 10），要留邮箱看完整报告。
- Uncanny Labs：刻意不打总分，“先看关卡（能不能进、HTML 里有没有正文、是否对题），再按证据强度分级给修复”。Lighthouse Agentic Browsing 也只给“通过 N 项”。
- 老牌先例：SSL Labs（A+–F，严重问题直接封顶）、Mozilla Observatory（100 起扣分，A+ 靠加分）。

## Uncanny Labs 10-20 测评（13 个免费工具，33 个单变量页面）
- 防火墙对 AI UA 返回 403：11 个查访问的工具里 9 个没发现。
- 屏蔽 Googlebot：9/11 没反应；屏蔽 OAI-SearchBot：7/11 没反应。
- isitagentready 在 Disallow: / 全站禁止时仍给 Level 1。Scovant 全禁仍 A 95，却因只禁 GPTBot 降到 B。
- 4 个工具给返回 HTML 的 llms.txt 加分；7 个给与页面不符的 FAQ 标记加分。
- 同一页面在不同工具得分 39–100。

## 和我们最像的
- Crawl Census（crawlcensus.com）：约 3 万域名、报告公开可引用、策略变化日志 + RSS、周报、排名、API（CC BY 4.0）、MCP、GitHub Action（分数低于阈值让构建失败）、按 UA 实测。**基本就是我们护城河②的形态**。
- suganthan.com AI Crawler Access Checker：也用伪装 Googlebot 做对照组。
- Uncanny Labs：防火墙实测 + 问 ChatGPT/Perplexity 10 个买家问题 + Google AI 概览来源，咨询变现。

## 对 VAKSEL 的启示（建议）
1. 保留三层 S/A/B/C，不做总分；评分规则写成带版本号的公开页面。
2. 我们已有的关卡逻辑（全禁/静默拦截/noindex 直接 C，训练爬虫不扣分，llms.txt 不计分，JSON-LD 解析失败封顶）正好覆盖 Uncanny 指出的坑，可以作为卖点。
3. 补：FAQ 结构化数据与页面不符要警告；robots.txt 5xx 视为全禁。
4. 做自己的对照测评（仿 Uncanny 的单变量页面），中英文各一篇，用作 PR。
5. 护城河②要与 Crawl Census 拉开：中文与亚洲爬虫（Bytespider、PetalBot、百度、360、搜狗、豆包、元宝）、国内 CDN（阿里云、腾讯云 EdgeOne、宝塔）、多地区探测、真实日志核验。
6. 可借鉴：GitHub Action / MCP / 公开 API 降低接入门槛。
