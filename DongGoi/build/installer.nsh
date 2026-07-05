!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

!define TING_COLOR_PRIMARY 0x6C5CE7
!define TING_COLOR_PRIMARY_SOFT 0xF1EEFF
!define TING_COLOR_TEXT 0x1A1A2E
!define TING_COLOR_MUTED 0x6B7280
!define TING_COLOR_PANEL 0xF8FAFC
!define TING_COLOR_BORDER 0xE5E7EB
!define TING_COLOR_SUCCESS 0x10B981
!define TING_COLOR_AMBER 0xF59E0B

!ifndef BUILD_UNINSTALLER
Var TingWelcomeAccent
Var TingWelcomeBrandPill
Var TingWelcomeTitle
Var TingWelcomeSubtitle
Var TingWelcomePanel
Var TingWelcomeMeta
Var TingWelcomeInstallButton
Var TingWelcomeFontTitle
Var TingWelcomeFontSubtitle
Var TingWelcomeFontBody
Var TingWelcomeFontSmall
Var TingWelcomeFontButton

!macro customWelcomePage
  Page custom TingWelcomePageCreate TingWelcomePageLeave
!macroend

!macro customInstallMode
  ${if} $hasPerMachineInstallation == "1"
  ${andIf} $hasPerUserInstallation == "0"
    StrCpy $isForceMachineInstall "1"
  ${else}
    StrCpy $isForceCurrentInstall "1"
  ${endif}
!macroend

Function TingWelcomePageCreate
  nsDialogs::Create 1018
  Pop $0
  ${if} $0 == error
    Abort
  ${endif}

  CreateFont $TingWelcomeFontTitle "Segoe UI" 22 700
  CreateFont $TingWelcomeFontSubtitle "Segoe UI" 10 600
  CreateFont $TingWelcomeFontBody "Segoe UI" 9 400
  CreateFont $TingWelcomeFontSmall "Segoe UI" 8 600
  CreateFont $TingWelcomeFontButton "Segoe UI" 11 700

  ${NSD_CreateLabel} 0u 0u 5u 196u ""
  Pop $TingWelcomeAccent
  SetCtlColors $TingWelcomeAccent ${TING_COLOR_PRIMARY} ${TING_COLOR_PRIMARY}

  ${NSD_CreateLabel} 14u 2u 94u 15u "  TING! INSTALLER"
  Pop $TingWelcomeBrandPill
  SendMessage $TingWelcomeBrandPill ${WM_SETFONT} $TingWelcomeFontSmall 1
  SetCtlColors $TingWelcomeBrandPill ${TING_COLOR_PRIMARY} ${TING_COLOR_PRIMARY_SOFT}

  ${NSD_CreateLabel} 14u 22u 272u 29u "Cài đặt Ting!"
  Pop $TingWelcomeTitle
  SendMessage $TingWelcomeTitle ${WM_SETFONT} $TingWelcomeFontTitle 1
  SetCtlColors $TingWelcomeTitle ${TING_COLOR_PRIMARY} transparent

  ${NSD_CreateLabel} 14u 52u 272u 16u "Bản mới sẵn sàng, dữ liệu của bạn vẫn được giữ nguyên."
  Pop $TingWelcomeSubtitle
  SendMessage $TingWelcomeSubtitle ${WM_SETFONT} $TingWelcomeFontSubtitle 1
  SetCtlColors $TingWelcomeSubtitle ${TING_COLOR_TEXT} transparent

  ${NSD_CreateLabel} 14u 76u 272u 56u ""
  Pop $TingWelcomePanel
  SetCtlColors $TingWelcomePanel ${TING_COLOR_PANEL} ${TING_COLOR_PANEL}

  ${NSD_CreateLabel} 26u 86u 6u 6u ""
  Pop $0
  SetCtlColors $0 ${TING_COLOR_PRIMARY} ${TING_COLOR_PRIMARY}

  ${NSD_CreateLabel} 40u 82u 236u 13u "Tự đóng Ting! đang chạy trước khi cập nhật"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $TingWelcomeFontBody 1
  SetCtlColors $0 ${TING_COLOR_TEXT} ${TING_COLOR_PANEL}

  ${NSD_CreateLabel} 26u 103u 6u 6u ""
  Pop $0
  SetCtlColors $0 ${TING_COLOR_SUCCESS} ${TING_COLOR_SUCCESS}

  ${NSD_CreateLabel} 40u 99u 236u 13u "Giữ nguyên tài khoản, nhóm và cài đặt cá nhân"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $TingWelcomeFontBody 1
  SetCtlColors $0 ${TING_COLOR_TEXT} ${TING_COLOR_PANEL}

  ${NSD_CreateLabel} 26u 120u 6u 6u ""
  Pop $0
  SetCtlColors $0 ${TING_COLOR_AMBER} ${TING_COLOR_AMBER}

  ${NSD_CreateLabel} 40u 116u 236u 13u "Cài bản mới vào đường dẫn mặc định"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $TingWelcomeFontBody 1
  SetCtlColors $0 ${TING_COLOR_TEXT} ${TING_COLOR_PANEL}

  ${NSD_CreateLabel} 14u 142u 272u 1u ""
  Pop $0
  SetCtlColors $0 ${TING_COLOR_BORDER} ${TING_COLOR_BORDER}

  ${NSD_CreateButton} 14u 153u 272u 34u "Cài đặt Ting! ngay"
  Pop $TingWelcomeInstallButton
  SendMessage $TingWelcomeInstallButton ${WM_SETFONT} $TingWelcomeFontButton 1
  SetCtlColors $TingWelcomeInstallButton 0xFFFFFF ${TING_COLOR_PRIMARY}
  ${NSD_OnClick} $TingWelcomeInstallButton TingWelcomeInstallClick

  ${NSD_CreateLabel} 14u 191u 272u 12u "Phiên bản ${VERSION}  |  Đường dẫn cài đặt mặc định"
  Pop $TingWelcomeMeta
  SendMessage $TingWelcomeMeta ${WM_SETFONT} $TingWelcomeFontSmall 1
  SetCtlColors $TingWelcomeMeta ${TING_COLOR_MUTED} transparent

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Cài đặt ngay"

  nsDialogs::Show
FunctionEnd

Function TingWelcomeInstallClick
  Pop $0
  SendMessage $TingWelcomeInstallButton ${WM_SETTEXT} 0 "STR:Đang chuẩn bị..."
  EnableWindow $TingWelcomeInstallButton 0
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function TingWelcomePageLeave
FunctionEnd
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
