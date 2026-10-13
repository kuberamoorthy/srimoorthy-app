@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   SRI MOORTHY FLEET - 1-CLICK FLUTTER APK BUILDER
echo ========================================================
echo.

REM 1. Check if Flutter already exists in known paths
if exist "C:\flutter\bin\flutter.bat" (
    echo [OK] Found Flutter in C:\flutter\bin
    set "PATH=C:\flutter\bin;%PATH%"
    goto :FLUTTER_READY
)

if exist "%USERPROFILE%\flutter\bin\flutter.bat" (
    echo [OK] Found Flutter in %USERPROFILE%\flutter\bin
    set "PATH=%USERPROFILE%\flutter\bin;%PATH%"
    goto :FLUTTER_READY
)

where flutter >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Flutter is already in your PATH
    goto :FLUTTER_READY
)

REM 2. Look for Flutter ZIP in common locations
set "ZIP_PATH="
if exist "C:\Google\flutter_windows_3.47.7-stable.zip" set "ZIP_PATH=C:\Google\flutter_windows_3.47.7-stable.zip"
if not defined ZIP_PATH (
    for %%f in ("%USERPROFILE%\Downloads\flutter_windows*.zip") do if exist "%%f" set "ZIP_PATH=%%f"
)
if not defined ZIP_PATH (
    for %%f in ("C:\Downloads\flutter_windows*.zip") do if exist "%%f" set "ZIP_PATH=%%f"
)
if not defined ZIP_PATH (
    for %%f in ("%USERPROFILE%\Desktop\flutter_windows*.zip") do if exist "%%f" set "ZIP_PATH=%%f"
)

if not defined ZIP_PATH (
    echo.
    echo [i] Could not find Flutter ZIP automatically.
    echo Please drag and drop your Flutter ZIP file here and press Enter:
    set /p "ZIP_PATH=ZIP File Path: "
    set "ZIP_PATH=!ZIP_PATH:"=!"
)

if exist "!ZIP_PATH!" (
    echo.
    echo [*] Found: !ZIP_PATH!
    echo [*] Extracting to C:\flutter ... (Please wait 1-2 minutes)
    powershell -Command "Expand-Archive -Path '!ZIP_PATH!' -DestinationPath 'C:\' -Force"
    if exist "C:\flutter\bin\flutter.bat" (
        echo [OK] Flutter extracted successfully to C:\flutter!
        set "PATH=C:\flutter\bin;%PATH%"
        goto :FLUTTER_READY
    ) else (
        echo [ERROR] Extraction did not create C:\flutter\bin\flutter.bat.
        echo Please manually right-click the zip, Extract All to C:\, then run this again.
        pause
        exit /b 1
    )
) else (
    echo [ERROR] The file "!ZIP_PATH!" does not exist.
    pause
    exit /b 1
)

:FLUTTER_READY
echo.
echo [*] Syncing latest web assets into Flutter app...
python sync_flutter_assets.py 2>nul

echo.
echo [*] Entering flutter_app directory...
cd /d "%~dp0flutter_app"

echo.
echo [*] Fetching Flutter dependencies (flutter pub get)...
call flutter pub get

echo.
echo [*] Building Release APK (flutter build apk --release)...
echo [*] Please wait a moment while the APK compiles...
call flutter build apk --release

if exist "build\app\outputs\flutter-apk\app-release.apk" (
    echo.
    echo ========================================================
    echo   [SUCCESS] APK COMPILED SUCCESSFULLY!
    echo ========================================================
    
    copy "build\app\outputs\flutter-apk\app-release.apk" "%USERPROFILE%\Desktop\SriMoorthyFleet.apk" >nul 2>nul
    if exist "%USERPROFILE%\Desktop\SriMoorthyFleet.apk" (
        echo [*] Copied APK directly to your Desktop:
        echo     %USERPROFILE%\Desktop\SriMoorthyFleet.apk
    ) else (
        echo [*] APK Location:
        echo     %~dp0flutter_app\build\app\outputs\flutter-apk\app-release.apk
    )
    
    echo.
    echo [*] Checking if Android phone is connected via USB...
    call flutter devices | findstr /i "android" >nul
    if %errorlevel% equ 0 (
        echo [*] Connected phone detected! Installing directly to your phone...
        call flutter install
        echo [OK] Installed on your phone!
    ) else (
        echo [i] No USB phone detected.
        echo     Simply send 'SriMoorthyFleet.apk' from your Desktop to your phone via WhatsApp!
    )
) else (
    echo.
    echo ========================================================
    echo   [NOTICE] APK BUILD FAILED OR ANDROID SDK MISSING
    echo ========================================================
    echo.
    echo If the error says "Unable to locate Android SDK":
    echo 1. Install Android Studio (includes Android SDK):
    echo    https://developer.android.com/studio
    echo.
    echo 2. OR use the 1-Click Cloud Builder (No setup needed!):
    echo    Push this project to GitHub and download the ready APK
    echo    from the Actions tab (.github/workflows/build_flutter_apk.yml)
    echo.
    echo 3. OR install directly from your phone's browser:
    echo    Open the website in Chrome on your phone and tap:
    echo    "Add to Home screen" / "Install app"
    echo ========================================================
)

echo.
echo Press any key to close...
pause >nul
