#!/usr/bin/env python3
"""静态文件服务，非文件路径回退到 index.html（Vue history 路由）。"""

from __future__ import annotations

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8080


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if not path.is_file():
            self.path = "/index.html"
        return super().send_head()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    server = ThreadingHTTPServer(("127.0.0.1", port), SPAHandler)
    print(f"Serving {ROOT} at http://127.0.0.1:{port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
