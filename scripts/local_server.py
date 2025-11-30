#!/usr/bin/env python3
"""
轻量本地静态服务器，自动打开浏览器并监听用户中断。
"""

from __future__ import annotations

import argparse
import contextlib
import http.server
import os
import socket
import threading
import time
import webbrowser
from pathlib import Path


def find_available_port(start_port: int, tries: int = 25) -> int:
    for port in range(start_port, start_port + tries):
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError(f"在 {start_port} 附近找不到可用端口")


def wait_until_listening(port: int, retries: int = 40, delay: float = 0.15) -> None:
    for _ in range(retries):
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(delay)
    raise RuntimeError("服务器启动超时")


def build_handler(root: Path) -> type[http.server.SimpleHTTPRequestHandler]:
    class StaticHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, format: str, *args) -> None:  # noqa: A003
            print(f"[{self.log_date_time_string()}] {self.address_string()} - {format % args}")

    return StaticHandler


def main() -> None:
    parser = argparse.ArgumentParser(description="启动简易本地服务器并打开浏览器")
    parser.add_argument(
        "--root",
        default=Path(__file__).resolve().parents[1],
        type=Path,
        help="静态文件根目录",
    )
    parser.add_argument("--entry", default="index.html", help="首次打开的页面路径")
    parser.add_argument("--port", default=8000, type=int, help="首选端口（若被占用自动递增）")
    args = parser.parse_args()

    web_root = args.root.resolve()
    if not web_root.exists():
        raise SystemExit(f"目录不存在：{web_root}")

    os.chdir(web_root)
    port = find_available_port(args.port)
    url = f"http://localhost:{port}/{args.entry.lstrip('/')}"

    handler = build_handler(web_root)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True  # 方便退出

    print("-" * 60)
    print(f"静态目录：{web_root}")
    print(f"访问地址：{url}")
    print("关闭方式：回到该窗口按 Ctrl+C 即可")
    print("-" * 60)

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    wait_until_listening(port)
    webbrowser.open(url, new=2, autoraise=True)
    print("浏览器已尝试自动打开，若未成功可手动复制访问地址。")

    try:
        while thread.is_alive():
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n收到退出指令，正在关闭服务器...")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        print("服务器已关闭，再见！")


if __name__ == "__main__":
    main()


