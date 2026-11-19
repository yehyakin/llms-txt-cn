# llms-txt-cn（cetxt）

面向中文站长的 **AI 爬虫与训练规则检测**：输入域名，一次看清 AI 能不能**读**（robots.txt 访问规则）、能不能**训**（AI 训练偏好）、能不能**找到**你（llms.txt）。

> `rebuild-worker` 分支：后端迁到 Cloudflare Worker，新增 robots.txt 解析（RFC 9309）、AI 爬虫清单、`__usage_ai-training` 训练偏好与冲突分析。说明见下方「Worker 版」。

`llms.txt`（[llmstxt.org](https://llmstxt.org) 规范）是放在网站根目录的 Markdown 文件，帮助 AI 模型快速理解网站结构，是 AI 搜索时代（GEO）的基础卫生项。

**B站拿了100分，百度、淘宝、京东呢？** 我们测了 1000 个大型中文站，只有 30 个放了真正的文件——完整数据与名单：https://cetxt.com/survey/

线上地址：https://cetxt.com

## 功能

- **体检（首页）**：输入域名，Worker 同时抓 `/robots.txt` 与 `/llms.txt`，报告分三块，不出综合总分：
  - **可访问**：按 RFC 9309 判定 22 个 AI / 搜索爬虫能否访问，每条结论带 robots.txt 行号与官方文档链接
  - **可训练**：各厂商训练 token（GPTBot、ClaudeBot、Google-Extended…）+ IETF 草案 `__usage_ai-training`，含冲突分析与中文修复建议
  - **可发现**：llms.txt 0–100 结构分（沿用原 verdict：真文件 / HTML 壳 / 无文件 / 未能判定）
- **robots 生成**：可视化选择允许 / 禁止哪些爬虫、路径例外、训练偏好；结果用同一引擎复查；也可粘贴现有 robots.txt 本地分析
- **旧版在线体检（llms.txt 部分）**：输入域名，服务端实时抓取 `/llms.txt` 并按规范打分（0–100 结构质量分），区分"无文件 / HTML 壳 / 未能判定"
- **生成器**：填写站点名、简介、分组链接 → 生成符合规范的 `llms.txt` → 实时预览、一键复制 / 下载 / 继续校验（含博客、企业官网、文档站模板）
- **校验器**：粘贴或上传已有的 `llms.txt`（支持 UTF-8 / GBK / Big5）→ 按规范做确定性检查 → 0–100 结构质量分 + 每条问题的中文修复建议
- **部署指南**：WordPress、Vercel、Nginx/Caddy 的上线步骤与复查清单
- **调查报告**：1000 大型站 + 100 独立站实测数据，可搜索筛选

生成与粘贴校验在浏览器本地完成，文件不上传；在线体检由服务端代为请求你提交的站点。

## 评分口径

四维加权：H1 标题 30 / 摘要 20 / H2 分组 30 / 链接质量 20；有错误时总分封顶 59。

评分是"结构质量分"，不是"AI 引用保证"。截至 2026 年，没有主流 LLM 厂商公开承诺系统性消费 `llms.txt`，请把它当作卫生项，而非排名手段。

## 现状调查（2026-10）

- **1000 个大型中文站**（公开排名近似样本）：仅 3.0% 在根目录有真正的 `llms.txt`；16.4% 返回 200 的 HTML 壳；39% 因 WAF/超时未能判定。有文件的平均 82.2 分，9 个满分（含 B站、Gitee、魔搭）
- **100 个中文独立站**：19% 有真正的 `llms.txt`，独立博客圈约 7%；14% 掉进 SPA 陷阱（`/llms.txt` 返回 200 的 HTML）

中文站长缺的不是意愿，是顺手的中文工具——这正是本项目存在的理由。

## Worker 版（rebuild-worker）

```
index.html  css/  js/        前端（无构建；原 82KB 单文件拆成 css/site.css、css/audit.css、js/app.js、js/audit-ui.js、js/robots-ui.js）
llms.js                      llms.txt 校验引擎（不变）
lib/robots.js                RFC 9309 解析/匹配（前后端共用，UMD）
lib/aiaudit.js               AI 爬虫访问 / 训练偏好 / 冲突分析 + robots.txt 生成器（前后端共用）
data/ai-crawlers.json        AI 爬虫清单：厂商、用途、是否遵守 robots、官方文档 URL、核对日期
worker/index.js, check.js    Worker：静态页 + /api/check（SSRF 防护、手动跳转、超时、体积上限、限频、短缓存）
scripts/build-worker.mjs     极轻构建：UMD 库包成 worker/_libs.js；--embed 时把静态文件内嵌进 worker/_assets.js
scripts/deploy_preview.py    直接调 Cloudflare API 部署 cetxt-preview（workers.dev，不加路由）
tests/                       node 测试（robots 解析与冲突、Worker 安全与语义）
backend/check.py             旧 Python 后端（线上仍在用，切换前保留）
```

- 测试：`npm test`（= `node test.js && node tests/robots.test.js && node tests/worker.test.mjs`）
- 本地 / wrangler：`npx wrangler dev`（wrangler.toml 用 Workers Static Assets、Rate Limiting、Analytics Engine 绑定）
- 预览部署：`npm run deploy:preview`

`/api/check?domain=` 响应：顶层保留旧字段（`domain / verdict / http_status / final_url / text / truncated / reason / code / elapsed_ms`，即 llms.txt 结果），新增 `llms`（同上）、`robots`（`state / http_status / final_url / text / truncated / bytes / analysis`）与 `data_version`。

隐私：不记录域名和 IP；仅在绑定了 Analytics Engine 时按「日期 + verdict」计数。结果在内存 / Cache API 里缓存 5 分钟。

## 使用（旧版）

纯静态页面 + 一个可选的 Python 标准库体检后端（`backend/`）。直接用浏览器打开 `index.html` 即可体验生成器与校验器；在线体检需要启动后端并配置反代（见 `backend/` 说明）。

## 开源协议

MIT

### 调查方法（2026-10-04）

- 样本：1000 个大型中文站（公开排名 TLD 过滤 + 人工补全，去重；"近似样本"而非官方榜单）+ 100 个真实活跃中文独立站（55 项目站 + 45 博客，29 死链已剔除）
- 方法：对每个域名根目录 GET `/llms.txt`（https 优先、失败回退 http，跟随跳转、8–10 秒超时、只取前 200KB，间隔 1.2–1.5 秒，普通浏览器 UA）；200 且内容为 Markdown 记为"有文件"，返回 HTML 记为 HTML 壳
- 判定：用本项目校验器同款四维规则打分（H1 30 / 摘要 20 / H2 30 / 链接 20）
- 局限：TLD 过滤会漏掉部分中文站；39% 大型站因 WAF/超时未能判定；只测根目录，子路径文件会被记为无，覆盖率可能轻微低估
