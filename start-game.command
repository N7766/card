#!/bin/bash
# 作用：双击后自动启动本地服务器并打开游戏页面

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "未找到 Python，请先安装 https://www.python.org/downloads/"
  read -p "按回车退出..." _
  exit 1
fi

echo "检测到 Python：$("$PYTHON_BIN" --version)"
echo "正在启动本地服务器，首次运行可能需要允许网络访问..."

"$PYTHON_BIN" "scripts/local_server.py"

echo ""
read -p "服务器已停止，按回车关闭窗口..." _

