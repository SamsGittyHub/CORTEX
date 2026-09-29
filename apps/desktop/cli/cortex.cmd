@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\CORTEX.exe" --expose-internals "%~dp0..\..\..\app.asar\cortex\node_modules\@cortex-ai\cortex-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
