@echo off
set "JAVA_HOME=C:\Users\songt\.ting-android-toolchain\jdk21\jdk-21.0.7+6"
set "SDK_ROOT=C:\Users\songt\.ting-android-toolchain\android-sdk"

echo === Creating license acceptance files ===
mkdir "%SDK_ROOT%\licenses" 2>nul

echo 24333f8a63b6825ea9c5514f83c2829b004d1fee > "%SDK_ROOT%\licenses\android-sdk-license"
echo d56f5187479451eabf01fb78af6dfcb131a6481e >> "%SDK_ROOT%\licenses\android-sdk-license"
echo 859f317696f67ef3d7f30a50a5560e7834b43903 >> "%SDK_ROOT%\licenses\android-sdk-license"

echo 84831b9409646a918e30573bab4c9c91346d8abd > "%SDK_ROOT%\licenses\android-sdk-preview-license"

echo d975f751698a77e662f1cd748a3e422ad05a0abc > "%SDK_ROOT%\licenses\intel-android-extra-license"

echo === Installing SDK packages ===
"%SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="%SDK_ROOT%" "platforms;android-35" "build-tools;35.0.0" "platform-tools"

echo === Done ===
