@echo off
title File Chess.com PGNs
cd /d "%~dp0"
python "%~dp0file_pgns.py" %*
set "result=%errorlevel%"
echo.
pause
exit /b %result%
