import { create } from 'zustand'
import { getCoreState, onIpc } from '@renderer/utils/ipc'

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
let detachIpc: (() => void)[] = []

export const attachCoreLifecycleStore = (): (() => void) => {
  if (attached) {
    return (): void => {
      // noop
    }
  }

  attached = true
  let active = true
  let receivedCoreState = false
  const coreStartedListener = (): void => {
    useCoreLifecycleStore.setState((state: CoreLifecycleStore) => ({
      startedAt: Math.max(Date.now(), state.startedAt + 1)
    }))
  }
  const profileReloadedListener = (): void => {
    useCoreLifecycleStore.setState((state: CoreLifecycleStore) => ({
      profileReloadedAt: Math.max(Date.now(), state.profileReloadedAt + 1)
    }))
  }
  const updateCoreState = (coreState: CoreState): void => {
    useCoreLifecycleStore.setState((state: CoreLifecycleStore) => ({
      coreState,
      startedAt:
        coreState.status === 'running' && state.coreState.status !== 'running'
          ? Math.max(Date.now(), state.startedAt + 1)
          : state.startedAt
    }))
  }
  const coreStateListener = (coreState: CoreState): void => {
    receivedCoreState = true
    updateCoreState(coreState)
  }
  detachIpc = [
    onIpc('core-started', coreStartedListener),
    onIpc('profile-reloaded', profileReloadedListener),
    onIpc<[CoreState]>('coreStateChanged', coreStateListener)
  ]
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
    detachIpc.forEach((detach: () => void) => detach())
    detachIpc = []
  }
}
