@echo off
chcp 65001 >nul
cd /d "%~dp0"
where bash >nul 2>nul
if %errorlevel%==0 (
  bash deploy-pages.sh
) else (
  for %%p in ("%ProgramFiles%\Git\bin\bash.exe" "%ProgramFiles(x86)%\Git\bin\bash.exe") do (
    if exist %%p (
      %%p deploy-pages.sh
      goto :done
    )
  )
  echo [X] bash not found. Please install Git for Windows.
)
:done
echo.
pause
