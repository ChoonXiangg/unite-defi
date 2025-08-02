@echo off
echo ========================================
echo Unite DeFi Cross-Chain UI Setup
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and make sure to add it to PATH
    echo.
    echo After installation, restart this script.
    pause
    exit /b 1
)

echo ✅ Node.js is installed
node --version

echo.
echo Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ✅ Dependencies installed successfully
echo.
echo Starting development server...
echo.
echo The application will be available at: http://localhost:3000
echo.
echo Pages available:
echo   - Home (Create Order): http://localhost:3000/
echo   - Orderbook: http://localhost:3000/orderbook  
echo   - Process (Track Orders): http://localhost:3000/process
echo.

npm run dev