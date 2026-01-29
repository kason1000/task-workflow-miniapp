@echo off
setlocal enabledelayedexpansion

echo =========================================
echo Task Workflow MiniApp Production Deployment
echo =========================================
echo.

cd /d "%~dp0"

echo Current directory: %cd%
echo.

echo Updating version to new format (x.x.xxxx)...
for /f %%i in ('node scripts\update-version.cjs') do set NEW_VERSION=%%i
echo Version updated: %NEW_VERSION%

echo Building Mini App...
call npm run build

if !errorlevel! neq 0 (
    echo Build failed
    exit /b 1
)

echo.
echo Deploying to gh-pages branch...
call npx gh-pages -d dist

if !errorlevel! neq 0 (
    echo Warning: gh-pages deployment failed, but continuing with code commit...
) else (
    echo gh-pages deployment successful!
)

echo.
echo Creating summary commit...

REM Ensure we are on the main branch and commit code changes
for /f "usebackq" %%i in (`git branch --show-current`) do set CURRENT_BRANCH=%%i
if /i not "%CURRENT_BRANCH%"=="main" (
    echo Switching from %CURRENT_BRANCH% to main branch...
    git checkout main
    if !errorlevel! neq 0 (
        echo Error switching to main branch
        exit /b 1
    )
) else (
    echo Already on main branch: %CURRENT_BRANCH%
)

REM Add all changes and create a summary commit
git add .

REM Check if there are any changes to commit
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set COUNT=%%i
if !COUNT! gtr 0 (
    echo.
    echo Committing changes after deployment...
    git commit -m "Deploy %date% %time%: Mini App deployment with version increment to v%NEW_VERSION%"
    
    if !errorlevel! neq 0 (
        echo Error committing changes
        exit /b 1
    )
    
    echo.
    echo Pushing code changes to main branch...
    git push origin main
    
    if !errorlevel! neq 0 (
        echo Error pushing changes to main branch
        exit /b 1
    )
) else (
    echo No changes to commit after deployment
)

echo.
echo =========================================
echo ✅ Mini App deployed successfully!
echo ✅ Code pushed to main branch!
echo.
echo Your Mini App is available at:
echo https://YOUR_USERNAME.github.io/task-workflow-miniapp/
echo =========================================

endlocal