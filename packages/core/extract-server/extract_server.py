#!/usr/bin/env python3
"""Helix local extract server — Firecrawl-compatible, zero external deps.

Self-contained clone of the Hermes `local_firecrawl.py` pattern so Helix can
extract web content with NO API key and NO paid service. Exposes the same
Firecrawl-compatible API the `web` tool expects:

    POST /v1/scrape  { "url": "..." }
      -> { "success": true, "data": { "markdown": "...", "metadata": {...} } }

Extraction chain (never returns empty silently):
  0) GitHub raw README via API (SPA-safe)
  1) trafilatura 2.x (fetch HTML -> extract, retried)
  2) Lightpanda real headless browser (defeats JS/SPA rendering)
  3) readability-lxml -> markdownify
  4) BeautifulSoup get_text

Run:  python3 extract_server.py   (binds 127.0.0.1:PORT, default 8787)
"""

import os
import re
import sys
import time
import json
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
LP = os.path.expanduser("~/.local/bin/lightpanda")


def _get(url, timeout=25, tries=3):
    import requests

    last = None
    for i in range(tries):
        try:
            r = requests.get(url, timeout=timeout, headers=UA)
            if r.status_code == 200 and len(r.text) > 200:
                return r.text
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = repr(e)
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"fetch failed after {tries} tries: {last}")


def _retry(fn, tries=3):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:
            last = e
            time.sleep(1.0 * (i + 1))
    raise last or RuntimeError("extract failure")


def _github_readme(url: str):
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+)/?.*", url)
    if not m or "raw" in url or "/blob/" in url:
        return None
    owner, repo = m.group(1), m.group(2)
    try:
        import requests

        r = requests.get(
            f"https://api.github.com/repos/{owner}/{repo}/readme",
            timeout=25,
            headers={"User-Agent": "Mozilla/5.0",
                     "Accept": "application/vnd.github.raw+json"},
        )
        if r.status_code == 200 and len(r.text.strip()) > 50:
            return r.text
    except Exception as e:
        print(f"[github-api] {e}", file=sys.stderr)
    return None


def _lightpanda(url: str):
    if not os.path.exists(LP):
        return None
    try:
        out = tempfile.mktemp(suffix=".html")
        subprocess.run([LP, "fetch", "-o", out, url],
                       timeout=50, capture_output=True)
        if os.path.exists(out) and os.path.getsize(out) > 200:
            html = open(out, encoding="utf-8", errors="ignore").read()
            os.unlink(out)
            import trafilatura

            md = trafilatura.extract(html, output_format="markdown")
            if md and len(md.strip()) > 50:
                return md
    except Exception as e:
        print(f"[lightpanda] {e}", file=sys.stderr)
    return None


def extract(url: str) -> dict:
    # 0) GitHub raw README
    gh = _github_readme(url)
    if gh:
        return {"markdown": gh, "content": gh,
                "metadata": {"source": "github-api", "url": url, "status": 200}}

    # 1) trafilatura 2.x
    try:
        import trafilatura

        html = _get(url)
        md = _retry(lambda: trafilatura.extract(html, output_format="markdown"))
        if md and len(md.strip()) > 50:
            return {"markdown": md, "content": md,
                    "metadata": {"source": "trafilatura", "url": url, "status": 200}}
    except Exception as e:
        print(f"[trafilatura] {e}", file=sys.stderr)

    # 2) Lightpanda
    lp = _lightpanda(url)
    if lp:
        return {"markdown": lp, "content": lp,
                "metadata": {"source": "lightpanda", "url": url, "status": 200}}

    # 3) readability-lxml -> markdownify
    try:
        from readability import Document
        from markdownify import markdownify

        html = _get(url)
        summary = Document(html).summary()
        md = markdownify(summary) if markdownify else summary
        if md and len(md.strip()) > 50:
            return {"markdown": md, "content": md,
                    "metadata": {"source": "readability", "url": url, "status": 200}}
    except Exception as e:
        print(f"[readability] {e}", file=sys.stderr)

    # 4) bs4 last resort
    try:
        from bs4 import BeautifulSoup

        html = _get(url)
        soup = BeautifulSoup(html, "html.parser")
        for t in soup(["script", "style", "nav", "footer", "header"]):
            t.decompose()
        text = soup.get_text("\n", strip=True)
        if text and len(text.strip()) > 50:
            return {"markdown": text, "content": text,
                    "metadata": {"source": "bs4", "url": url, "status": 200}}
    except Exception as e:
        print(f"[bs4] {e}", file=sys.stderr)

    return {"markdown": "", "content": "",
            "metadata": {"source": "none", "url": url, "status": 500}}


class H(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = self.path.rstrip("/")
        if path not in ("/v1/scrape", "/v2/scrape", "/scrape"):
            self._send(404, {"success": False, "error": "not found"})
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n) if n else b"{}"
            data = json.loads(raw or b"{}")
        except Exception:
            data = {}
        url = data.get("url") or (data.get("urls") or [None])[0]
        if not url:
            self._send(400, {"success": False, "error": "missing url"})
            return
        print(f"[scrape] {url}", file=sys.stderr)
        try:
            res = extract(url)
            success = res["metadata"].get("status") == 200 and len(res["markdown"]) > 50
            self._send(200, {"success": success, "data": res})
        except Exception as e:
            self._send(500, {"success": False, "error": str(e)})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    PORT = int(os.environ.get("HELIX_FC_PORT", "8787"))
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"helix-extract server on :{PORT}")
    srv.serve_forever()
