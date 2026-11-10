# 竞品：Auriti-Labs/geo-optimizer-skill（geoready.dev）v4.19.10，2026-11-10 实跑

本地 pip 安装，`geo audit --url https://www.<d> --format json`，沙箱出口 IP（cf-ray PDX）。每站约 4 秒。

| | toyota.com | shopify.com |
|---|---|---|
| 总分 | 53 Foundation | 59 Foundation |
| robots 分 | 11/14 | 11/14 |
| CDN 实测（6 个 UA，同一 IP） | GPTBot/OAI-SearchBot/PerplexityBot 403；Claude-SearchBot/Googlebot/Applebot 200（CloudFront） | 6/6 200（Cloudflare） |

要点：
- toyota robots.txt 允许 OAI-SearchBot，但 CDN 对其返回 403 = 静默拦截。它测到了 403，但 CDN 检查不计分，建议列表也没提，反而建议"在 robots.txt 放行 GPTBot/ClaudeBot/PerplexityBot"（训练爬虫，站方是有意屏蔽）。
- 它的 UA 探测只有 6 个，不含 ChatGPT-User / Claude-User / Perplexity-User 等用户触发代理，也不从官方 IP 段发。
- 与我们 11-03 toyota 结果一致：search 允许 2/3、served 1/3。
- 分数大头是 schema、品牌、Google 署名/日期等通用 SEO 项，两站差 6 分主要因为 shopify 有 llms.txt（+6）。
