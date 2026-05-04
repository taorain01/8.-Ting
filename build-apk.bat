@echo off
set JAVA_HOME=C:\Users\songt\.ting-android-toolchain\jdk21\jdk-21.0.7+6
set ANDROID_SDK_ROOT=C:\Users\songt\.ting-android-toolchain\android-sdk
cd /d "%~dp0android"
call gradlew.bat assembleDebug
echo.
echo === APK location ===
dir /s /b app\build\outputs\apk\debug\*.apk 2>nul
