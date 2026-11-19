
## SEO 层（2026-11-02）
- 只搬规则不搬提示词：免费体检里全部是确定性检查，不调模型。依据 Google《AI features and your website》：AI 概览/AI Mode 没有额外要求，不需要 AI 专用文件或标记；页面需可收录、可显示摘要（nosnippet / max-snippet:0 判“问题”），结构化数据要与可见内容一致。
- 能不能读：title、description、noindex/nosnippet（meta + X-Robots-Tag）、canonical（多个=问题，跨域=待改）、不跑 JS 的正文（<200 问题，<600 待改，识别空 #root/#app/#__next）、h1、sitemap、站内链接（≥5）、图片 alt（≥80%）、hreflang（有才查）、viewport。
- 能不能被引用：JSON-LD 解析、Organization（名称须在页面可见）、网站名称、发布/更新日期、作者、问答式段落（推测）、main/article、og:title+og:image、llms.txt（推测；Google 说不需要）。
- 不做 GEO 总分。付费版候选：多页扫描、模型评内容可引用性、ChatGPT/Perplexity 实测引用、定期复测。
- 首页抓取 1.5MB 上限；relay 回落上限 512KB（HARD_MAX）。缓存 key：v3/、v4a/。

## 首页视觉（11-01 概念 D v3，从 project-doc 移来）
KiN 喜欢 apple.com/apple-card 风格（重质感、动效、交互、细节）。概念 D v3（design/d，preview /design/d/）：竖版钛金属文件卡、自动轮播四步（不钉住滚动）、评分环、robots 生成器、结果底部弹层；演示用 Safari 窗口（e4bf248）；工具区渐变 bento（bc876c5、31ca4df）；钛金属卡四色泛光（381adec）；评分/robots/数据三节圆角大卡（cb195c2）；底部 CTA 渐变大卡（ae4c0bf）；评分环 Apple 式编排（87e8d32，对比图 work/wheel-compare.jpg）。逐帧录制：playwright（PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright 装 chromium-headless-shell），proxy 读 HTTPS_PROXY 并拆出用户名密码，390×844 is_mobile 录视频，ffmpeg 抽帧，montage 拼图（无中文字体）。浏览器同一 session 会读旧缓存，QA 用新 session 或 ?v=。
