@echo off
setlocal

echo ========================================
echo Google Drive to Explorer - Uninstaller
echo ========================================
echo.

:: Define the Registry Key Name
set "KEY_NAME=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.google_drive_to_explorer"

:: Get the current directory
set "CURRENT_DIR=%~dp0"

:: Path to the manifest file
set "MANIFEST_FILE=%CURRENT_DIR%com.google_drive_to_explorer.json"

echo This will:
echo   1. Remove the Native Host from Windows Registry
echo   2. Delete com.google_drive_to_explorer.json file
echo.
echo Press any key to continue or close this window to cancel...
pause >nul

:: Step 1: Delete Registry Key
echo.
echo 1. Removing registry key...
reg query "%KEY_NAME%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    reg delete "%KEY_NAME%" /f >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo   [OK] Registry key removed successfully.
    ) else (
        echo   [ERROR] Failed to remove registry key.
    )
) else (
    echo   [INFO] Registry key not found. It may already be uninstalled.
)

:: Step 2: Delete manifest file
echo.
echo 2. Deleting manifest file...

if exist "%MANIFEST_FILE%" (
    del "%MANIFEST_FILE%" 2>nul
    if exist "%MANIFEST_FILE%" (
        echo   [ERROR] Cannot delete file - it may be in use.
        echo   [INFO] Close any editors that have this file open and try again.
    ) else (
        echo   [OK] Manifest file deleted.
    )
) else (
    echo   [INFO] Manifest file not found (already deleted?)
)

:end
echo.
echo ========================================
echo Uninstallation complete!
echo ========================================
echo.
echo The extension will no longer work until you run install_host.bat again.
echo.
pause
