@echo off
rem 作用：双击后自动启动本地服务器并打开游戏页面
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PYTHON_BIN="
for %%P in (py python3 python) do (
  where %%P >nul 2>nul && (
    set "PYTHON_BIN=%%P"
    goto :FOUND
  )
)

:NO_PYTHON
echo 未找到 Python，请先安装 https://www.python.org/downloads/windows/ 然后重新双击本文件。
pause
exit /b 1

:FOUND
for /f "delims=" %%V in ('"%PYTHON_BIN%" --version 2^>^&1') do set "PY_VER=%%V"
echo 检测到 Python: !PY_VER!
echo 正在启动本地服务器，若防火墙提示请选择允许。
echo.

"%PYTHON_BIN%" "scripts\local_server.py"

echo.
echo 服务器已停止，可以关闭本窗口。
pause
exit /b 0

