#!/usr/bin/env python3
"""Render the home-page report card art (en/img/report-cover.webp, report-p2.webp)
from data/demo-toyota.json. Needs playwright + chromium. Run: python3 scripts/report-art/render.py"""
import json, os, asyncio, io, base64
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(os.path.join(ROOT, "data", "demo-toyota.json")))
bots = [b for b in d["access"]["bots"] if not b["region"]]
logo = open(os.path.join(ROOT, "en/brand/vaksel-horizontal-primary.svg")).read()
NAMES = {"search": "AI search", "user": "user-triggered", "training": "training"}
def panel():
    c = d["access"]["controls"]
    rows = "".join(
        f"<tr><td>{b['token']}</td><td class='r'>{'allows' if b['robots'] != 'blocked' else 'disallows'}</td>"
        f"<td class='s {'ok' if b['status'] == 200 else 'no'}'>{b['status']}</td></tr>" for b in bots)
    ctrl = [("Browser", True), ("Googlebot", not c["googlebot_spoof_blocked"]), ("Unknown bot", not c["unknown_bot_blocked"])]
    chips = "".join(f"<span class='{'ok' if v else 'no'}'><i></i>{n}</span>" for n, v in ctrl)
    return f"<div class='pn'><p class='ph mono'><span>AGENT</span><span>ROBOTS.TXT</span><span>HTTP</span></p><table>{rows}</table><p class='cg mono'>CONTROLS</p><div class='chips'>{chips}</div></div>"
CSS = """*{box-sizing:border-box;margin:0;padding:0}
body{background:#fbfbf9;color:#171614;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:'JetBrains Mono',monospace}.serif{font-family:'C059',serif}
.g{color:#1f8a4c}.mut{color:#6f6b64}
.top{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:22px;border-bottom:1px solid #d9d7d1}
.top svg{height:22px;width:auto}
.top .mono{font-size:12px;letter-spacing:.06em}
"""
COVER = f"""<html><head><style>{CSS}
body{{width:724px;height:543px;padding:46px 60px 40px}}
.mid{{display:flex;align-items:center;gap:28px;height:300px}}
.mid .l{{flex:1}}
h1{{font-weight:400;font-size:30px;line-height:1.08;letter-spacing:.005em;text-transform:uppercase}}
.site{{font-size:13px;letter-spacing:.08em;margin:14px 0 22px}}
.by{{font-style:italic;font-size:12.5px;line-height:1.75;font-family:'Inter'}}
.pn{{width:300px;border:1px solid #d9d7d1;background:#fff;padding:12px 14px 12px;font-size:11px}}
.ph{{display:grid;grid-template-columns:1fr 70px 34px;font-size:8.5px;letter-spacing:.1em;color:#8a867e;padding-bottom:6px;border-bottom:1px solid #e4e2dc}}.ph span:last-child{{text-align:right}}
.pn table{{width:100%;border-collapse:collapse}}.pn td{{padding:4.6px 0;border-bottom:1px solid #f0eee9;font-family:'JetBrains Mono';font-size:10.5px}}
.pn td.r{{width:70px;color:#8a867e;font-size:9.5px}}.pn td.s{{width:34px;text-align:right;font-weight:700}}
.ok{{color:#1f8a4c}}.no{{color:#b23b2e}}
.cg{{font-size:8.5px;letter-spacing:.1em;color:#8a867e;margin:9px 0 6px}}
.chips{{display:flex;gap:6px}}.chips span{{font-size:9.5px;border:1px solid #e4e2dc;border-radius:99px;padding:3px 7px;color:#3d3a35;display:flex;align-items:center;gap:4px}}
.chips i{{width:5px;height:5px;border-radius:50%;background:currentColor}}.chips span.ok i{{background:#1f8a4c}}.chips span.no i{{background:#b23b2e}}
.c{{font-size:11px;letter-spacing:.12em;margin:4px 0 12px}}
.toc{{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #d9d7d1;padding-top:14px}}
.toc div{{padding:0 0 0 16px;border-left:1px solid #d9d7d1;font-size:13px}}.toc div:first-child{{border:0;padding-left:0}}
.toc b{{display:block;font-family:'JetBrains Mono';font-weight:400;font-size:21px;color:#1f8a4c;margin-bottom:6px}}
</style></head><body>
<div class="top">{logo}<span class="mono">ACCESS REPORT&nbsp;&nbsp;&nbsp;<span class="g">{d["checked_on"][5:7]} / {d["checked_on"][:4]}</span></span></div>
<div class="mid"><div class="l"><h1 class="serif">AI crawler<br>access report</h1><p class="site mono mut">{d['domain'].upper()}</p><p class="by">Prepared by VAKSEL<br>November 3, 2026</p></div>{panel()}</div>
<p class="c mono g">CONTENTS</p>
<div class="toc"><div><b>01</b>Verdict</div><div><b>02</b>Crawler results</div><div><b>03</b>Blocking layer</div><div><b>04</b>Fix guide</div></div>
</body></html>"""
rows = "".join(f"<tr><td><b>{b['token']}</b><span>{b['vendor']} · {b['category']}</span></td><td>{'allows' if b['robots']!='blocked' else 'disallows'}</td><td class='{'ok' if b['status']==200 else 'no'}'>{b['status']}</td><td>{'silent block' if b['silent'] else ('open' if b['status']==200 else 'as declared')}</td></tr>" for b in bots)
silent = sum(b["silent"] for b in bots)
P2 = f"""<html><head><style>{CSS}
body{{width:724px;padding:46px 60px 60px}}
.sec{{padding:30px 0 26px;border-bottom:1px solid #e4e2dc}}
.n{{font-size:13px;color:#1f8a4c;letter-spacing:.06em}}
h2{{font-weight:400;font-size:26px;text-transform:uppercase;margin:8px 0 14px}}
p{{font-size:13.5px;line-height:1.65;color:#3d3a35}}
.v{{display:flex;gap:28px;margin-top:18px}}.v div{{flex:1;border-top:2px solid #171614;padding-top:10px}}
.v b{{display:block;font-size:30px;font-weight:600;letter-spacing:-.02em}}.v span{{font-size:11.5px;color:#6f6b64}}
table{{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}}
th{{text-align:left;font-weight:400;font-family:'JetBrains Mono';font-size:10.5px;letter-spacing:.08em;color:#8a867e;padding:8px 0;border-bottom:1px solid #d9d7d1}}
td{{padding:10px 0;border-bottom:1px solid #eceae5;vertical-align:top}}
td span{{display:block;color:#8a867e;font-size:11px;margin-top:2px}}
td.ok{{color:#1f8a4c;font-family:'JetBrains Mono'}}td.no{{color:#b23b2e;font-family:'JetBrains Mono'}}
.fix{{font-family:'JetBrains Mono';font-size:12px;background:#f1f0ec;padding:16px 18px;line-height:1.9;margin-top:14px}}
</style></head><body>
<div class="top">{logo}<span class="mono">{d['domain'].upper()}&nbsp;&nbsp;&nbsp;<span class="g">{d["checked_on"][5:7]} / {d["checked_on"][:4]}</span></span></div>
<div class="sec"><p class="n mono">01 · VERDICT</p><h2 class="serif">Silent block</h2>
<p>robots.txt lets OAI-SearchBot and the user-triggered agents in. CloudFront answers them with 403. A browser, Googlebot and an unknown bot all get the page, so this is aimed at AI crawlers, not at all automated traffic.</p>
<div class="v"><div><b>{silent}</b><span>silent blocks</span></div><div><b>{sum(b['status']==200 for b in bots)} of {len(bots)}</b><span>AI agents served</span></div><div><b>3 of 3</b><span>control groups not blocked</span></div></div></div>
<div class="sec"><p class="n mono">02 · CRAWLER RESULTS</p><h2 class="serif">What each agent got</h2>
<table><tr><th>AGENT</th><th>ROBOTS.TXT</th><th>STATUS</th><th>RESULT</th></tr>{rows}</table></div>
<div class="sec"><p class="n mono">03 · BLOCKING LAYER</p><h2 class="serif">CloudFront</h2><p>The 403 comes from the CDN edge before the request reaches the origin. The robots.txt file is not the cause.</p></div>
<div class="sec" style="border:0"><p class="n mono">04 · FIX GUIDE</p><h2 class="serif">AWS WAF Bot Control</h2><p>In the Bot Control rule group, override the AI category for the agents you want in search results.</p>
<div class="fix">OAI-SearchBot&nbsp;&nbsp;&nbsp;Block → Allow<br>ChatGPT-User&nbsp;&nbsp;&nbsp;&nbsp;Block → Allow<br>Perplexity-User&nbsp;Block → Allow<br>Claude-User&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Block → Allow<br>GPTBot&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;keep</div></div>
</body></html>"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox", "--disable-gpu"])
        for name, html, full in (("report-cover", COVER, False), ("report-p2", P2, True)):
            c = await b.new_context(viewport={"width": 724, "height": 543}, device_scale_factor=2)
            pg = await c.new_page(); await pg.set_content(html); await pg.wait_for_timeout(300)
            png = await pg.screenshot(full_page=full); await c.close()
            im = Image.open(io.BytesIO(png)).convert("RGB")
            out = os.path.join(ROOT, "en/img", name + ".webp"); im.save(out, "WEBP", quality=88, method=6)
            im.save(f"/workspace/work/{name}.png"); print(name, im.size, os.path.getsize(out)//1024, "KB")
        await b.close()
asyncio.run(main())
