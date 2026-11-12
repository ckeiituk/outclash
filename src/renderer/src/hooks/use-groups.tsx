import React, { createContext, useContext, ReactNode } from 'react'
import useSWR, { KeyedMutator } from 'swr'
import { mihomoGroups, onIpc } from '@renderer/utils/ipc'
import {
  subscribeCoreStarted,
  subscribeProfileReloaded
} from '@renderer/store/core-lifecycle-store'

interface GroupsContextType {
  groups: ControllerMixedGroup[] | undefined
  mutate: KeyedMutator<ControllerMixedGroup[]>
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined)

// The groups last seen, shown until the core is up so that the current server is there from the
// first frame instead of a moment after the window. Only the newest delay of each proxy is kept,
// which is all the pages show.
const SNAPSHOT_KEY = 'groupsSnapshot'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHistory(value: unknown): value is ControllerProxiesHistory[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        isRecord(entry) && typeof entry.time === 'string' && typeof entry.delay === 'number'
    )
  )
}

function isProxySnapshot(value: unknown): value is ControllerProxiesDetail | ControllerGroupDetail {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.type !== 'string')
    return false
  if (!isHistory(value.history) || !isRecord(value.extra)) return false
  if (
    !Object.values(value.extra).every(
      (extra: unknown) =>
        isRecord(extra) && typeof extra.alive === 'boolean' && isHistory(extra.history)
    )
  )
    return false
  for (const key of ['alive', 'tfo', 'udp', 'xudp', 'mptcp', 'smux', 'uot']) {
    if (typeof value[key] !== 'boolean') return false
  }
  if (typeof value.interface !== 'string') return false
  if ('all' in value) {
    return (
      Array.isArray(value.all) &&
      value.all.every((name: unknown) => typeof name === 'string') &&
      typeof value.now === 'string' &&
      typeof value.icon === 'string' &&
      typeof value.hidden === 'boolean'
    )
  }
  return (
    typeof value.id === 'string' &&
    typeof value['dialer-proxy'] === 'string' &&
    typeof value['routing-mark'] === 'number'
  )
}

function isGroupSnapshot(value: unknown): value is ControllerMixedGroup {
  if (!isRecord(value) || !Array.isArray(value.all)) return false
  return isProxySnapshot({ ...value, all: [] }) && value.all.every(isProxySnapshot)
}

const readSnapshot = (): ControllerMixedGroup[] | undefined => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return undefined
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) && value.every(isGroupSnapshot) ? value : undefined
  } catch {
    return undefined
  }
}

const writeSnapshot = (groups: ControllerMixedGroup[]): void => {
  const compact = groups.map((group) => ({
    ...group,
    extra: {},
    history: group.history?.slice(-1) ?? [],
    all: group.all.map((proxy) => ({
      ...proxy,
      extra: {},
      history: proxy.history?.slice(-1) ?? []
    }))
  }))
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(compact))
  } catch {
    // ignore
  }
}

const snapshot = readSnapshot()
let pendingSnapshot: ControllerMixedGroup[] | null = null

// Written when the window is idle, and only the latest of several fetches in a row
const saveSnapshot = (groups: ControllerMixedGroup[]): void => {
  if (pendingSnapshot === null) {
    requestIdleCallback(
      () => {
        const latest = pendingSnapshot
        pendingSnapshot = null
        if (latest) writeSnapshot(latest)
      },
      { timeout: 2000 }
    )
  }
  pendingSnapshot = groups
}

export const GroupsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: groups, mutate } = useSWR<ControllerMixedGroup[]>('mihomoGroups', mihomoGroups, {
    errorRetryInterval: 200,
    errorRetryCount: 10,
    keepPreviousData: true,
    dedupingInterval: 300,
    fallbackData: snapshot,
    onSuccess: saveSnapshot
  })

  React.useEffect(() => {
    const detachIpc = onIpc('groupsUpdated', () => {
      mutate()
    })
    const unsubscribe = subscribeCoreStarted(() => {
      mutate()
    })
    const unsubscribeReloaded = subscribeProfileReloaded(() => {
      mutate()
    })

    return (): void => {
      detachIpc()
      unsubscribe()
      unsubscribeReloaded()
    }
  }, [mutate])

  return <GroupsContext.Provider value={{ groups, mutate }}>{children}</GroupsContext.Provider>
}

export const useGroups = (): GroupsContextType => {
  const context = useContext(GroupsContext)
  if (context === undefined) {
    throw new Error('useGroups must be used within an GroupsProvider')
  }
  return context
}
