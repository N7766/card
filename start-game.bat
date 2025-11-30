@echo off
rem Simple start script for the card game

rem Go to the folder of this script (project root)
cd /d "%~dp0"

rem Try to find a Python executable: py, python, python3
set "PYTHON_BIN="

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_BIN=py"
)

if "%PYTHON_BIN%"=="" (
    where python >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_BIN=python"
    )
)

if "%PYTHON_BIN%"=="" (
    where python3 >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_BIN=python3"
    )
)

if "%PYTHON_BIN%"=="" (
    echo Python is not installed or not in PATH.
    echo Please install it from https://www.python.org/ and then run this file again.
    pause
    exit /b 1
)

echo Using %PYTHON_BIN% to start local server...

set "PORT=8000"

rem Start http.server in background
start "" "%PYTHON_BIN%" -m http.server %PORT%

rem Wait a bit for the server to start
ping 127.0.0.1 -n 2 >nul

rem Open default browser to the game
start "" "http://localhost:%PORT%/index.html"

echo.
echo Game URL: http://localhost:%PORT%/index.html
echo If the page does not open, copy this URL into your browser.
pause
exit /b 0