!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

!macro closeRunningTing
  DetailPrint "Closing Ting! if it is running..."

  ; Old builds hide to tray on WM_CLOSE, so do not launch Ting.exe here.
  ${nsProcess::CloseProcess} "Ting.exe" $0
  Sleep 1500
  ${nsProcess::KillProcess} "Ting.exe" $0
  Sleep 500
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-Process -Name Ting -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"' $0
  ClearErrors
!macroend

!macro customInit
  !insertmacro closeRunningTing
!macroend

!macro removeRegisteredTingInstall ROOT_KEY
  ClearErrors
  ReadRegStr $2 ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $2 != ""
    DetailPrint "Removing old Ting! install files from $2"
    SetOutPath "$TEMP"
    RMDir /r "$2"
  ${endif}

  DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY_2}"
  !endif
  DeleteRegKey ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}"
  ClearErrors
!macroend

!macro removeOldTingInstall
  DetailPrint "Preparing a clean Ting! install..."
  SetOutPath "$TEMP"

  !insertmacro removeRegisteredTingInstall HKCU
  !insertmacro removeRegisteredTingInstall HKLM

  ${if} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "Removing old Ting! install files from $INSTDIR"
    RMDir /r "$INSTDIR"
  ${endif}

  ClearErrors
!macroend

!macro customCheckAppRunning
  !insertmacro closeRunningTing
  !ifndef BUILD_UNINSTALLER
    !insertmacro removeOldTingInstall
  !endif
!macroend

!macro retryRegisteredTingUninstall ROOT_KEY INSTALL_MODE_ARG
  ${if} $R0 != 0
    ClearErrors
    ReadRegStr $1 ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}" QuietUninstallString
    ${if} $1 == ""
      ReadRegStr $1 ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}" UninstallString
      ${if} $1 != ""
        StrCpy $1 "$1 /S"
      ${endif}
    ${endif}

    ${if} $1 != ""
      DetailPrint "Retrying Ting! uninstall from ${ROOT_KEY} registry."
      !insertmacro closeRunningTing
      ExecWait '$1 /KEEP_APP_DATA --updated' $R0
    ${endif}
  ${endif}
!macroend

!macro fallbackUninstallOldTing INSTALL_MODE_ARG
  ${if} $R0 != 0
    DetailPrint "Default uninstall returned $R0. Retrying Ting! uninstall without --updated."
    !insertmacro closeRunningTing
    ${if} ${FileExists} "$INSTDIR\Uninstall Ting.exe"
      ExecWait '"$INSTDIR\Uninstall Ting.exe" /S ${INSTALL_MODE_ARG} /KEEP_APP_DATA --updated' $R0
    ${endif}
  ${endif}

  !insertmacro retryRegisteredTingUninstall HKCU ${INSTALL_MODE_ARG}
  !insertmacro retryRegisteredTingUninstall HKLM ${INSTALL_MODE_ARG}

  ${if} $R0 != 0
    DetailPrint "Retrying Ting! uninstall from the per-user install directory."
    !insertmacro closeRunningTing
    ${if} ${FileExists} "$LOCALAPPDATA\Programs\Ting\Uninstall Ting.exe"
      ExecWait '"$LOCALAPPDATA\Programs\Ting\Uninstall Ting.exe" /S ${INSTALL_MODE_ARG} /KEEP_APP_DATA --updated' $R0
    ${endif}
  ${endif}

  ${if} $R0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0"
    DetailPrint "Fallback uninstall was not successful. Uninstaller error code: $R0."
    SetErrorLevel 2
    Quit
  ${endif}

  ClearErrors
!macroend

!macro customUnInstallCheck
  ${if} $installMode == "all"
    !insertmacro fallbackUninstallOldTing /allusers
  ${else}
    !insertmacro fallbackUninstallOldTing /currentuser
  ${endif}
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro fallbackUninstallOldTing /currentuser
!macroend

!macro customInstall
  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    Delete "$newStartMenuLink"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  !endif

  !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
    ${ifNot} ${isNoDesktopShortcut}
      Delete "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${endif}
  !endif

  ${if} $installMode != "all"
    StrCpy $0 "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\${SHORTCUT_NAME}.lnk"
    ${if} ${FileExists} "$0"
      Delete "$0"
      CreateShortCut "$0" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$0" "${APP_ID}"
    ${endif}

    StrCpy $0 "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\$oldShortcutName.lnk"
    ${if} $oldShortcutName != "${SHORTCUT_NAME}"
    ${andIf} ${FileExists} "$0"
      Delete "$0"
      CreateShortCut "$0" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$0" "${APP_ID}"
    ${endif}
  ${endif}

  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ExecWait '"$SYSDIR\ie4uinit.exe" -show'
!macroend
