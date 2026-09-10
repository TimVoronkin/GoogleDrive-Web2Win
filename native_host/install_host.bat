@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

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
echo.
echo [INFO] Detecting Google Drive Desktop installation...
python "%CURRENT_DIR%detect_drive.py" >nul 2>&1

if exist "%CURRENT_DIR%config.json" (
    findstr /C:"\"installed\": true" "%CURRENT_DIR%config.json" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [SUCCESS] Google Drive Desktop detected successfully!
        for /f "tokens=2 delims=:," %%A in ('findstr /C:"\"driveLetter\"" "%CURRENT_DIR%config.json"') do (
            set "DL=%%~A"
            set "DL=!DL:"=!"
            set "DL=!DL: =!"
        )
        for /f "tokens=2 delims=:" %%B in ('findstr /C:"\"driveRootName\"" "%CURRENT_DIR%config.json"') do (
            set "DR=%%~B"
            set "DR=!DR:"=!"
            set "DR=!DR:~1!"
        )
        echo        Drive Letter: !DL!:
        echo        Root Folder:  !DR!
    ) else (
        echo [WARNING] Google Drive Desktop was not detected on this computer.
        echo           Please make sure Google Drive Desktop is installed and running.
    )
) else (
    echo [WARNING] Could not run Google Drive detection script.
)

:done
echo.
echo Press any key to close this window...
pause >nul

