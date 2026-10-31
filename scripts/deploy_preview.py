#!/usr/bin/env python3
"""直接调 Cloudflare API 部署 Worker + Static Assets 到 workers.dev 预览（不需要 wrangler）。

用法：CF_ACCOUNT_ID=... python3 scripts/deploy_preview.py [--dry-run] [--embed]
  --no-stats：不绑定 Analytics Engine（账户未开通时）
  --embed：静态文件内嵌进脚本（不用 Static Assets）。在无法调用 assets 上传接口的环境里用。
认证：环境里的 Cloudflare API token（CLOUDFLARE_API_TOKEN），或由运行环境在网关层注入。
只部署脚本 cetxt-preview，只开启 workers.dev 子域；不加任何 zone 路由、不改 DNS。
"""
import base64, fnmatch, hashlib, json, mimetypes, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACCOUNT = os.environ.get('CF_ACCOUNT_ID', '948404eece3eea613652f530a1a138f8')
SCRIPT = 'cetxt-preview'
API = 'https://api.cloudflare.com/client/v4'
COMPAT = '2026-10-01'
DRY = '--dry-run' in sys.argv

import requests
VERIFY = os.environ.get('SSL_CERT_FILE') or True
TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN')


def hdr(extra=None):
    h = {}
    if TOKEN:
        h['Authorization'] = 'Bearer ' + TOKEN
    h.update(extra or {})
    return h


def check(r, what):
    try:
        j = r.json()
    except Exception:
        print(what, 'HTTP', r.status_code, r.text[:500]); sys.exit(1)
    if not j.get('success'):
        print(what, 'FAILED HTTP', r.status_code, json.dumps(j.get('errors'), ensure_ascii=False)); sys.exit(1)
    return j['result']


def ignore_patterns():
    pats = []
    p = os.path.join(ROOT, '.assetsignore')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#'):
                pats.append(line.rstrip('/'))
    return pats


def ignored(rel, pats):
    parts = rel.split('/')
    for pat in pats:
        if fnmatch.fnmatch(rel, pat) or any(fnmatch.fnmatch(seg, pat) for seg in parts):
            return True
    return False


def collect():
    pats = ignore_patterns()
    files = {}
    for dp, dns, fns in os.walk(ROOT):
        reld = os.path.relpath(dp, ROOT).replace(os.sep, '/')
        dns[:] = [d for d in dns if not ignored((d if reld == '.' else reld + '/' + d), pats)]
        for fn in fns:
            rel = fn if reld == '.' else reld + '/' + fn
            if ignored(rel, pats):
                continue
            data = open(os.path.join(dp, fn), 'rb').read()
            ext = os.path.splitext(fn)[1].lstrip('.')
            b64 = base64.b64encode(data).decode()
            h = hashlib.sha256((b64 + ext).encode()).hexdigest()[:32]
            files['/' + rel] = {'hash': h, 'size': len(data), 'b64': b64, 'ctype': mimetypes.guess_type(fn)[0] or 'application/octet-stream'}
    return files


def main():
    embed = '--embed' in sys.argv
    subprocess.check_call(['node', os.path.join(ROOT, 'scripts/build-worker.mjs')] + (['--embed'] if embed else []))
    files = collect()
    print('assets:', len(files), 'files,', sum(f['size'] for f in files.values()), 'bytes')
    for k in sorted(files):
        print('  ', k)
    if DRY:
        return
    if embed:
        return upload_script(None)
    manifest = {k: {'hash': v['hash'], 'size': v['size']} for k, v in files.items()}
    sess = check(requests.post(f'{API}/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/assets-upload-session',
                               headers=hdr({'content-type': 'application/json'}), data=json.dumps({'manifest': manifest}), verify=VERIFY),
                 'assets-upload-session')
    jwt = sess['jwt']
    by_hash = {v['hash']: v for v in files.values()}
    completion = jwt
    for bucket in sess.get('buckets') or []:
        form = [(h, (h, by_hash[h]['b64'], by_hash[h]['ctype'])) for h in bucket]
        r = requests.post(f'{API}/accounts/{ACCOUNT}/workers/assets/upload?base64=true',
                          headers={'Authorization': 'Bearer ' + jwt}, files=form, verify=VERIFY)
        res = check(r, 'assets/upload')
        if res and res.get('jwt'):
            completion = res['jwt']
    print('assets uploaded; buckets:', len(sess.get('buckets') or []))
    upload_script(completion)


def upload_script(completion):
    metadata = {
        'main_module': 'index.js',
        'compatibility_date': COMPAT,
        'bindings': [
            {'type': 'assets', 'name': 'ASSETS'},
            {'type': 'ratelimit', 'name': 'RL', 'namespace_id': '20261031', 'simple': {'limit': 20, 'period': 60}},
            {'type': 'analytics_engine', 'name': 'STATS', 'dataset': 'cetxt_verdicts'},
        ],
        'observability': {'enabled': False},
    }
    if completion:
        metadata['assets'] = {'jwt': completion, 'config': {
            'html_handling': 'auto-trailing-slash', 'not_found_handling': '404-page', 'run_worker_first': True}}
    else:
        metadata['bindings'] = [b for b in metadata['bindings'] if b['type'] != 'assets']
    if '--no-stats' in sys.argv:  # 账户未开通 Analytics Engine 时：不绑定 STATS，计数自动跳过
        metadata['bindings'] = [b for b in metadata['bindings'] if b['type'] != 'analytics_engine']
    if '--no-extra-bindings' in sys.argv:
        metadata['bindings'] = metadata['bindings'][:1]
    parts = [('metadata', (None, json.dumps(metadata), 'application/json'))]
    for name in ['index.js', 'check.js', '_libs.js', '_assets.js']:
        parts.append((name, (name, open(os.path.join(ROOT, 'worker', name), 'rb').read(), 'application/javascript+module')))
    res = check(requests.put(f'{API}/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}', headers=hdr(), files=parts, verify=VERIFY), 'script upload')
    print('script uploaded:', res.get('id'), res.get('etag', '')[:12])
    check(requests.post(f'{API}/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/subdomain', headers=hdr({'content-type': 'application/json'}),
                        data=json.dumps({'enabled': True, 'previews_enabled': False}), verify=VERIFY), 'enable workers.dev')
    sub = check(requests.get(f'{API}/accounts/{ACCOUNT}/workers/subdomain', headers=hdr(), verify=VERIFY), 'subdomain')
    print('PREVIEW: https://%s.%s.workers.dev/' % (SCRIPT, sub['subdomain']))


if __name__ == '__main__':
    main()
