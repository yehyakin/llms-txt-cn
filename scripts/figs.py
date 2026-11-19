#!/usr/bin/env python3
"""Evaluation figures for the home page (en/img/fig-*.webp).

Rendered at 2400 px wide, research-figure style, from repo data only:
  data/lab-results.json   -> fig-lab.webp
  data/demo-toyota.json   -> fig-toyota.webp
  sample funnel (research/ survey, Nov 2026) -> fig-sample.webp
Run: python3 scripts/figs.py   (needs matplotlib + pillow)
"""
import json, os, io, re, datetime
_d = lambda d: datetime.date.fromisoformat(d["checked_on"]).strftime("%b %-d, %Y")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "en", "img")
BG = "#f7f7f5"; INK = "#171614"; MUT = "#6f6b64"; FAINT = "#a8a59e"
G1 = "#c4c2bb"; G2 = "#a19e96"; G3 = "#77736b"; GRID = "#e6e4df"
GREEN = "#1e6b52"; GREENBG = "#e3eee9"
W = 2400
plt.rcParams.update({"font.family": "Inter", "text.color": INK})


def canvas(h):
    fig = plt.figure(figsize=(W / 72, h / 72), dpi=72, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(h, 0); ax.axis("off")
    ax.set_facecolor(BG)
    return fig, ax


def save(fig, name):
    buf = io.BytesIO(); fig.savefig(buf, format="png", facecolor=BG, dpi=72); plt.close(fig)
    im = Image.open(buf).convert("RGB")
    im.save(os.path.join(OUT, name), "WEBP", quality=88, method=6)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name)) // 1024, "KB")


def T(ax, x, y, s, size=22, color=INK, weight="normal", ha="left", va="baseline", **k):
    ax.text(x, y, s, fontsize=size, color=color, fontweight=weight, ha=ha, va=va, **k)


# ---------------------------------------------------------------- lab
def fig_lab():
    lab = json.load(open(os.path.join(ROOT, "data", "lab-results.json")))
    R = lab["results"]
    # robots-only reading: verdict a robots.txt-only checker would reach, by rule mapping
    wrong = {"robots-503", "fw-ai-403", "fw-verify-bots", "fw-unknown-bots", "fw-ai-challenge",
             "fw-ai-thin", "meta-noindex", "header-noindex"}
    cats = [
        ("All lab sites", "every configuration below", lambda s: True, True),
        ("robots.txt rules", "disallow all · per agent · 404 · 503", lambda s: s.startswith("robots-") or s == "baseline", False),
        ("Firewall and CDN", "403 · challenge · bot verification · thin page", lambda s: s.startswith("fw-"), False),
        ("Page directives", "meta noindex · X-Robots-Tag · nosnippet", lambda s: any(k in s for k in ("noindex", "nosnippet")), False),
        ("Rendering", "JS-only page · llms.txt served as HTML", lambda s: s in ("js-only", "llms-html"), False),
        ("Markup", "FAQ mismatch · broken JSON-LD · canonical", lambda s: s in ("faq-mismatch", "jsonld-broken", "canonical-other-host"), False),
    ]
    h = 1300
    fig, ax = canvas(h)
    T(ax, 140, 122, "Access verdict accuracy", 40, weight="bold")
    T(ax, 140, 172, f"{len(R)} lab sites we configured ourselves, each with a known correct verdict. Score = share of sites where the verdict matches.", 23, MUT)
    lx = 140
    for lab_, c in (("robots.txt only", G2), ("VAKSEL (live requests)", GREEN)):
        ax.add_patch(plt.Circle((lx + 10, 234), 10, color=c))
        T(ax, lx + 30, 242, lab_, 22, INK if c == GREEN else MUT, weight="bold" if c == GREEN else "normal")
        lx += 300
    X0, X1 = 760, 2060
    x = lambda v: X0 + (X1 - X0) * v / 100
    top, step = 320, 140
    for t in range(0, 101, 20):
        ax.plot([x(t), x(t)], [top - 50, top + step * (len(cats) - 1) + 50], color=GRID, lw=1.5, zorder=0)
        T(ax, x(t), top + step * (len(cats) - 1) + 104, f"{t}%", 21, MUT, ha="center")
    for i, (name, desc, f, bold) in enumerate(cats):
        rs = [r for r in R if f(r["slug"])]
        n = len(rs)
        v = round(100 * sum(r["ok"] for r in rs) / n)
        ro = round(100 * sum(r["slug"] not in wrong for r in rs) / n)
        y = top + i * step
        T(ax, 660, y - 2, name, 27, GREEN if bold else INK, weight="bold", ha="right")
        T(ax, 660, y + 34, f"{desc} · n={n}", 19, MUT, ha="right")
        ax.plot([x(ro), x(v)], [y, y], color="#e3e1db", lw=11, solid_capstyle="round", zorder=1)
        ax.add_patch(plt.Circle((x(ro), y), 12, color=G2, zorder=2))
        ax.add_patch(plt.Circle((x(v), y), 17, color=GREEN, zorder=3))
        T(ax, x(v) + 36, y + 9, f"{v}%", 27, GREEN, weight="bold")
        T(ax, x(v) + 36, y + 42, f"+{v - ro} pts" if v > ro else "same", 19, MUT)
        if ro < v:
            T(ax, x(ro), y - 26, f"{ro}%", 19, G3, ha="center")
    T(ax, 140, h - 70, f"Run {re.search(r'\d{4}-\d{2}-\d{2}', lab['run_at']).group(0)}. The robots.txt-only column applies robots.txt rules alone to each site; it is derived from the same lab, not a run of another product.", 19, FAINT)
    save(fig, "fig-lab.webp")


# ---------------------------------------------------------------- toyota
def fig_toyota():
    d = json.load(open(os.path.join(ROOT, "data", "demo-toyota.json")))
    bots = [b for b in d["access"]["bots"] if not b["region"]]
    c = d["access"]["controls"]
    ctrl_ok = 1 + (not c["googlebot_spoof_blocked"]) + (not c["unknown_bot_blocked"])
    groups = [("Controls", "browser · Googlebot · unknown bot", None, ctrl_ok, 3)]
    for cat, nm, sub in (("search", "AI search", "OAI · Perplexity · Claude"), ("user", "User-triggered", "ChatGPT · Perplexity · Claude"), ("training", "Training", "GPTBot · ClaudeBot")):
        bs = [b for b in bots if b["category"] == cat]
        allow = sum(b["robots"] != "blocked" for b in bs)
        served = sum(b["status"] == 200 for b in bs)
        groups.append((nm, sub, allow, served, len(bs)))
    silent = sum(b["silent"] for b in bots)
    h = 1350
    fig, ax = canvas(h)
    T(ax, W / 2, 104, "Allowed vs. served: toyota.com", 40, weight="bold", ha="center")
    T(ax, W / 2, 152, "Same page, same IP, different user agent. robots.txt says who may crawl; the response says who got the page.", 23, MUT, ha="center")
    for i, (lab_, col) in enumerate((("robots.txt allows", G1), ("Actually served (HTTP 200)", INK))):
        x0 = 1450 + i * 330
        ax.add_patch(Rectangle((x0, 220), 44, 22, color=col))
        T(ax, x0 + 60, 240, lab_, 22, MUT)
    B, H = 1060, 720
    y = lambda v: B - H * v
    for t in (0, .25, .5, .75, 1):
        ax.plot([236, 2240], [y(t), y(t)], color=GRID, lw=1.5, zorder=0)
        T(ax, 208, y(t) + 8, f"{int(t * 100)}%", 21, MUT, ha="right")
    cw = 2004 / len(groups)
    bw = 170
    for i, (nm, sub, allow, served, n) in enumerate(groups):
        cx = 236 + cw * (i + .5)
        bars = [(None, served)] if allow is None else [(allow, None), (None, served)]
        xs = [cx - bw / 2] if allow is None else [cx - bw - 6, cx + 6]
        for (a, s), x0 in zip(bars, xs):
            val = a if a is not None else s
            col = G1 if a is not None else INK
            hh = max(4, H * val / n)
            ax.add_patch(Rectangle((x0, B - hh), bw, hh, color=col, zorder=2))
            lab = f"{val} of {n}"
            if hh > 70:
                T(ax, x0 + bw / 2, B - hh + 48, lab, 25, "#ffffff" if col != G1 else INK, weight="bold", ha="center", zorder=3)
            else:
                T(ax, x0 + bw / 2, B - hh - 16, lab, 25, INK, weight="bold", ha="center", zorder=3)
        T(ax, cx, B + 54, nm, 27, INK, weight="bold" if i == 2 else "normal", ha="center")
        T(ax, cx, B + 92, sub, 19, MUT, ha="center")
    # silent-block annotation on the user-triggered group (allowed 3, served 0)
    cx = 236 + cw * 2.5 + 6 + bw / 2
    ya, ys = y(1), B
    ax.plot([cx, cx], [ya, ys - 60], color=G3, lw=2, ls=(0, (4, 4)), zorder=4)
    ax.plot([cx - 30, cx + 30], [ya, ya], color=G3, lw=2, zorder=4)
    T(ax, cx + 40, ya + 110, f"{silent} silent blocks", 30, INK, zorder=5)
    T(ax, cx + 40, ya + 150, "OAI-SearchBot and all 3 user-triggered agents:", 20, MUT, zorder=5)
    T(ax, cx + 40, ya + 180, "allowed by robots.txt, refused with 403", 20, MUT, zorder=5)
    T(ax, W / 2, h - 60, f"Checked {_d(d)} from one data-center IP. CDN: CloudFront. Control groups rule out a block on all automated traffic.", 19, FAINT, ha="center")
    save(fig, "fig-toyota.webp")


# ---------------------------------------------------------------- sample
def fig_sample():
    h = 1000
    fig, ax = canvas(h)

    def box(cx, y, w, eyebrow, title, meta, hi=False, dashed=False, hh=150):
        x0 = cx - w / 2
        ax.add_patch(Rectangle((x0, y), w, hh, facecolor=GREENBG if hi else BG,
                               edgecolor=GREEN if hi else "#d6d3cc", lw=2.5 if hi else 2,
                               ls=(0, (6, 5)) if dashed else "-", zorder=2))
        T(ax, cx, y + 40, eyebrow, 17, GREEN if hi else FAINT, ha="center", zorder=3, fontfamily="Inter")
        T(ax, cx, y + 86, title, 30, GREEN if hi else INK, weight="bold", ha="center", zorder=3)
        for j, m in enumerate(meta if isinstance(meta, list) else [meta]):
            T(ax, cx, y + 122 + j * 30, m, 20, MUT, ha="center", zorder=3)

    def elbow(x1, y1, x2s, y2):
        ym = (y1 + y2) / 2
        ax.plot([x1, x1], [y1, ym], color="#d6d3cc", lw=2, zorder=1)
        ax.plot([min(x2s + [x1]), max(x2s + [x1])], [ym, ym], color="#d6d3cc", lw=2, zorder=1)
        for x2 in x2s:
            ax.plot([x2, x2], [ym, y2], color="#d6d3cc", lw=2, zorder=1)

    sp = lambda s: " ".join(s)  # letter-spaced eyebrow
    box(1200, 60, 720, sp("SAMPLE"), "Tranco top 20k · 600 domains", "random draw, homepage requests", hh=150)
    elbow(1200, 210, [700, 1700], 290)
    box(700, 290, 600, sp("REACHABLE"), "362 sites", "answered a normal browser")
    box(1700, 290, 600, sp("EXCLUDED"), "238 sites", ["125 no connection · 80 got 403 or a challenge", "33 other status"], dashed=True, hh=180)
    elbow(700, 440, [420, 980], 530)
    box(420, 530, 500, sp("NO REJECTIONS"), "317 sites", "no AI search UA we sent was rejected")
    box(980, 530, 500, sp("REJECTED AN AI SEARCH UA"), "45 sites", "12.4% of reachable")
    elbow(980, 680, [760, 1200], 760)
    box(760, 760, 400, sp("AIMED AT AI"), "13 sites", "robots.txt allows · Googlebot passes", hi=True)
    box(1200, 760, 400, sp("OTHER"), "32 sites", "other rejections")
    T(ax, 1530, 838, "1 in 28", 44, GREEN, weight="bold")
    T(ax, 1530, 880, "reachable sites silently block AI search (3.6%)", 21, MUT)
    T(ax, W / 2, h - 30, "Ground truth is the HTTP response each user agent received. Same IP and URL for every agent.", 19, FAINT, ha="center")
    save(fig, "fig-sample.webp")


# ---------------------------------------------------------------- card versions (home page thumbnails, 2026-11-04)
# The full figures stay linked; cards show one idea each at a size that is legible at ~360-560 px wide.
CW, CH = 1200, 750

def ccanvas():
    fig = plt.figure(figsize=(CW / 72, CH / 72), dpi=72, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, CW); ax.set_ylim(CH, 0); ax.axis("off")
    return fig, ax


def card_lab():
    lab = json.load(open(os.path.join(ROOT, "data", "lab-results.json")))
    R = lab["results"]; n = len(R)
    wrong = {"robots-503", "fw-ai-403", "fw-verify-bots", "fw-unknown-bots", "fw-ai-challenge",
             "fw-ai-thin", "meta-noindex", "header-noindex"}
    v = sum(r["ok"] for r in R); ro = sum(r["slug"] not in wrong for r in R)
    fig, ax = ccanvas()
    T(ax, 80, 110, "Correct access verdicts", 44, weight="bold")
    T(ax, 80, 162, f"{n} lab sites with a known answer", 30, MUT)
    X0, X1 = 80, 1120
    for i, (nm, val, col, sub) in enumerate((("VAKSEL", v, GREEN, "live requests + control groups"),
                                             ("robots.txt only", ro, G2, "rules applied alone (derived)"))):
        y = 320 + i * 220
        T(ax, X0, y, nm, 36, INK if i == 0 else MUT, weight="bold")
        T(ax, X1, y, f"{val} / {n}", 40, col, weight="bold", ha="right")
        ax.add_patch(FancyBboxPatch((X0, y + 30), X1 - X0, 34, boxstyle="round,pad=0,rounding_size=17", color="#e6e4df", lw=0))
        ax.add_patch(FancyBboxPatch((X0, y + 30), (X1 - X0) * val / n, 34, boxstyle="round,pad=0,rounding_size=17", color=col, lw=0))
        T(ax, X0, y + 112, sub, 26, MUT)
    save(fig, "fig-lab-card.webp")


def card_toyota():
    d = json.load(open(os.path.join(ROOT, "data", "demo-toyota.json")))
    bots = [b for b in d["access"]["bots"] if not b["region"]]
    groups = []
    for cat, nm in (("search", "AI search"), ("user", "User-triggered"), ("training", "Training")):
        bs = [b for b in bots if b["category"] == cat]
        groups.append((nm, sum(b["robots"] != "blocked" for b in bs), sum(b["status"] == 200 for b in bs), len(bs)))
    fig, ax = ccanvas()
    T(ax, 80, 110, "toyota.com: allowed vs. served", 44, weight="bold")
    for i, (lab_, col) in enumerate((("robots.txt allows", G1), ("got the page", INK))):
        x0 = 80 + i * 380
        ax.add_patch(Rectangle((x0, 150), 30, 30, color=col)); T(ax, x0 + 44, 175, lab_, 28, MUT)
    B, H = 600, 330
    ax.plot([80, 1120], [B, B], color="#d6d3cc", lw=2)
    cw = 1040 / 3; bw = 120
    for i, (nm, allow, served, n) in enumerate(groups):
        cx = 80 + cw * (i + .5)
        for val, col, x0 in ((allow, G1, cx - bw - 8), (served, INK, cx + 8)):
            hh = max(6, H * val / n)
            ax.add_patch(Rectangle((x0, B - hh), bw, hh, color=col))
            T(ax, x0 + bw / 2, B - hh - 16, f"{val}/{n}", 32, INK, weight="bold", ha="center")
        T(ax, cx, B + 58, nm, 32, INK, ha="center", weight="bold" if i == 1 else "normal")
    save(fig, "fig-toyota-card.webp")


def card_sample():
    rows = [("Sampled", 600, G1, "Tranco top 20k"), ("Reachable", 362, G2, "answered a browser"),
            ("Rejected an AI search UA", 45, G3, "12.4% of reachable"), ("Aimed at AI, robots.txt allows", 13, GREEN, "1 in 28 reachable")]
    fig, ax = ccanvas()
    T(ax, 80, 110, "Silent blocks in the wild", 44, weight="bold")
    T(ax, 80, 162, "600 random domains, homepage requests, Nov 2026", 30, MUT)
    X0, X1 = 80, 1120
    for i, (nm, val, col, sub) in enumerate(rows):
        y = 250 + i * 122
        w = max(10, (X1 - X0) * val / 600)
        ax.add_patch(Rectangle((X0, y), w, 50, color=col))
        hi = col == GREEN
        T(ax, X0 + w + 18 if w < 700 else X0 + 20, y + 37, f"{val}", 34, GREEN if hi else INK, weight="bold")
        T(ax, X0, y + 88, f"{nm} · {sub}", 26, GREEN if hi else MUT, weight="bold" if hi else "normal")
    save(fig, "fig-sample-card.webp")


if __name__ == "__main__":
    fig_lab(); fig_toyota(); fig_sample(); card_lab(); card_toyota(); card_sample()
