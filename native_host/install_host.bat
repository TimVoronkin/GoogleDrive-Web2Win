@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Google Drive to Explorer - Installer
echo ========================================
echo.

:: Get the current directory (where this script is)
set "CURRENT_DIR=%~dp0"

:: Path to host.bat (absolute)
set "HOST_BAT_PATH=%CURRENT_DIR%host.bat"

:: Path to the manifest file that will be created
set "MANIFEST_PATH=%CURRENT_DIR%com.google_drive_to_explorer.json"

:: Prompt user for Extension ID
echo.
echo Please enter your Chrome Extension ID:
echo (You can find it at chrome://extensions/ after loading the extension)
echo.
set /p EXTENSION_ID="Extension ID: "

:: Validate input
if "%EXTENSION_ID%"=="" (
    echo ERROR: Extension ID cannot be empty!
    pause
    exit /b 1
)

:: Create the manifest file
echo.
echo Creating manifest file...

:: Write the JSON file directly
(
echo {
echo     "name": "com.google_drive_to_explorer",
echo     "description": "Native Host to open Google Drive folders in Explorer",
echo     "path": "%HOST_BAT_PATH:\=\\%",
echo     "type": "stdio",
echo     "allowed_origins": [
echo         "chrome-extension://%EXTENSION_ID%/"
echo     ]
echo }
) > "%MANIFEST_PATH%"

if exist "%MANIFEST_PATH%" (
    echo Manifest configured successfully!
    echo   - Path: %HOST_BAT_PATH%
    echo   - Extension ID: %EXTENSION_ID%
    echo.
) else (
    echo [ERROR] Failed to create manifest file!
    pause
    exit /b 1
)

:: Define the Registry Key Name
set "KEY_NAME=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.google_drive_to_explorer"

:: Register in Windows Registry
echo Registering Native Host in Windows Registry...
reg add "%KEY_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Native Host installed.
    echo ========================================
    echo.
    echo Registry Key: %KEY_NAME%
    echo Manifest: %MANIFEST_PATH%
    echo.
    echo You can now use the extension in Chrome!
    echo.
) else (
    echo.
    echo ERROR: Failed to register in registry.
    echo Try running this script as Administrator.
    echo.
)

pause
