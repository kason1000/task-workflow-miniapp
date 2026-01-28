@echo off
echo =========================================
echo Task Workflow MiniApp Production Deployment
echo =========================================

cd /d "%~dp0"

echo Current directory: %CD%

echo Updating version to new format (x.x.xxxx)...
for /f %%i in ('node scripts\version-manager.js build') do set NEW_VERSION=%%i
echo Version updated: %OLD_VERSION% -^> %NEW_VERSION%
echo Timestamp: %date% %time%
echo %NEW_VERSION%

echo Starting deployment...

REM Build the application
npm run build

REM Deploy to GitHub Pages
npx gh-pages -d dist -b gh-pages

REM Commit and push changes to main branch with deployment message
echo Committing changes with deployment message...
git add .
git status
for /f "tokens=*" %%i in ('date /t') do set DATE_VAR=%%i
for /f "tokens=*" %%i in ('time /t') do set TIME_VAR=%%i
git commit -m "Deployment: ^[%DATE_VAR% %TIME_VAR%^] Production build v%NEW_VERSION%" -m "Built and deployed production version %NEW_VERSION%" || echo No changes to commit
git push origin main || echo Push failed - please check git status

echo =========================================
echo Production deployment completed successfully!
echo =========================================