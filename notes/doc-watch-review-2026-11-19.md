# 官方爬虫文档基线复核（2026-11-19）

按 `scripts/watch-docs.mjs --report` 抓取当前页面，与仓库中已有的八份 `data/doc-snapshots/*.txt` 旧快照逐词比较，再运行 `--record` 更新基线。旧快照为脚本去除 HTML、归一化空白后的文本，不是完整 HTML，也不能代表两次抓取之间的所有历史版本。

## 八个页面的变化

| 官方页面 | 旧快照 | 本次差异 |
| --- | --- | --- |
| [OpenAI Crawlers](https://platform.openai.com/docs/bots) | `1d5fe4133d.txt` | 站点导航和推荐内容变化：新增 Agent Access、Cloud providers、CSAM classifier、Data residency 等入口；GPT-6 改为 GPT-6.2；Commerce 导航改为 Partner Playbook，Codex Security 导航出现 Daybreak Defense Factory，并更新博客推荐。爬虫正文未变，未发现 GPTBot、OAI-SearchBot、ChatGPT-User、OAI-AdsBot 的 UA 或 robots.txt 指引变化。导航中的 Agent Access 不能据此认定为新增爬虫。 |
| [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) | `f94cadc0e4.txt` | 仅相对更新时间由 “Updated yesterday” 变为 “Updated over 2 weeks ago”。爬虫、robots.txt 和训练偏好信号正文未变；没有新的 ClaudeBot 优先级规则。 |
| [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) | `b405d5a097.txt` | 导航新增 “Allow Google-Agent traffic”。当前页面正文、已列爬虫 UA 和 robots.txt 指引未变；没有据此添加 Google-Agent 爬虫条目，也未推断链接目标页的规则。 |
| [Perplexity Crawlers](https://docs.perplexity.ai/guides/bots) | `d35929931a.txt` | 导航新增 FAQ、Monitor API、Context API 等入口；通用介绍新增 “Context: Markdown, HTML, links, query highlights, and metadata from known URLs.”，Orchestrator 去掉 “(private preview)”；WAF 标题前移除零宽字符。页面内嵌站点配置的部署 ID、静态资源、导航路由、元数据更新时间等也有变化。PerplexityBot / Perplexity-User 的 UA、robots.txt、IP 验证及 WAF 放行说明未发生规则变化。 |
| [Meta Web Crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers) | `9e410fa7e1.txt` | 仅导航新增 “Sharing Social Integrations”。爬虫正文、UA 和 robots.txt 指引未变。 |
| [DuckAssistBot](https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot) | `94fd26a22b.txt` | 仅导航新增 “Duck.ai Unsupported Regions”。DuckAssistBot 正文、UA 和 robots.txt 指引未变。 |
| [YouBot](https://docs.you.com/youbot) | `b8d74e98ef.txt` | 顶部推广由 Inference Router 改为 Extract API（含 PDF 准确率宣传）；导航重新分组，出现 Search Core、Extract API、Agentic Research 等，页尾介绍改为 Quickstart。YouBot 的 UA、Web Bot Auth、反向 DNS、IP、robots.txt 等正文未变；已有的根目录 `/llms.txt` 文档索引提示也未变。 |
| [Anthropic hosted browsers](https://support.claude.com/en/articles/18234133-how-do-anthropic-hosted-browsers-identify-themselves-when-they-browse-the-web-on-a-user-s-behalf) | `11f4300f15.txt` | 仅相对更新时间由 “Updated yesterday” 变为 “Updated over 2 weeks ago”。Claude-Agent 标识及 IP 验证说明未变。 |

## 变更日志处理

未发现符合 `notes/changelog-template.md` 的新增/移除爬虫、robots 范围、UA 或 IP 规则变化，因此不向 `data/crawler-changelog.json` 添加运营方事件。模版明确要求措辞、排版、导航、日期和示例变化只更新基线；本记录保留复核依据，避免把导航更新误报为爬虫政策变化。

## 覆盖限制

- 八个变化页面均成功抓取，且均有旧文本快照可供比较。
- Apple 页面本次返回 HTTP 429，脚本保留其旧基线；不能将其计为成功复核。
- Bing、头条 Bytespider、Petal 页面仍只有 JavaScript 空壳，脚本无法检查其正文，未更新其正文基线。
- 本次只更新文档基线及复核记录，不改抓取器、工作流、评级规则或生产部署配置。
