@echo off
chcp 65001 > nul
set BASE_DIR=%~dp0
echo ========================================================
echo     نظام إدارة محلات الصاغة والذهب الذكي (Gold SaaS)
echo ========================================================
echo.
echo تشغيل الخادم الخلفي (Flask Backend)...
start "Gold SaaS Backend" cmd /k "cd /d ""%BASE_DIR%backend"" && ""%BASE_DIR%backend\venv\Scripts\python.exe"" flask_app.py"

timeout /t 2 /nobreak > nul

echo تشغيل واجهة المستخدم (Vite React Frontend)...
start "Gold SaaS Frontend" cmd /k "cd /d ""%BASE_DIR%frontend"" && npm.cmd run dev"

timeout /t 3 /nobreak > nul

echo فتح النظام في المتصفح...
start http://localhost:5174

echo.
echo النظام يعمل الآن بنجاح!
echo الواجهة: http://localhost:5174
echo السيرفر: http://localhost:8000
echo ========================================================
