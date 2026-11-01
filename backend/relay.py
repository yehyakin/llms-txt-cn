#!/usr/bin/env python3
"""cetxt-relay：给 Cloudflare Worker 用的回落抓取器（纯标准库）。

为什么需要：不少国内站（B站、Gitee 等）会拦 Cloudflare Worker 的出口 IP（412/403/530），
Worker 被拦时把同一个 URL 交给这台服务器代抓。

POST /probe {"domain": "..."}：用浏览器、对照爬虫、各 AI 爬虫 UA 请求首页，返回原始状态码/头/正文（判定在 Worker）。
POST /fetch {"url": "https://<domain>/robots.txt|/llms.txt", "max": 字节上限}
- 必须带 X-Relay-Key（与 Worker secret RELAY_KEY 一致），否则 403
- 首个 URL 只允许根路径 /robots.txt 或 /llms.txt，默认端口，http/https
- DNS 解析后全部须为公网 IP；连接后二次核验对端 IP（防 DNS rebinding）
- 手动跟重定向（最多 5 跳，每跳重验），10s 单次超时，体积上限 512KiB
- 全局限频；不写日志、不记域名或 IP
监听 127.0.0.1:8768，公网经 Caddy（relay.cetxt.com）反代。
"""
import base64
import gzip
import zlib
import hmac
import http.client
import http.server
import ipaddress
import json
import os
import re
import socket
import ssl
import threading
import time
import urllib.parse
from collections import deque

BIND = os.environ.get("RELAY_BIND", "127.0.0.1")
PORT = int(os.environ.get("RELAY_PORT", "8768"))
KEY_FILE = os.environ.get("RELAY_KEY_FILE", "/etc/cetxt-relay/key")
TIMEOUT = 10
HARD_MAX = 512 * 1024
MAX_REDIRECTS = 5
UA = "cetxt-check/2.0 (+https://cetxt.com/)"
ALLOWED_PATHS = ("/robots.txt", "/llms.txt")
HOST_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$", re.I)

GLOBAL_N, GLOBAL_T = 240, 60
_hits = deque()
_lock = threading.Lock()


def load_key():
    with open(KEY_FILE, "r") as f:
        return f.read().strip()


KEY = load_key()


def rate_ok():
    now = time.time()
    with _lock:
        while _hits and now - _hits[0] > GLOBAL_T:
            _hits.popleft()
        if len(_hits) >= GLOBAL_N:
            return False
        _hits.append(now)
        return True


def is_public_ip(ip):
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if getattr(a, "ipv4_mapped", None):
        a = a.ipv4_mapped
    return a.is_global and not (a.is_multicast or a.is_reserved or a.is_unspecified)


def host_ok(host):
    if not host or not HOST_RE.match(host):
        return False
    try:
        ipaddress.ip_address(host)
        return False  # 拒绝 IP 字面量
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return None  # 解析失败（域名无记录），与"解析到内网"区分
    ips = {i[4][0] for i in infos}
    if not ips:
        return None
    return all(is_public_ip(ip) for ip in ips)


def check_url(url):
    u = urllib.parse.urlsplit(url)
    if u.scheme not in ("http", "https"):
        return None, "bad_scheme"
    if u.username or u.password:
        return None, "bad_url"
    try:
        port = u.port
    except ValueError:
        return None, "bad_port"
    if port and not ((u.scheme == "http" and port == 80) or (u.scheme == "https" and port == 443)):
        return None, "bad_port"
    host = (u.hostname or "").rstrip(".").lower()
    ok = host_ok(host)
    if ok is None:
        return None, "dns_fail"
    if not ok:
        return None, "dns_blocked"
    return u, None


def fetch_once(u, max_bytes, accept, ua=UA, any_status=False):
    host = u.hostname.rstrip(".")
    port = u.port or (443 if u.scheme == "https" else 80)
    cls = http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
    conn = cls(host, port, timeout=TIMEOUT)
    try:
        path = (u.path or "/") + ("?" + u.query if u.query else "")
        # 先建连再核验对端 IP（防 DNS rebinding）。必须在 getresponse 之前取：
        # 对方回 Connection: close 时 http.client 会把 sock 置空，之后再取会误判
        conn.connect()
        try:
            peer = conn.sock.getpeername()[0]
        except Exception:
            peer = None
        if not peer or not is_public_ip(peer):
            return {"kind": "error", "code": "dns_blocked", "reason": "对端地址异常"}
        conn.request("GET", path, headers={"User-Agent": ua, "Accept": accept, "Accept-Encoding": "identity", "Accept-Language": "en-US,en;q=0.9,zh;q=0.8"})
        resp = conn.getresponse()
        status = resp.status
        ctype = resp.getheader("Content-Type", "") or ""
        if status in (301, 302, 303, 307, 308):
            return {"kind": "redirect", "location": resp.getheader("Location")}
        body = b""
        truncated = False
        if 200 <= status < 300 or any_status:
            enc = (resp.getheader("Content-Encoding") or "").lower()
            data = resp.read(max_bytes + 1)
            # 有的站无视 Accept-Encoding: identity 仍返回 gzip（如 B站），这里解压（解压后同样受上限约束）
            if "gzip" in enc or data[:2] == b"\x1f\x8b":
                try:
                    d = zlib.decompressobj(16 + zlib.MAX_WBITS)
                    data = d.decompress(data, max_bytes + 1)
                except Exception:
                    pass
            elif "deflate" in enc:
                try:
                    d = zlib.decompressobj()
                    data = d.decompress(data, max_bytes + 1)
                except Exception:
                    pass
            truncated = len(data) > max_bytes
            body = data[:max_bytes]
        out = {"kind": "response", "status": status, "content_type": ctype,
               "body_b64": base64.b64encode(body).decode("ascii"), "truncated": truncated}
        if any_status:
            out["headers"] = {k.lower(): v[:200] for k, v in resp.getheaders()
                              if k.lower() in PROBE_HEADERS}
        return out
    except socket.timeout:
        return {"kind": "error", "code": "timeout", "reason": "连接超时（10 秒）", "transport": True}
    except ssl.SSLError:
        return {"kind": "error", "code": "tls", "reason": "TLS 握手失败", "transport": True}
    except (ConnectionError, OSError):
        return {"kind": "error", "code": "conn_fail", "reason": "连接失败（对方拒连或网络不可达）", "transport": True}
    except Exception as e:
        return {"kind": "error", "code": "fetch_fail", "reason": "抓取失败：" + type(e).__name__}
    finally:
        try:
            conn.close()
        except Exception:
            pass


PROBE_HEADERS = ("server", "cf-ray", "cf-mitigated", "x-robots-tag", "content-signal", "x-amz-cf-id",
                 "x-akamai-transformed", "x-sucuri-id", "x-iinfo", "x-cdn", "via", "x-cache", "content-type", "retry-after")
# 探测身份：browser 作基线；Googlebot / ZetaBot 作对照组（区分"拦 AI"与"拦伪装爬虫"）
PROBE_UAS = [
    ("browser", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"),
    ("Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
    ("control-bot", "Mozilla/5.0 (compatible; ZetaBot/1.0; +https://example.org/bot)"),
    ("OAI-SearchBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot"),
    ("ChatGPT-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"),
    ("PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"),
    ("Perplexity-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)"),
    ("Claude-SearchBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)"),
    ("Claude-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)"),
    ("GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.3; +https://openai.com/gptbot"),
    ("ClaudeBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"),
    ("Bytespider", "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)"),
    ("PetalBot", "Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)"),
]
PROBE_MAX = 300 * 1024
_probe_sem = threading.Semaphore(4)  # 同时最多 4 个探测（每个约 13 次请求）


def follow(url, ua, max_bytes, deadline):
    """按 ua 跟跳转（每跳重验），返回最终响应（任何状态码）。"""
    redirects = 0
    while True:
        if time.time() > deadline:
            return {"kind": "error", "code": "timeout", "reason": "整体超时"}
        u, err = check_url(url)
        if err:
            return {"kind": "error", "code": err}
        r = fetch_once(u, max_bytes, "text/html,application/xhtml+xml,*/*;q=0.8", ua=ua, any_status=True)
        if r["kind"] != "redirect":
            if r["kind"] == "response":
                r["final_url"] = url
                r["redirects"] = redirects
            return r
        loc = r.get("location")
        if not loc or redirects >= MAX_REDIRECTS:
            return {"kind": "error", "code": "bad_redirect"}
        redirects += 1
        url = urllib.parse.urljoin(url, loc)


_CHAL = re.compile(rb"Just a moment|cf-chl|challenge-platform|cf_chl_opt|Attention Required|Access denied|_Incapsula_|px-captcha|captcha-delivery|aliyun_waf|ddos-guard|sucuri", re.I)
_TAGS = re.compile(rb"(?is)<(script|style|noscript|template|svg)[^>]*>.*?</\1>")


def signals(r):
    """把一次响应压成小信号：状态、关键头、正文大小、无 JS 可读字数、挑战页特征、meta robots、标题。"""
    if r.get("kind") != "response":
        return {"error": r.get("code") or r.get("kind")}
    body = base64.b64decode(r.get("body_b64", ""))
    text = re.sub(rb"\s+", b" ", re.sub(rb"<[^>]+>", b" ", _TAGS.sub(b" ", body))).strip()
    m = re.search(rb"(?is)<title[^>]*>(.*?)</title>", body)
    metas = re.findall(rb"(?is)<meta[^>]+name=[\"']?(?:robots|googlebot)[\"']?[^>]*>", body)
    meta_robots = b" ".join(re.findall(rb"(?is)content=[\"']([^\"']*)", b" ".join(metas))).decode("latin1")[:200]
    return {"status": r.get("status"), "headers": r.get("headers", {}), "bytes": len(body),
            "text_chars": len(text.decode("utf-8", "ignore")), "challenge": bool(_CHAL.search(body[:60000])),
            "meta_robots": meta_robots, "title": (m.group(1).decode("utf-8", "ignore").strip()[:120] if m else ""),
            "final_url": r.get("final_url"), "redirects": r.get("redirects", 0)}


def probe(domain):
    """用浏览器基线 + 对照组 + 各 AI 爬虫身份请求首页，只返回原始信号，判定在 Worker 里做。"""
    if not HOST_RE.match(domain or ""):
        return {"kind": "error", "code": "bad_domain"}
    if not _probe_sem.acquire(timeout=20):
        return {"kind": "error", "code": "busy"}
    try:
        deadline = time.time() + 40
        start = "https://" + domain + "/"
        base = follow(start, PROBE_UAS[0][1], PROBE_MAX, deadline)
        if base.get("kind") == "error" and base.get("code") in ("timeout", "conn_fail", "tls"):
            start = "http://" + domain + "/"
            base = follow(start, PROBE_UAS[0][1], PROBE_MAX, deadline)
        results = {"browser": base}
        target = base.get("final_url") or start
        import concurrent.futures as cf
        with cf.ThreadPoolExecutor(6) as ex:
            futs = {n: ex.submit(follow, target, ua, PROBE_MAX, deadline) for n, ua in PROBE_UAS[1:]}
            for n, f in futs.items():
                try:
                    results[n] = f.result(timeout=max(1, deadline - time.time()))
                except Exception:
                    results[n] = {"kind": "error", "code": "timeout"}
        return {"kind": "probe", "target": target, "results": {k: signals(v) for k, v in results.items()}}
    finally:
        _probe_sem.release()


def relay(url, max_bytes, accept):
    u0 = urllib.parse.urlsplit(url)
    if u0.path not in ALLOWED_PATHS or u0.query or u0.fragment:
        return {"kind": "error", "code": "bad_path", "reason": "只允许 /robots.txt 或 /llms.txt"}
    redirects = 0
    deadline = time.time() + 25
    while True:
        if time.time() > deadline:
            return {"kind": "error", "code": "timeout", "reason": "整体超时"}
        u, err = check_url(url)
        if err:
            reason = "域名无法解析（没有 A/AAAA 记录）" if err == "dns_fail" else "目标地址被拒绝（%s）" % err
            return {"kind": "error", "code": err, "reason": reason, "refused": redirects > 0}
        r = fetch_once(u, max_bytes, accept)
        if r["kind"] != "redirect":
            if r["kind"] == "response":
                r["final_url"] = url
                r["redirects"] = redirects
            return r
        loc = r.get("location")
        if not loc:
            return {"kind": "error", "code": "bad_redirect", "reason": "重定向缺少 Location"}
        if redirects >= MAX_REDIRECTS:
            return {"kind": "too_many_redirects", "final_url": url, "redirects": redirects}
        redirects += 1
        url = urllib.parse.urljoin(url, loc)


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "cetxt-relay/1.0"

    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True})
        return self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path == "/probe":
            if not hmac.compare_digest(self.headers.get("X-Relay-Key", ""), KEY):
                return self.send_json(403, {"error": "forbidden"})
            if not rate_ok():
                return self.send_json(429, {"error": "rate_limited"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if n <= 0 or n > 1024:
                    return self.send_json(400, {"error": "bad_request"})
                domain = str(json.loads(self.rfile.read(n)).get("domain", "")).strip().lower().rstrip(".")
            except Exception:
                return self.send_json(400, {"error": "bad_request"})
            try:
                out = probe(domain)
            except Exception as e:
                out = {"kind": "error", "code": "internal", "reason": type(e).__name__}
            return self.send_json(200, out)
        if self.path != "/fetch":
            return self.send_json(404, {"error": "not_found"})
        if not hmac.compare_digest(self.headers.get("X-Relay-Key", ""), KEY):
            return self.send_json(403, {"error": "forbidden"})
        if not rate_ok():
            return self.send_json(429, {"error": "rate_limited"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > 4096:
                return self.send_json(400, {"error": "bad_request"})
            req = json.loads(self.rfile.read(n))
            url = str(req.get("url", ""))
            max_bytes = max(1024, min(int(req.get("max", HARD_MAX)), HARD_MAX))
            accept = str(req.get("accept", "text/plain,*/*"))[:200]
        except Exception:
            return self.send_json(400, {"error": "bad_request"})
        try:
            out = relay(url, max_bytes, accept)
        except Exception as e:
            out = {"kind": "error", "code": "internal", "reason": "内部错误：" + type(e).__name__}
        return self.send_json(200, out)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    Server((BIND, PORT), Handler).serve_forever()
