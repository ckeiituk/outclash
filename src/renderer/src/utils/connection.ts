import { mihomoHotReloadConfig, triggerSysProxy, updateTrayIcon } from '@renderer/utils/ipc'

interface ConnectionDeps {
  appConfig?: AppConfig
  controledMihomoConfig?: Partial<MihomoConfig>
  mixedPort?: number
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
  patchControledMihomoConfig: (value: Partial<MihomoConfig>) => Promise<void>
}

// Traffic goes through the app while either TUN or the system proxy mode is on
export function isConnectionOn(
  appConfig?: AppConfig,
  controledMihomoConfig?: Partial<MihomoConfig>
): boolean {
  return (controledMihomoConfig?.tun?.enable ?? false) || (appConfig?.sysProxy?.enable ?? false)
}

// A manual system proxy points at the mixed port, so with that port closed there is nothing to turn on
export function isConnectionSwitchBlocked(
  appConfig?: AppConfig,
  controledMihomoConfig?: Partial<MihomoConfig>,
  mixedPort = controledMihomoConfig?.['mixed-port']
): boolean {
  const { mainSwitchMode = 'tun', sysProxy } = appConfig || {}
  const { mode } = sysProxy || {}
  return mainSwitchMode === 'sysproxy' && mode == 'manual' && mixedPort == 0
}

// The main switch of the home screen and the tray menu
export async function setConnectionEnabled(enable: boolean, deps: ConnectionDeps): Promise<void> {
  const {
    appConfig,
    controledMihomoConfig,
    mixedPort,
    patchAppConfig,
    patchControledMihomoConfig
  } = deps
  const { mainSwitchMode = 'tun', sysProxy, onlyActiveDevice = false } = appConfig || {}
  const { enable: sysProxyEnabled = false } = sysProxy || {}

  if (enable) {
    if (mainSwitchMode === 'tun') {
      await patchControledMihomoConfig({ tun: { enable: true }, dns: { enable: true } })
      await mihomoHotReloadConfig()
    } else {
      if (isConnectionSwitchBlocked(appConfig, controledMihomoConfig, mixedPort)) return
      await patchAppConfig({ sysProxy: { enable: true } })
      await mihomoHotReloadConfig()
      await triggerSysProxy(true, onlyActiveDevice)
    }
  } else {
    const tunWasEnabled = controledMihomoConfig?.tun?.enable ?? false
    if (tunWasEnabled) {
      await patchControledMihomoConfig({ tun: { enable: false } })
    }
    if (sysProxyEnabled) {
      await triggerSysProxy(false, onlyActiveDevice)
      await patchAppConfig({ sysProxy: { enable: false } })
    }
    if (tunWasEnabled || sysProxyEnabled) {
      await mihomoHotReloadConfig()
    }
  }
  window.electron.ipcRenderer.send('updateFloatingWindow')
  window.electron.ipcRenderer.send('updateTrayMenu')
  await updateTrayIcon()
}
