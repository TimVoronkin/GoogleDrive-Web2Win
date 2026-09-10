@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   GoogleDrive-Web2Win - Native Host Installer
echo ========================================================
echo.
echo This script registers the Chrome extension in Windows to open folders in Explorer.
echo.

set "CURRENT_DIR=%~dp0"
set "HOST_BAT_PATH=%CURRENT_DIR%host.bat"
set "MANIFEST_PATH=%CURRENT_DIR%com.google_drive_to_explorer.json"
set "EXTENSION_ID=flnbloncdemcocjfkognmgkgnjoaajmf"

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

set "KEY_NAME=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.google_drive_to_explorer"
reg add "%KEY_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

if %ERRORLEVEL% EQU 0 goto :reg_ok
echo [ERROR] Failed to update Windows Registry.
goto :check_python

:reg_ok
echo [SUCCESS] Extension successfully registered in Windows!

:check_python
echo.
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :py_ok
echo [WARNING] Python was not found on this computer!
echo To use the Open in Explorer feature, please download Python from https://www.python.org
echo and make sure to check "Add Python to PATH" during installation.
goto :done

:py_ok
echo [OK] Python found in system.

:done
echo.
echo Press any key to close this window...
pause >nul
