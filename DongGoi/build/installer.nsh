!macro closeRunningTing
  DetailPrint "Closing Ting! if it is running..."

  ; Old builds hide to tray on WM_CLOSE, so do not launch Ting.exe here.
  ExecWait '$SYSDIR\cmd.exe /C taskkill /IM Ting.exe /T >NUL 2>NUL'
  Sleep 1500
  ExecWait '$SYSDIR\cmd.exe /C taskkill /IM Ting.exe /T /F >NUL 2>NUL'
  ClearErrors
!macroend

!macro customInit
  !insertmacro closeRunningTing
!macroend

!macro fallbackUninstallOldTing INSTALL_MODE_ARG
  ${if} $R0 != 0
    DetailPrint "Default uninstall returned $R0. Retrying Ting! uninstall without --updated."
    !insertmacro closeRunningTing
    ${if} ${FileExists} "$INSTDIR\Uninstall Ting.exe"
      ExecWait '"$INSTDIR\Uninstall Ting.exe" /S ${INSTALL_MODE_ARG}' $R0
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
