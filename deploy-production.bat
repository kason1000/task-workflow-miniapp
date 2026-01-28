@echo off
setlocal enabledelayedexpansion

echo =========================================
echo Task Workflow MiniApp Production Deployment
echo =========================================
echo.

echo Building Mini App...
call npm run build

if !errorlevel! neq 0 (
    echo Build failed
    exit /b 1
)

echo.
echo Deploying to gh-pages branch...
npx gh-pages -d dist

if !errorlevel! neq 0 (
    echo Deployment failed
    exit /b 1
)

echo.
echo Deployment successful! Creating summary commit...

REM Add all changes and create a summary commit
git add .

REM Check if there are any changes to commit
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set COUNT=%%i
if !COUNT! gtr 0 (
    echo.
    echo Committing changes after successful deployment...
    git commit -m "Deploy %date% %time%: Mini App deployment with version update to v1.1.0024"
    
    if !errorlevel! neq 0 (
        echo Error committing changes
        exit /b 1
    )
    
    echo.
    echo Pushing changes to remote repository...
    git push
    
    if !errorlevel! neq 0 (
        echo Error pushing changes
        exit /b 1
    )
) else (
    echo No changes to commit after deployment
)

echo.
echo =========================================
echo ✅ Mini App deployed successfully!
echo.
echo Your Mini App is available at:
echo https://YOUR_USERNAME.github.io/task-workflow-miniapp/
echo =========================================

endlocal