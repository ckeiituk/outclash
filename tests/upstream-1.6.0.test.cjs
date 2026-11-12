const assert = require('node:assert/strict')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
const { loadModule } = require('./helpers/load-module.cjs')

test('subscription header decoding fixes UTF-8 Cyrillic while retaining base64 and Latin-1', () => {
  const { decodeHeaderText } = loadModule('src/main/utils/headers.ts')
  const title = 'Подписка Москва 🌍'
  assert.equal(decodeHeaderText(Buffer.from(title).toString('latin1')), title)
  assert.equal(decodeHeaderText(`base64:${Buffer.from(title).toString('base64')}`), title)
  assert.equal(decodeHeaderText(title), title)
  assert.equal(decodeHeaderText('Caf\xe9'), 'Café')
  assert.equal(decodeHeaderText('OutClash'), 'OutClash')
})

test('the active subscription controls ping display without affecting profiles that omit it', () => {
  const { resolvePingDisplay } = loadModule('src/renderer/src/utils/ping-display.ts')
  const app = { pingDisplay: 'ping' }
  const config = { current: 'active', items: [{ id: 'active', pingDisplay: 'indicator' }] }
  assert.equal(resolvePingDisplay(app, config), 'indicator')
  config.current = 'other'
  assert.equal(resolvePingDisplay(app, config), 'ping')
  assert.equal(resolvePingDisplay({ pingDisplay: 'indicator' }), 'indicator')
  assert.equal(resolvePingDisplay(), 'ping')
})

test('group snapshots reject damaged storage and retain only the newest delay when written', () => {
  const group = {
    name: 'Servers',
    type: 'Selector',
    now: 'DIRECT',
    icon: '',
    hidden: false,
    interface: '',
    alive: true,
    tfo: false,
    udp: true,
    xudp: false,
    mptcp: false,
    smux: false,
    uot: false,
    extra: {},
    all: [],
    history: [
      { time: 'first', delay: 10 },
      { time: 'second', delay: 20 }
    ]
  }
  for (const raw of ['{', '{}', '[null]', '[{"name":"broken"}]', JSON.stringify([group])]) {
    let options
    let idle
    let saved
    const groups = loadModule(
      'src/renderer/src/hooks/use-groups.tsx',
      {
        react: { ...require('react'), useEffect: () => {} },
        swr: {
          __esModule: true,
          default: (_key, _fetcher, config) => {
            options = config
            return { data: config.fallbackData, mutate: () => {} }
          }
        },
        '@renderer/utils/ipc': {},
        '@renderer/store/core-lifecycle-store': {}
      },
      {
        localStorage: {
          getItem: () => raw,
          setItem: (_key, value) => {
            saved = JSON.parse(value)
          }
        },
        requestIdleCallback: (callback) => {
          idle = callback
        }
      }
    )
    groups.GroupsProvider({ children: null })
    assert.deepEqual(options.fallbackData, raw === JSON.stringify([group]) ? [group] : undefined)
    options.onSuccess([group])
    assert.equal(saved, undefined)
    idle()
    assert.deepEqual(saved[0].history, [{ time: 'second', delay: 20 }])
  }
})

test('onIpc detaches the preload listener using its returned disposer', () => {
  const events = new EventEmitter()
  let removeCalls = 0
  const ipc = loadModule(
    'src/renderer/src/utils/ipc.ts',
    {},
    {
      window: {
        electron: {
          ipcRenderer: {
            on: (channel, listener) => {
              events.on(channel, listener)
              return () => events.off(channel, listener)
            },
            removeListener: () => removeCalls++
          }
        }
      }
    }
  )
  const values = []
  const detach = ipc.onIpc('sample', (value) => values.push(value))
  events.emit('sample', { electronEvent: true }, 'first')
  detach()
  events.emit('sample', {}, 'second')
  assert.deepEqual(values, ['first'])
  assert.equal(events.listenerCount('sample'), 0)
  assert.equal(removeCalls, 0)
})

test('core lifecycle broadcasts reach both main and tray windows through crash and recovery', () => {
  const main = { name: 'main' }
  const tray = { name: 'tray' }
  const events = []
  const status = loadModule('src/main/core/status.ts', {
    '..': { mainWindow: main },
    '../resolve/tray': { customTrayWindow: tray },
    '../utils/safeSend': {
      safeSend: (window, channel, state) => events.push({ window, channel, state })
    }
  })
  status.reportCoreError(new Error('crashed'))
  status.setCoreStatus('running')
  assert.deepEqual(
    events.map(({ window, state }) => [window.name, state.status]),
    [
      ['main', 'error'],
      ['tray', 'error'],
      ['main', 'running'],
      ['tray', 'running']
    ]
  )
})

test('the tray core-state hook updates immediately on events and detaches its subscription', () => {
  let listener
  let cleanup
  let detached = false
  const updates = []
  const response = { data: { status: 'error' }, mutate: async (...args) => updates.push(args) }
  const hook = loadModule('src/renderer/src/hooks/use-core-state.ts', {
    react: {
      useEffect: (effect) => {
        cleanup = effect()
      }
    },
    swr: { __esModule: true, default: () => response },
    '@renderer/utils/ipc': {
      onIpc: (_channel, callback) => {
        listener = callback
        return () => {
          detached = true
        }
      }
    }
  })
  assert.equal(hook.useCoreState(), response)
  listener({ status: 'running' })
  assert.deepEqual(updates, [[{ status: 'running' }, { revalidate: false }]])
  cleanup()
  assert.equal(detached, true)
})

function connectionFixture(app, controlled, mixedPort) {
  const calls = []
  const connection = loadModule(
    'src/renderer/src/utils/connection.ts',
    {
      '@renderer/utils/ipc': {
        mihomoHotReloadConfig: async () => calls.push(['reload']),
        triggerSysProxy: async (...args) => calls.push(['os-proxy', ...args]),
        updateTrayIcon: async () => calls.push(['icon'])
      }
    },
    { window: { electron: { ipcRenderer: { send: (channel) => calls.push(['ipc', channel]) } } } }
  )
  const deps = {
    appConfig: app,
    controledMihomoConfig: controlled,
    mixedPort,
    patchAppConfig: async (patch) => calls.push(['app', patch]),
    patchControledMihomoConfig: async (patch) => calls.push(['core', patch])
  }
  return { calls, connection, deps }
}

test('home and tray switches use OutClash sysProxy state and the profile effective port', async () => {
  const { calls, connection, deps } = connectionFixture(
    { mainSwitchMode: 'sysproxy', sysProxy: { enable: false, mode: 'manual' } },
    { 'mixed-port': 0, tun: { enable: false } },
    17897
  )
  assert.equal(connection.isConnectionOn(deps.appConfig, deps.controledMihomoConfig), false)
  assert.equal(
    connection.isConnectionSwitchBlocked(deps.appConfig, deps.controledMihomoConfig, 17897),
    false
  )
  await connection.setConnectionEnabled(true, deps)
  assert.deepEqual(calls.slice(0, 3), [
    ['app', { sysProxy: { enable: true } }],
    ['reload'],
    ['os-proxy', true, false]
  ])
  calls.length = 0
  await connection.setConnectionEnabled(true, { ...deps, mixedPort: 0 })
  assert.deepEqual(calls, [])
})

test('disconnecting from tray disables both active mechanisms regardless of the selected switch mode', async () => {
  const { calls, connection, deps } = connectionFixture(
    { mainSwitchMode: 'tun', sysProxy: { enable: true }, onlyActiveDevice: true },
    { tun: { enable: true } }
  )
  assert.equal(connection.isConnectionOn(deps.appConfig, deps.controledMihomoConfig), true)
  await connection.setConnectionEnabled(false, deps)
  assert.deepEqual(calls.slice(0, 4), [
    ['core', { tun: { enable: false } }],
    ['os-proxy', false, true],
    ['app', { sysProxy: { enable: false } }],
    ['reload']
  ])
})

function apiFixture() {
  const sockets = []
  const sends = []
  const timers = new Map()
  let nextTimer = 0
  class FakeWebSocket extends EventEmitter {
    static CONNECTING = 0
    static OPEN = 1
    constructor(url) {
      super()
      this.url = url
      this.readyState = 0
      sockets.push(this)
    }
    close() {
      this.readyState = 3
      // ws emits error when a socket still connecting is intentionally closed.
      this.emit('error', new Error('closed while connecting'))
      this.onclose?.()
    }
  }
  const api = loadModule(
    'src/main/core/mihomoApi.ts',
    {
      '../config': { getAppConfig: async () => ({ connectionInterval: 500 }) },
      '..': { mainWindow: {} },
      ws: FakeWebSocket,
      '../resolve/tray': {},
      '../core/factory': {},
      './factory': {},
      '../resolve/floatingWindow': {},
      '../utils/dirs': { mihomoIpcPath: () => '/fake/socket' },
      '../utils/safeSend': {
        safeSend: (_window, channel, value) => sends.push({ channel, value })
      },
      '../utils/i18n': { t: (key) => key },
      './status': { CoreError: Error }
    },
    {
      setTimeout: (callback) => {
        const id = ++nextTimer
        timers.set(id, callback)
        return id
      },
      clearTimeout: (id) => timers.delete(id)
    }
  )
  const flush = () => {
    for (const [id, callback] of [...timers]) {
      timers.delete(id)
      callback()
    }
  }
  return { api, sockets, sends, flush, timers }
}

test('the main process batches logs before IPC and retains only the newest 500 in a burst', () => {
  const { api, sockets, sends, flush } = apiFixture()
  api.startMihomoLogs('info')
  for (let i = 0; i < 600; i++) {
    sockets[0].onmessage({ data: JSON.stringify({ type: 'info', payload: String(i) }) })
  }
  assert.equal(sends.length, 0)
  flush()
  assert.equal(sends.length, 1)
  assert.equal(sends[0].value.length, 500)
  assert.equal(sends[0].value[0].payload, '100')
  assert.equal(sends[0].value.at(-1).payload, '599')
  sockets[0].onmessage({ data: JSON.stringify({ type: 'error', payload: 'last crash line' }) })
  api.stopMihomoLogs()
  assert.equal(sends.at(-1).value[0].payload, 'last crash line')
  assert.equal(sockets[0].readyState, 3)
})

test('clearing logs drops pending main-process lines and stale in-flight batches before restarting numbering', async () => {
  const { api, sockets, sends, flush, timers } = apiFixture()
  let listener
  let acknowledge
  const acknowledgement = new Promise((resolve) => {
    acknowledge = resolve
  })
  const store = loadModule('src/renderer/src/store/logs-store.ts', {
    '@renderer/utils/ipc': {
      onIpc: (_channel, callback) => {
        listener = callback
        return () => {}
      },
      clearMihomoLogs: () => {
        api.clearMihomoLogs()
        return acknowledgement
      }
    }
  })
  const detach = store.attachLogsStore()
  api.startMihomoLogs('info')
  sockets[0].onmessage({ data: JSON.stringify({ type: 'info', payload: 'before-clear' }) })
  assert.equal(timers.size, 1)
  const cleared = store.useLogsStore.getState().clear()
  assert.equal(timers.size, 0)
  listener([{ type: 'info', payload: 'old batch already crossing IPC' }])
  flush()
  assert.deepEqual(store.useLogsStore.getState().logs, [])
  assert.equal(sends.length, 0)
  acknowledge()
  await cleared
  sockets[0].onmessage({ data: JSON.stringify({ type: 'info', payload: 'after-clear' }) })
  flush()
  listener(sends[0].value)
  assert.equal(store.useLogsStore.getState().logs[0].payload, 'after-clear')
  assert.equal(store.useLogsStore.getState().logs[0].id, 1)
  api.stopMihomoLogs()
  detach()
})

test('connections stream opens only when wanted, closes while connecting, and stays off after core stop', async () => {
  const { api, sockets } = apiFixture()
  await api.startMihomoConnections()
  assert.equal(sockets.length, 0)
  await Promise.all([api.setMihomoConnectionsWanted(true), api.setMihomoConnectionsWanted(true)])
  assert.equal(sockets.length, 1)
  await api.setMihomoConnectionsWanted(false)
  assert.equal(sockets[0].readyState, 3)
  await api.setMihomoConnectionsWanted(true)
  assert.equal(sockets.length, 2)
  api.stopMihomoConnections()
  assert.equal(sockets[1].readyState, 3)
  await api.setMihomoConnectionsWanted(true)
  assert.equal(sockets.length, 2)
})

test('connections page releases its stream on hide/unmount and resets speed after a visibility gap', () => {
  const visibility = new EventEmitter()
  const document = {
    visibilityState: 'visible',
    addEventListener: (name, callback) => visibility.on(name, callback),
    removeEventListener: (name, callback) => visibility.off(name, callback)
  }
  let payload
  let cleanup
  const wanted = []
  const store = loadModule(
    'src/renderer/src/store/connections-store.ts',
    {
      react: {
        useEffect: (effect) => {
          cleanup = effect()
        }
      },
      '@renderer/utils/ipc': {
        onIpc: (_channel, listener) => {
          payload = listener
          return () => {
            payload = null
          }
        },
        setMihomoConnectionsWanted: async (value) => wanted.push(value)
      }
    },
    { document }
  )
  const detach = store.attachConnectionsStore()
  store.useConnectionsStream()
  const send = (download) =>
    payload({ connections: [{ id: 'one', download, upload: 0, metadata: {} }], memory: 1 })
  send(100)
  send(130)
  assert.equal(store.useConnectionsStore.getState().active[0].downloadSpeed, 30)
  document.visibilityState = 'hidden'
  visibility.emit('visibilitychange')
  send(900)
  assert.equal(store.useConnectionsStore.getState().active[0].download, 130)
  document.visibilityState = 'visible'
  visibility.emit('visibilitychange')
  send(1000)
  assert.equal(store.useConnectionsStore.getState().active[0].downloadSpeed, 0)
  cleanup()
  assert.deepEqual(wanted, [true, false, true, false])
  assert.equal(visibility.listenerCount('visibilitychange'), 0)
  detach()
  assert.equal(payload, null)
})
