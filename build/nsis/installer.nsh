; --- Graceful app shutdown for install/uninstall ---
; Replaces electron-builder's default _CHECK_APP_RUNNING (1.3s then force-kill).
; Sends outclash://quit-for-update deep link to trigger graceful cleanup
; (TUN, system proxy, core), then force-kills as last resort.
!macro customCheckAppRunning
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    ; Signal the running app to quit gracefully via deep link
    DetailPrint `Closing running "${PRODUCT_NAME}"...`
    nsExec::ExecToLog 'cmd /c start outclash://quit-for-update'

    ; Wait up to 10 seconds for graceful cleanup
    StrCpy $R1 0
    cleanup_wait:
      IntOp $R1 $R1 + 1
      Sleep 1000
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 != 0
        Goto cleanup_done
      ${endIf}
      IntCmp $R1 10 force_kill 0 force_kill
      Goto cleanup_wait

    force_kill:
      ; App did not exit in time — force-kill as last resort
      nsExec::ExecToLog 'taskkill /f /im "${APP_EXECUTABLE_FILENAME}"'
      Sleep 1000

    cleanup_done:
  ${endIf}
!macroend

!macro customInit
  ; --- Migration from old Tauri/Koala Clash app ---
  ; Skip entirely if migration was already completed (i.e. this is an update)

  ; Force current user context to resolve $APPDATA correctly
  ; (perMachine installers may default to all-users context)
  SetShellVarContext current

  IfFileExists "$APPDATA\OutClash\.migration-done" migration_skip 0

  ; Check if old profiles.yaml exists and back it up
  ; Priority: old Tauri OutClash > old Tauri Koala Clash
  ; Try Roaming AppData first, then Local AppData as fallback
  IfFileExists "$APPDATA\io.github.outclash\profiles.yaml" 0 check_outclash_local
    CopyFiles /SILENT "$APPDATA\io.github.outclash\profiles.yaml" "$TEMP\outclash-migration-profiles.yaml"
    Goto backup_done
  check_outclash_local:
  IfFileExists "$LOCALAPPDATA\io.github.outclash\profiles.yaml" 0 check_koala_appdata
    CopyFiles /SILENT "$LOCALAPPDATA\io.github.outclash\profiles.yaml" "$TEMP\outclash-migration-profiles.yaml"
    Goto backup_done
  check_koala_appdata:
  IfFileExists "$APPDATA\io.github.koala-clash\profiles.yaml" 0 check_koala_local
    CopyFiles /SILENT "$APPDATA\io.github.koala-clash\profiles.yaml" "$TEMP\outclash-migration-profiles.yaml"
    Goto backup_done
  check_koala_local:
  IfFileExists "$LOCALAPPDATA\io.github.koala-clash\profiles.yaml" 0 backup_done
    CopyFiles /SILENT "$LOCALAPPDATA\io.github.koala-clash\profiles.yaml" "$TEMP\outclash-migration-profiles.yaml"
  backup_done:

  ; Old Tauri OutClash has the same productName — electron-builder's
  ; built-in uninstallOldVersion handles it automatically after user
  ; clicks Install (CHECK_APP_RUNNING + registry lookup).

  ; --- Old Koala Clash (different product name, needs manual lookup) ---
  IfFileExists "$PROGRAMFILES\Koala Clash\uninstall.exe" 0 check_koala_pf64
    ExecWait '"$PROGRAMFILES\Koala Clash\uninstall.exe" /S _?=$PROGRAMFILES\Koala Clash'
    Goto uninstall_done
  check_koala_pf64:
  IfFileExists "$PROGRAMFILES64\Koala Clash\uninstall.exe" 0 check_koala_registry
    ExecWait '"$PROGRAMFILES64\Koala Clash\uninstall.exe" /S _?=$PROGRAMFILES64\Koala Clash'
    Goto uninstall_done
  check_koala_registry:
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Koala Clash" "UninstallString"
    StrCmp $0 "" check_koala_registry_user run_koala_uninstaller
  check_koala_registry_user:
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Koala Clash" "UninstallString"
    StrCmp $0 "" uninstall_done run_koala_uninstaller
  run_koala_uninstaller:
    ExecWait '"$0" /S'

  uninstall_done:
  migration_skip:

  ; Restore context for the rest of the installer
  SetShellVarContext all
!macroend

!macro customInstall
  ; --- Copy migration file to new app data directory ---
  SetShellVarContext current
  IfFileExists "$TEMP\outclash-migration-profiles.yaml" 0 no_migration_file
    CreateDirectory "$APPDATA\OutClash"
    CopyFiles /SILENT "$TEMP\outclash-migration-profiles.yaml" "$APPDATA\OutClash\.migration-profiles.yaml"
    Delete "$TEMP\outclash-migration-profiles.yaml"
  no_migration_file:

  ; --- Fallback: clean up old Tauri OutClash if electron-builder missed it ---
  ; electron-builder's uninstallOldVersion already ran before this point.
  ; If it found and removed the old Tauri OutClash, the registry entry is gone.
  ; If not, we clean it up here (after user already confirmed installation).
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OutClash" "UninstallString"
  StrCmp $0 "" check_outclash_hkcu_post run_outclash_post
  check_outclash_hkcu_post:
  ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OutClash" "UninstallString"
  StrCmp $0 "" outclash_cleanup_done run_outclash_post
  run_outclash_post:
  ExecWait '"$0" /S'
  outclash_cleanup_done:

  SetShellVarContext all
!macroend
