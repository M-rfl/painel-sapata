"""Local preview of site/ with caching disabled.

`python -m http.server` sends no Cache-Control, so browsers keep stale ES
modules after an edit. This server sends `no-store` so every reload is fresh.

Usage: python -m tools.serve_site [port]   (default 8000)
"""
import functools
import http.server
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    port = int(argv[0]) if argv else 8000
    handler = functools.partial(NoCacheHandler, directory=str(SITE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Prévia em http://localhost:{port}/ (Ctrl+C para parar)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
