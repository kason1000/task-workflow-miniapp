@echo off
echo =========================================
echo Task Workflow MiniApp Quick Setup
echo =========================================

REM Enable delayed variable expansion to handle variables in loops
setlocal enabledelayedexpansion

REM Install dependencies
echo Installing dependencies...
npm install

REM Create initial version file if it doesn't exist
if not exist "VERSION" (
    echo Creating initial VERSION file...
    echo 1.1.0001 > VERSION
)

REM Create version.json if it doesn't exist
if not exist "public\version.json" (
    echo Creating initial version.json...
    if not exist "public" mkdir public
    
    REM Read the actual version from VERSION file
    for /f %%i in (VERSION) do set VERSION_NUM=%%i
    (
    echo {
    echo   "version": "!VERSION_NUM!",
    echo   "timestamp": "%date:~10,4%-%date:~4,2%-%date:~7,2%T%time:~0,8%.000Z"
    echo }
    ) > public\version.json
)

echo Setup completed!
echo Current version: 
type VERSION
echo.
echo Available commands:
echo   npm run dev          - Start development server
echo   npm run build        - Build for production
echo   npm run deploy       - Deploy to hosting
echo   npm run version:major - Increment major version
echo   npm run version:minor - Increment minor version
echo   npm run version:patch - Increment patch/build version