@echo off
REM Script de inicialização para Windows

echo ============================================
echo    UniVision Brasil - Setup Windows
echo ============================================
echo.

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale Node.js 18 ou superior
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

REM Perguntar método de instalação
echo Escolha o metodo de instalacao:
echo 1) Docker (Recomendado - inclui MongoDB e Redis)
echo 2) Manual (requer MongoDB e Redis instalados)
echo.
set /p choice="Escolha (1 ou 2): "

if "%choice%"=="1" (
    REM Verificar Docker
    docker --version >nul 2>&1
    if errorlevel 1 (
        echo [ERRO] Docker nao encontrado!
        echo Por favor, instale Docker Desktop
        pause
        exit /b 1
    )
    
    echo.
    echo [INFO] Usando Docker Compose...
    echo.
    
    REM Copiar .env
    if not exist backend\.env (
        echo [INFO] Criando arquivo .env...
        copy backend\.env.example backend\.env
    )
    
    REM Build e start
    echo [INFO] Building containers...
    docker-compose build
    
    echo.
    echo [INFO] Iniciando servicos...
    docker-compose up -d
    
    echo.
    echo ============================================
    echo [OK] Servicos iniciados!
    echo ============================================
    echo.
    echo URLs disponiveis:
    echo   Web App: http://localhost:80
    echo   API:     http://localhost:3000
    echo   Health:  http://localhost:3000/health
    echo.
    echo Comandos uteis:
    echo   Ver logs:   docker-compose logs -f
    echo   Parar:      docker-compose down
    echo   Reiniciar:  docker-compose restart
    echo.
    
) else (
    echo.
    echo [INFO] Instalacao Manual...
    echo.
    
    REM Backend
    echo [INFO] Instalando dependencias do backend...
    cd backend
    if not exist .env (
        copy .env.example .env
        echo [INFO] Arquivo .env criado
    )
    call npm install
    cd ..
    
    REM Web App
    echo.
    echo [INFO] Instalando dependencias do web-app...
    cd web-app
    call npm install
    cd ..
    
    echo.
    echo ============================================
    echo [OK] Instalacao concluida!
    echo ============================================
    echo.
    echo ATENCAO: Antes de iniciar:
    echo   1. Configure backend\.env com suas credenciais
    echo   2. Inicie MongoDB
    echo   3. Inicie Redis
    echo.
    echo Para iniciar os servicos:
    echo.
    echo   Backend (terminal 1):
    echo   cd backend
    echo   npm run dev
    echo.
    echo   Web App (terminal 2):
    echo   cd web-app
    echo   npm run dev
    echo.
    echo URLs disponiveis:
    echo   Web App: http://localhost:3001
    echo   API:     http://localhost:3000
    echo.
)

echo.
echo Setup completo!
echo.
pause
