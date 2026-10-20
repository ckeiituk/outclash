import { create } from 'zustand'
import { getCoreState } from '@renderer/utils/ipc'

interface CoreLifecycleStore {
  startedAt: number
  profileReloadedAt: number
  coreState: CoreState
  // `at` of the error the user closed; a newer error opens the alert again
  dismissedErrorAt: number
}

export const useCoreLifecycleStore = create<CoreLifecycleStore>(() => ({
  startedAt: 0,
  profileReloadedAt: 0,
  coreState: { status: 'stopped' },
  dismissedErrorAt: 0
}))

export const subscribeCoreStarted = (callback: () => void): (() => void) =>
  useCoreLifecycleStore.subscribe((state, previousState) => {
    if (state.startedAt !== previousState.startedAt) {
      callback()
    }
  })

export const subscribeProfileReloaded = (callback: () => void): (() => void) =>
  useCoreLifecycleStore.subscribe((state, previousState) => {
    if (state.profileReloadedAt !== previousState.profileReloadedAt) {
      callback()
    }
  })

export const dismissCoreError = (): void => {
  const { error } = useCoreLifecycleStore.getState().coreState
  useCoreLifecycleStore.setState({ dismissedErrorAt: error?.at ?? 0 })
}

export const reopenCoreError = (): void => {
  useCoreLifecycleStore.setState({ dismissedErrorAt: 0 })
}

let attached = false
let coreStartedListener: (() => void) | null = null
let profileReloadedListener: (() => void) | null = null
let coreStateListener: ((_event: unknown, coreState: CoreState) => void) | null = null

export const attachCoreLifecycleStore = (): (() => void) => {
  if (attached) {
    return (): void => {
      // noop
    }
  }

  attached = true
  let active = true
  let receivedCoreState = false
  coreStartedListener = (): void => {
    useCoreLifecycleStore.setState((state: CoreLifecycleStore) => ({
      startedAt: Math.max(Date.now(), state.startedAt + 1)
    }))
  }
  profileReloadedListener = (): void => {
    useCoreLifecycleStore.setState((state: CoreLifecycleStore) => ({
      profileReloadedAt: Math.max(Date.now(), state.profileReloadedAt + 1)
    }))
  }
  window.electron.ipcRenderer.on('core-started', coreStartedListener)
  window.electron.ipcRenderer.on('profile-reloaded', profileReloadedListener)

  const updateCoreState = (coreState: CoreState): void => {
    useCoreLifecycleStore.setState((state: CoreLifecycleStore) => ({
      coreState,
      startedAt:
        coreState.status === 'running' && state.coreState.status !== 'running'
          ? Math.max(Date.now(), state.startedAt + 1)
          : state.startedAt
    }))
  }
  coreStateListener = (_event, coreState): void => {
    receivedCoreState = true
    updateCoreState(coreState)
  }
  window.electron.ipcRenderer.on('coreStateChanged', coreStateListener)
  // A failure at startup can happen before this window was listening for events
  getCoreState()
    .then((coreState: CoreState) => {
      if (active && !receivedCoreState) updateCoreState(coreState)
    })
    .catch(() => {})

  return (): void => {
    active = false
    if (!attached) return

    attached = false
    if (coreStartedListener) {
      window.electron.ipcRenderer.removeListener('core-started', coreStartedListener)
      coreStartedListener = null
    }
    if (profileReloadedListener) {
      window.electron.ipcRenderer.removeListener('profile-reloaded', profileReloadedListener)
      profileReloadedListener = null
    }
    if (coreStateListener) {
      window.electron.ipcRenderer.removeListener('coreStateChanged', coreStateListener)
      coreStateListener = null
    }
  }
}
