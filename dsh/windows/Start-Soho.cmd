@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Soho.ps1" -RepositoryRoot "%~dp0..\.." %*
exit /b %ERRORLEVEL%
