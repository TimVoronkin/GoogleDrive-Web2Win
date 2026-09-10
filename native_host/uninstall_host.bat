@echo off
setlocal

echo ========================================================
echo   GoogleDrive-Web2Win - Native Host Uninstaller
echo ========================================================
echo.
echo This script removes Native Host registration from Windows Registry.
echo.

set "KEY_NAME=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.google_drive_to_explorer"
set "CURRENT_DIR=%~dp0"
set "MANIFEST_FILE=%CURRENT_DIR%com.google_drive_to_explorer.json"

reg query "%KEY_NAME%" >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :no_reg
reg delete "%KEY_NAME%" /f >nul 2>&1
echo [OK] Registry entry successfully removed.
goto :del_file

:no_reg
echo [INFO] Registry entry not found (may already be removed).

:del_file
if exist "%MANIFEST_FILE%" (
    del "%MANIFEST_FILE%" 2>nul
    echo [OK] Manifest configuration file deleted.
)

echo.
echo Uninstallation complete. Press any key to close this window...
pause >nul
