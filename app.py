#!/usr/bin/env python3
"""Local preview server for the static Morning English app."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os


class PreviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        try:
            super().log_message(format, *args)
        except OSError:
            pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


def safe_print(message):
    try:
        print(message, flush=True)
    except OSError:
        pass


def main():
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), PreviewHandler)
    safe_print(f"Serving Morning English at http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        safe_print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
