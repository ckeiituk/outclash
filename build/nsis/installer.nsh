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

  ; Try to find and run old uninstallers
  ; --- Old Tauri OutClash ---
  IfFileExists "$PROGRAMFILES\OutClash\uninstall.exe" 0 check_outclash_pf64
    ExecWait '"$PROGRAMFILES\OutClash\uninstall.exe" /S _?=$PROGRAMFILES\OutClash'
    Goto check_koala_uninstall
  check_outclash_pf64:
  IfFileExists "$PROGRAMFILES64\OutClash\uninstall.exe" 0 check_outclash_registry
    ExecWait '"$PROGRAMFILES64\OutClash\uninstall.exe" /S _?=$PROGRAMFILES64\OutClash'
    Goto check_koala_uninstall
  check_outclash_registry:
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OutClash" "UninstallString"
    StrCmp $0 "" check_outclash_registry_user run_outclash_uninstaller
  check_outclash_registry_user:
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\OutClash" "UninstallString"
    StrCmp $0 "" check_koala_uninstall run_outclash_uninstaller
  run_outclash_uninstaller:
    ExecWait '"$0" /S'

  ; --- Old Koala Clash ---
  check_koala_uninstall:
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
  SetShellVarContext all
!macroend
