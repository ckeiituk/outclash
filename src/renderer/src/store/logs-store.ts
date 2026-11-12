import dayjs from 'dayjs'
import { create } from 'zustand'
import { clearMihomoLogs, onIpc } from '@renderer/utils/ipc'

const MAX_LOGS = 500

export interface LogEntry extends ControllerLog {
  // Sequence number in arrival order, shown in the row
  id: number
  // Full date and time, shown on hover
  time: string
  // Time only, shown in the row. Fixed width keeps the level badges aligned across rows.
  clock: string
}

interface LogsStore {
  // Newest first
  logs: LogEntry[]
  clear: () => Promise<void>
}

let nextId = 1
let clearsInFlight = 0

// Restarts numbering, so the first line after a clear is #1 again.
const reset = (): void => {
  nextId = 1
}

export const useLogsStore = create<LogsStore>((set) => ({
  logs: [],
  clear: async (): Promise<void> => {
    reset()
    set({ logs: [] })
    // Discard queued main-process logs and any old batch already crossing IPC.
    clearsInFlight++
    try {
      await clearMihomoLogs()
    } finally {
      clearsInFlight--
    }
  }
}))

// The main process batches lines (one message per ~100 ms), so a batch is one list update and
// shares one timestamp
const handleIpcPayload = (batch: ControllerLog[]): void => {
  if (batch.length === 0 || clearsInFlight > 0) return
  const now = dayjs()
  const time = now.format('L LTS')
  const clock = now.format('HH:mm:ss')
  const firstId = nextId
  nextId += batch.length
  // Newest first
  const entries: LogEntry[] = []
  for (let i = batch.length - 1; i >= 0; i--) {
    entries.push({ ...batch[i], id: firstId + i, time, clock })
  }
  const next = entries.concat(useLogsStore.getState().logs)
  useLogsStore.setState({ logs: next.length > MAX_LOGS ? next.slice(0, MAX_LOGS) : next })
}

let attached = false
let detachIpc: (() => void) | null = null

export const attachLogsStore = (): (() => void) => {
  if (attached) {
    return (): void => {
      // noop
    }
  }

  attached = true
  detachIpc = onIpc<[ControllerLog[]]>('mihomoLogs', handleIpcPayload)

  return (): void => {
    if (!attached) return

    attached = false
    detachIpc?.()
    detachIpc = null
    reset()
    useLogsStore.setState({ logs: [] })
  }
}
