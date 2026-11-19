# atypica.ai 评估区与报告卡拆解（2026-11-04）

## 评估三卡
- 卡框：aspect 16/10，1px border，bg muted/30，overflow hidden；图 object-contain，p-3（12px）。可点击放大。三列 gap 24px。
- 图本身是 2400px 宽位图（matplotlib 风格，DejaVu Sans 类字体），不是页内 SVG。缩到约 360px 显示，字小但锐利，读作“真实研究图”。
- 每张图结构：粗体标题 + 灰色一句话说明 + 图例 + 主体 + 底部灰色脚注（方法/口径）。
- 配色：底 #f7f7f5；暖灰三阶 #c4c2bb / #a19e96 / #77736b；主色深绿 #1e6b52；强调近黑 #171614。
- 点图：行标签右对齐（粗体名称 + 灰色“描述 · n=”），粗灰连线 + 大绿点，绿点旁粗体百分比 + 灰色差值（+13.4 pts）。行距很大，左右留白约 6%。
- 柱图：柱子宽、柱内白色粗体数值；对手灰、自家近黑；有一条虚线标注倍数（2.2 × best general agent）；x 轴标签带圆点图标 + 灰色副标。
- 树图：每个框三层文字（小号大写 eyebrow“SUITE/TASK SET” + 粗体名 + 灰色指标），细灰直角连线，框间距大，底部一句口径说明。
- 页面标题：EuclidCircularA medium，tracking-tight，行高 1.1，最大 36px；kicker 14px 大写 tracking .15em 灰。

## 报告卡
- 外层 perspective 1400px；背后一块 80%×70% 的 black/20 blur-3xl 阴影；卡 max-w 560px，aspect 4/3，border + shadow-2xl，rotateY(-8deg) rotateZ(2.2deg)，hover 归零。
- 卡内是可滚动区域：第一屏是报告封面图（1448×1086，透视和纸张阴影已经烘焙在图里），往下滚是一张 811×1940 的“Research recap / findings”长图。
- 封面：纯白纸，logo 左上，右上“DECISION BRIEF 07 / 2026”（绿色日期），衬线大写标题三行，斜体 Prepared by + 日期，右侧真实产品照，底部 CONTENTS 01–04 绿色等宽编号 + 竖分隔线。

## 我们 v4.1 的差距
1. 图是页内 SVG、按 400 宽画，字号层级少、留白小，看起来像网页控件，不像研究图。
2. 缺图例/差值/脚注这类“研究感”元素；数据点少（4 行、4 柱）显得空。
3. 卡框做了深色厚边 + 角标，atypica 是浅底细边、图几乎铺满。
4. 报告卡是 CSS 拼的纸，产品图是生成的 webp 抠图，没有真实纸张光影；也没有可滚动的第二页。
