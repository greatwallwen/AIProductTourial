@echo off
setlocal EnableExtensions

set "COURSE_ROOT=%~dp0"
if not defined TEMP set "TEMP=%LOCALAPPDATA%\Temp"
if not defined TMP set "TMP=%TEMP%"
if not defined NPM_CONFIG_CACHE set "NPM_CONFIG_CACHE=%LOCALAPPDATA%\npm-cache"
if not defined PLAYWRIGHT_BROWSERS_PATH set "PLAYWRIGHT_BROWSERS_PATH=%LOCALAPPDATA%\ms-playwright"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"

if not exist "%TEMP%" mkdir "%TEMP%" >nul 2>nul
if not exist "%NPM_CONFIG_CACHE%" mkdir "%NPM_CONFIG_CACHE%" >nul 2>nul
if not exist "%PLAYWRIGHT_BROWSERS_PATH%" mkdir "%PLAYWRIGHT_BROWSERS_PATH%" >nul 2>nul

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 24 or newer is required.
  exit /b 1
)

node.exe -e "const major=Number(process.versions.node.split('.')[0]);process.exit(major>=24?0:1)" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 24 or newer is required for node:sqlite.
  exit /b 1
)

pushd "%COURSE_ROOT%code" 2>nul
if errorlevel 1 (
  echo [ERROR] Cannot enter %COURSE_ROOT%code
  exit /b 1
)

if not exist "node_modules\next\package.json" (
  echo [SETUP] Installing locked course dependencies...
  call npm.cmd ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo [ERROR] Dependency installation failed.
    exit /b 1
  )
)

if /I "%MODE%"=="dev" goto dev
if /I "%MODE%"=="rebuild" goto rebuild
if /I not "%MODE%"=="prod" (
  popd
  echo [ERROR] Usage: run.bat [prod^|dev^|rebuild]
  exit /b 2
)

if not exist "app\.next\BUILD_ID" goto rebuild
goto start

:rebuild
echo [BUILD] Preparing the production course application...
call npm.cmd run build
if errorlevel 1 (
  popd
  echo [ERROR] Production build failed.
  exit /b 1
)

:start
echo [START] AI Product Engineering
echo [URL]   http://127.0.0.1:3200
echo [STOP]  Press Ctrl+C in this window.
call npm.cmd run start
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%

:dev
echo [START] AI Product Engineering - development mode
echo [URL]   http://127.0.0.1:3200
echo [STOP]  Press Ctrl+C in this window.
call npm.cmd run dev
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
