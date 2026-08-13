@echo off
setlocal enabledelayedexpansion

echo ========================================
echo           GoogleDrive-Web2Win
echo         Native Host Installer
echo ========================================
echo.

:: Get the current directory (where this script is)
set "CURRENT_DIR=%~dp0"

:: Path to host.bat (absolute)
set "HOST_BAT_PATH=%CURRENT_DIR%host.bat"

:: Path to the manifest file that will be created
set "MANIFEST_PATH=%CURRENT_DIR%com.google_drive_to_explorer.json"

set "DEFAULT_EXT_ID=mchnfkininhinkcocbigdejpknkpcdgf"

:: Prompt user for Extension ID
echo.
echo INSTRUCTIONS:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable "Developer mode" in the top right corner.
echo 3. Look for "GoogleDrive-Web2Win" in the list.
echo.
echo Default Extension ID: %DEFAULT_EXT_ID%
set "INPUT_ID="
set /p INPUT_ID="Please enter your Chrome Extension ID (Press ENTER for default [%DEFAULT_EXT_ID%]): "

if "!INPUT_ID!"=="" (
    set "EXTENSION_ID=!DEFAULT_EXT_ID!"
) else (
    set "EXTENSION_ID=!INPUT_ID!"
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
    echo     SUCCESS! Native Host installed.
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
