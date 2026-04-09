export const SYSTEM_PROXY_RETRY_DELAY_MS = 5000

type SystemProxyAction = (onlyActiveDevice: boolean) => Promise<void>

export interface SystemProxyController {
  setSystemProxyEnabled(enable: boolean, onlyActiveDevice: boolean): Promise<void>
  resetSystemProxy(onlyActiveDevice: boolean): Promise<void>
}

export interface SystemProxyControllerDeps<TTimer> {
  isOnline: () => boolean
  applySystemProxy: SystemProxyAction
  resetSystemProxy: SystemProxyAction
  setRetryTimeout: (callback: () => void, delayMs: number) => TTimer
  clearRetryTimeout: (timer: TTimer) => void
}

export function createSystemProxyController<TTimer>(
  deps: SystemProxyControllerDeps<TTimer>
): SystemProxyController {
  let triggerSysProxyTimer: TTimer | null = null

  function clearPendingSysProxyRetry(): void {
    if (triggerSysProxyTimer !== null) {
      deps.clearRetryTimeout(triggerSysProxyTimer)
      triggerSysProxyTimer = null
    }
  }

  const controller: SystemProxyController = {
    async setSystemProxyEnabled(enable: boolean, onlyActiveDevice: boolean): Promise<void> {
      clearPendingSysProxyRetry()
      if (!enable) {
        await controller.resetSystemProxy(onlyActiveDevice)
        return
      }
      if (deps.isOnline()) {
        await deps.applySystemProxy(onlyActiveDevice)
        return
      }
      triggerSysProxyTimer = deps.setRetryTimeout(() => {
        triggerSysProxyTimer = null
        void controller.setSystemProxyEnabled(enable, onlyActiveDevice)
      }, SYSTEM_PROXY_RETRY_DELAY_MS)
    },

    async resetSystemProxy(onlyActiveDevice: boolean): Promise<void> {
      clearPendingSysProxyRetry()
      await deps.resetSystemProxy(onlyActiveDevice)
    }
  }

  return controller
}
