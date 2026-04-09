import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSystemProxyController,
  SYSTEM_PROXY_RETRY_DELAY_MS
} from './sysproxy-controller'

interface ScheduledTask {
  callback: () => void
  delayMs: number
  id: number
  state: 'pending' | 'cleared' | 'ran'
}

function createHarness(initialOnline: boolean): {
  controller: ReturnType<typeof createSystemProxyController<number>>
  events: string[]
  getPendingTaskIds: () => number[]
  getTaskDelay: (id: number) => number | undefined
  runTask: (id: number) => void
  setOnline: (online: boolean) => void
} {
  const events: string[] = []
  const tasks = new Map<number, ScheduledTask>()
  let nextTaskId = 1
  let online = initialOnline

  const controller = createSystemProxyController<number>({
    isOnline: () => online,
    applySystemProxy: async (onlyActiveDevice: boolean) => {
      events.push(`apply:${onlyActiveDevice}`)
    },
    resetSystemProxy: async (onlyActiveDevice: boolean) => {
      events.push(`reset:${onlyActiveDevice}`)
    },
    setRetryTimeout: (callback: () => void, delayMs: number) => {
      const id = nextTaskId
      nextTaskId += 1
      tasks.set(id, { callback, delayMs, id, state: 'pending' })
      return id
    },
    clearRetryTimeout: (id: number) => {
      const task = tasks.get(id)
      if (task && task.state === 'pending') {
        task.state = 'cleared'
      }
    }
  })

  return {
    controller,
    events,
    getPendingTaskIds: () =>
      [...tasks.values()]
        .filter((task) => task.state === 'pending')
        .map((task) => task.id),
    getTaskDelay: (id: number) => tasks.get(id)?.delayMs,
    runTask: (id: number) => {
      const task = tasks.get(id)
      assert.ok(task, `Expected task ${id} to exist`)
      if (task.state !== 'pending') return
      task.state = 'ran'
      task.callback()
    },
    setOnline: (value: boolean) => {
      online = value
    }
  }
}

test('applies system proxy immediately when online', async () => {
  const harness = createHarness(true)

  await harness.controller.setSystemProxyEnabled(true, false)

  assert.deepEqual(harness.events, ['apply:false'])
  assert.deepEqual(harness.getPendingTaskIds(), [])
})

test('retries enabling system proxy after connectivity returns', async () => {
  const harness = createHarness(false)

  await harness.controller.setSystemProxyEnabled(true, true)

  const [retryTaskId] = harness.getPendingTaskIds()
  assert.equal(harness.getTaskDelay(retryTaskId), SYSTEM_PROXY_RETRY_DELAY_MS)
  assert.deepEqual(harness.events, [])

  harness.setOnline(true)
  harness.runTask(retryTaskId)

  assert.deepEqual(harness.events, ['apply:true'])
  assert.deepEqual(harness.getPendingTaskIds(), [])
})

test('disabling while offline resets immediately without leaving a retry timer', async () => {
  const harness = createHarness(false)

  await harness.controller.setSystemProxyEnabled(true, false)
  const [retryTaskId] = harness.getPendingTaskIds()

  await harness.controller.setSystemProxyEnabled(false, true)
  harness.setOnline(true)
  harness.runTask(retryTaskId)

  assert.deepEqual(harness.events, ['reset:true'])
  assert.deepEqual(harness.getPendingTaskIds(), [])
})

test('resetSystemProxy clears a pending enable retry', async () => {
  const harness = createHarness(false)

  await harness.controller.setSystemProxyEnabled(true, false)
  const [retryTaskId] = harness.getPendingTaskIds()

  await harness.controller.resetSystemProxy(false)
  harness.setOnline(true)
  harness.runTask(retryTaskId)

  assert.deepEqual(harness.events, ['reset:false'])
  assert.deepEqual(harness.getPendingTaskIds(), [])
})

test('replaces an old retry timer when enable is requested again while offline', async () => {
  const harness = createHarness(false)

  await harness.controller.setSystemProxyEnabled(true, false)
  const [firstRetryTaskId] = harness.getPendingTaskIds()

  await harness.controller.setSystemProxyEnabled(true, true)
  const [secondRetryTaskId] = harness.getPendingTaskIds()

  assert.notEqual(firstRetryTaskId, secondRetryTaskId)

  harness.setOnline(true)
  harness.runTask(firstRetryTaskId)
  assert.deepEqual(harness.events, [])

  harness.runTask(secondRetryTaskId)
  assert.deepEqual(harness.events, ['apply:true'])
  assert.deepEqual(harness.getPendingTaskIds(), [])
})
