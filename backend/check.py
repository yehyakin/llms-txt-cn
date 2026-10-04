#!/usr/bin/env python3
"""cetxt-check: 输入域名，抓取其 /llms.txt 并分类。

纯标准库。只监听内网（10.52.0.1:8767），公网经 45 的 Caddy 反代 /api/check。
安全要点：域名白名单校验、DNS 解析后拦内网 IP、连接后二次核验对端 IP（防 DNS rebinding）、
手动跟重定向（每跳重验）、10s 超时、200KB 截断、按 IP 限频。
"""
import http.client
import http.server
import ipaddress
import json
import re
import socket
import ssl
import threading
import time
import urllib.parse
from collections import defaultdict, deque

BIND = "10.52.0.1"
PORT = 8767
TIMEOUT = 10
MAX_BYTES = 200 * 1024
MAX_REDIRECTS = 5
UA = "cetxt-check/1.0 (+https://cetxt.com/)"

RATE_N, RATE_T = 20, 60  # 每个 IP 每 60 秒最多 20 次
_hits = defaultdict(deque)
_lock = threading.Lock()


def rate_ok(ip):
    now = time.time()
    with _lock:
        q = _hits[ip]
        while q and now - q[0] > RATE_T:
            q.popleft()
        if len(q) >= RATE_N:
            return False
        q.append(now)
        return True


HOST_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$", re.I)


def clean_domain(raw):
    """从用户输入提取合法域名；不合法返回 None。"""
    raw = (raw or "").strip().lower()
    if not raw:
        return None
    if "://" not in raw:
        raw = "http://" + raw
    try:
        u = urllib.parse.urlsplit(raw)
    except Exception:
        return None
    if u.username or u.password:
        return None
    host = (u.hostname or "").rstrip(".")
    if not HOST_RE.match(host):
        return None
    return host


def is_public_ip(ip):
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (a.is_private or a.is_loopback or a.is_link_local
                or a.is_multicast or a.is_reserved or a.is_unspecified)


def resolve_public(host):
    """解析并确认所有结果都是公网 IP；否则返回 None。"""
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return None
    ips = {i[4][0] for i in infos}
    if not ips:
        return None
    if not all(is_public_ip(ip) for ip in ips):
        return None
    return ips


def decode_body(raw, ctype):
    m = re.search(r"charset=([\w-]+)", ctype or "", re.I)
    candidates = ([m.group(1)] if m else []) + ["utf-8-sig", "utf-8", "gb18030"]
    for enc in candidates:
        try:
            return raw.decode(enc)
        except Exception:
            pass
    return raw.decode("latin1", "replace")


def fetch_once(url):
    """单次请求（不自动跟重定向）。返回 (action, payload)。
    action: 'redirect' -> payload 是新 URL；'response' -> payload 是响应 dict；'error' -> payload 是错误 dict。"""
    u = urllib.parse.urlsplit(url)
    if u.scheme not in ("http", "https"):
        return "error", {"error": "bad_scheme", "reason": "仅支持 http/https"}
    if u.username or u.password:
        return "error", {"error": "bad_url", "reason": "URL 非法"}
    host = u.hostname
    if not host or not resolve_public(host):
        return "error", {"error": "dns_blocked", "reason": "域名无法解析，或解析到了内网地址"}
    port = u.port or (443 if u.scheme == "https" else 80)
    cls = http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
    conn = cls(host, port, timeout=TIMEOUT)
    try:
        path = u.path or "/"
        if u.query:
            path += "?" + u.query
        conn.request("GET", path, headers={"User-Agent": UA, "Accept": "text/markdown,text/plain,*/*"})
        resp = conn.getresponse()
        # 连接后二次核验对端 IP（防 DNS rebinding）
        try:
            peer = conn.sock.getpeername()[0] if conn.sock else None
        except Exception:
            peer = None
        if not peer or not is_public_ip(peer):
            return "error", {"error": "dns_blocked", "reason": "对端地址异常"}
        status = resp.status
        if status in (301, 302, 303, 307, 308):
            loc = resp.getheader("Location")
            if not loc:
                return "error", {"error": "bad_redirect", "reason": "重定向地址无效"}
            return "redirect", urllib.parse.urljoin(url, loc)
        ctype = resp.getheader("Content-Type", "") or ""
        if status == 404:
            return "response", {"http_status": 404, "final_url": url}
        if status != 200:
            return "error", {"error": "http_%d" % status, "reason": "对方返回 HTTP %d" % status}
        data = resp.read(MAX_BYTES + 1)
        truncated = len(data) > MAX_BYTES
        raw = data[:MAX_BYTES]
        enc = (resp.getheader("Content-Encoding") or "").lower()
        if "gzip" in enc:
            try:
                import gzip as _gz
                raw = _gz.decompress(raw)
            except Exception:
                pass
        elif "deflate" in enc:
            try:
                import zlib as _zl
                raw = _zl.decompress(raw)
            except Exception:
                pass
        text = decode_body(raw, ctype)
        return "response", {"http_status": 200, "final_url": url,
                            "content_type": ctype, "text": text, "truncated": truncated}
    except socket.timeout:
        return "error", {"error": "timeout", "reason": "连接超时（10 秒）"}
    except ssl.SSLError:
        return "error", {"error": "tls", "reason": "TLS 握手失败"}
    except (ConnectionError, OSError):
        return "error", {"error": "conn_fail", "reason": "连接失败（对方拒连或网络不可达）"}
    except Exception as e:
        return "error", {"error": "fetch_fail", "reason": "抓取失败：" + type(e).__name__}
    finally:
        try:
            conn.close()
        except Exception:
            pass


MD_LINK_RE = re.compile(r"\[[^\]]+\]\(https?://", re.I)


def classify(resp):
    """把抓取结果分类为真文件/HTML伪装/无文件/非规范文本。"""
    if resp.get("http_status") == 404:
        return "missing", None
    text = resp.get("text", "")
    ctype = (resp.get("content_type") or "").lower()
    stripped = text.lstrip().lower()
    if "text/html" in ctype or stripped.startswith(("<!doctype html", "<html")):
        return "html_spoof", None
    if text.lstrip().startswith("#") or MD_LINK_RE.search(text):
        return "real", text
    return "nonstandard", text


def check_domain(domain):
    t0 = time.time()
    # https 优先，传输层失败才回落 http；404 视为"无文件"不再试
    url = "https://" + domain + "/llms.txt"
    transport_failed = False
    for depth in range(MAX_REDIRECTS + 1):
        action, payload = fetch_once(url)
        if action == "redirect":
            url = payload
            continue
        if action == "error":
            if payload.get("error") in ("timeout", "conn_fail", "tls") and url.startswith("https://") and not transport_failed:
                transport_failed = True
                url = "http://" + domain + "/llms.txt"
                continue
            ms = int((time.time() - t0) * 1000)
            return {"domain": domain, "verdict": "unknown",
                    "reason": payload.get("reason", "未知错误"),
                    "code": payload.get("error"), "elapsed_ms": ms}
        verdict, text = classify(payload)
        ms = int((time.time() - t0) * 1000)
        out = {"domain": domain, "verdict": verdict,
               "http_status": payload.get("http_status"),
               "final_url": payload.get("final_url"), "elapsed_ms": ms}
        if text is not None:
            out["text"] = text
            out["truncated"] = payload.get("truncated", False)
        return out
    ms = int((time.time() - t0) * 1000)
    return {"domain": domain, "verdict": "unknown", "reason": "重定向次数过多", "code": "redirect_loop", "elapsed_ms": ms}


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "cetxt-check/1.0"

    def log_message(self, fmt, *args):
        pass

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "https://cetxt.com")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        if u.path == "/api/health":
            return self.send_json(200, {"ok": True})
        if u.path != "/api/check":
            return self.send_json(404, {"error": "not_found"})
        qs = urllib.parse.parse_qs(u.query)
        domain = clean_domain(qs.get("domain", [""])[0])
        if not domain:
            return self.send_json(400, {"error": "bad_domain", "reason": "域名不合法"})
        ip = self.client_address[0]
        if not rate_ok(ip):
            return self.send_json(429, {"error": "rate_limited", "reason": "请求太频繁，稍后再试"})
        print("[check] %s <- %s" % (domain, ip), flush=True)
        try:
            result = check_domain(domain)
        except Exception as e:
            result = {"domain": domain, "verdict": "unknown",
                      "reason": "内部错误：" + type(e).__name__, "code": "internal"}
        self.send_json(200, result)


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer((BIND, PORT), Handler)
    srv.daemon_threads = True
    print("cetxt-check listening on %s:%d" % (BIND, PORT), flush=True)
    srv.serve_forever()
