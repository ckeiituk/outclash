const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { once } = require('node:events')
const { EventEmitter } = require('node:events')
const { PassThrough, Writable } = require('node:stream')
const { gunzipSync } = require('node:zlib')
const http = require('node:http')
const axios = require('axios')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Load the actual TypeScript modules with Electron/OS boundaries replaced. Each load has its
// own cache so tests exercise startup and migration state without touching a running client.
function loadModule(relative, stubs = {}, globals = {}) {
  const cache = new Map()
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const nativeRequire = createRequire(filename)
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name]
      const source = path.resolve(path.dirname(filename), `${name}.ts`)
      if (name.startsWith('.') && fs.existsSync(source)) return load(source)
      return nativeRequire(name)
    }
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText
    const wrapper = vm.runInThisContext(
      `(function(require,module,exports,__filename,__dirname,window,setTimeout,clearTimeout){${compiled}\n})`,
      { filename }
    )
    wrapper(
      localRequire,
      module,
      module.exports,
      filename,
      path.dirname(filename),
      globals.window,
      globals.setTimeout ?? setTimeout,
      globals.clearTimeout ?? clearTimeout
    )
    return module.exports
  }
  return load(path.join(root, relative))
}

async function temporaryDirectory(t) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'outclash-test-'))
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  return dir
}

function factoryFixture() {
  const state = {
    app: { sysProxy: { enable: true }, proxyMode: false, controlTun: false },
    profile: { 'mixed-port': 17897, 'socks-port': 17898, 'log-level': 'warning' },
    controlled: { 'mixed-port': 7897, 'socks-port': 0, 'log-level': 'info', tun: { enable: true } }
  }
  const factory = loadModule('src/main/core/factory.ts', {
    '../config': {
      getAppConfig: async () => state.app,
      getProfileConfig: async () => ({ current: 'active' }),
      getProfile: async () => {
        if (state.profileError) throw state.profileError
        return structuredClone(state.profile)
      },
      getProfileStr: async () => JSON.stringify(state.profile),
      getControledMihomoConfig: async () => state.controlled
    },
    '../utils/dirs': { rulePath: () => '/does-not-exist', mihomoWorkConfigPath: () => 'work' },
    'fs/promises': { writeFile: async () => {} },
    '../utils/geo': { linkGeoFiles: async () => {} }
  })
  return { state, factory }
}

test('profile ports and log level take precedence, and explicit app choices can override them', async () => {
  const { state, factory } = factoryFixture()
  assert.equal((await factory.getEffectivePorts())['mixed-port'].fromProfile, true)
  assert.equal(await factory.getMixedPort(), 17897)
  assert.deepEqual(await factory.getEffectiveLogLevel(), {
    value: 'warning',
    profileValue: 'warning',
    fromProfile: true
  })
  state.app.customPorts = ['mixed-port']
  state.app.customLogLevel = true
  assert.equal(await factory.getMixedPort(), 7897)
  assert.equal((await factory.getEffectiveLogLevel()).value, 'info')
  state.profile['mixed-port'] = 99999
  state.app.customPorts = []
  assert.equal(await factory.getMixedPort(), 7897)
})

test('runtime generation retains TUN enable and exclusions while following profile settings', async () => {
  const { state, factory } = factoryFixture()
  state.profile.tun = { enable: false, stack: 'mixed' }
  state.controlled.tun['route-exclude-address'] = ['10.0.0.0/8']
  assert.equal((await factory.generateProfile()).logLevel, 'warning')
  const runtime = await factory.getRuntimeConfig()
  assert.equal(runtime['mixed-port'], 17897)
  assert.equal(runtime.tun.enable, true)
  assert.deepEqual(runtime.tun['route-exclude-address'], ['10.0.0.0/8'])
})

test('malformed saved YAML keeps tray settings available without hiding core validation errors', async () => {
  const { state, factory } = factoryFixture()
  state.profileError = new Error('invalid YAML')
  assert.equal(await factory.getMixedPort(), 7897)
  assert.equal((await factory.getEffectivePorts())['mixed-port'].fromProfile, false)
  assert.equal((await factory.getEffectiveLogLevel()).value, 'info')
  await assert.rejects(factory.generateProfile(), /invalid YAML/)
})

test('core validation errors preserve a running state, and a later successful start clears them', () => {
  const status = loadModule('src/main/core/status.ts', {
    '..': { mainWindow: null },
    '../utils/safeSend': { safeSend: () => {} }
  })
  status.setCoreStatus('running')
  status.reportCoreError(new status.CoreError('config-invalid', 'bad config'))
  assert.equal(status.getCoreState().status, 'running')
  assert.equal(status.getCoreState().error.reason, 'config-invalid')
  status.setCoreStatus('stopped')
  status.reportCoreError(new Error('crash'))
  assert.equal(status.getCoreState().status, 'error')
  status.setCoreStatus('running')
  assert.equal(status.getCoreState().error, undefined)
})

async function profileFixture(t) {
  const dir = await temporaryDirectory(t)
  const state = {
    config: {
      current: 'active',
      items: [{ id: 'active', type: 'remote', url: 'https://example.test/sub' }]
    },
    app: { useHotReloadProfile: true, updateChannelLocked: true, updateChannel: 'stable' },
    core: 'running',
    reloads: 0,
    restarts: 0,
    regenerations: 0,
    requests: [],
    response: { data: 'proxies: []\nrules: []\n', headers: {} }
  }
  const configPath = path.join(dir, 'profile.yaml')
  const profilePath = (id) => path.join(dir, `${id}.yaml`)
  await fsp.writeFile(profilePath('active'), 'rules: [MATCH,DIRECT]\n')
  const rejection = new Error('configuration rejected')
  const api = {
    isConfigRejection: (error) => error === rejection,
    mihomoHotReloadConfig: async () => {
      state.reloads++
      if (state.reject) throw rejection
    },
    mihomoVersion: async () => ({})
  }
  const profile = loadModule('src/main/config/profile.ts', {
    '../utils/dirs': {
      profileConfigPath: () => configPath,
      profilePath,
      logPath: () => path.join(dir, 'test.log'),
      mihomoProfileWorkDir: (id) => path.join(dir, 'work', id)
    },
    '../core/manager': {
      restartCoreUntilUp: async () => {
        state.restarts++
      },
      waitForCoreStart: async () => {}
    },
    '../core/factory': {
      generateProfile: async () => {
        state.regenerations++
      },
      getRuntimeConfig: async () => ({})
    },
    '../core/mihomoApi': api,
    '../core/status': { getCoreState: () => ({ status: state.core }) },
    './app': {
      getAppConfig: async () => state.app,
      patchAppConfig: async (patch) => Object.assign(state.app, patch)
    },
    './controledMihomo': { getControledMihomoConfig: async () => ({}) },
    electron: { ipcMain: { emit: () => {} } },
    '..': { mainWindow: null },
    axios: {
      get: async (url, options) => {
        state.requests.push({ url, options })
        return state.request ? state.request(url, options) : state.response
      },
      isAxiosError: axios.isAxiosError
    },
    '../utils/userAgent': { getUserAgent: async () => 'OutClash/Test' },
    '../utils/deviceInfo': {
      getHWID: () => 'test',
      getDeviceOS: () => 'test',
      getOSVersion: () => 'test',
      getDeviceModel: () => 'test'
    },
    '../utils/i18n': { t: (key) => key },
    '../resolve/theme': {}
  })
  await profile.setProfileConfig(state.config)
  return { profile, state, profilePath }
}

test('subscription addresses accept bare hosts, ports and tokens while preserving explicit protocols', () => {
  const { getSubscriptionUrlCandidates: candidates } = loadModule(
    'src/shared/utils/subscription-url.ts'
  )
  const path = '/sub/a%2Fb?token=a%2Bb%3D&flag=1'
  for (const host of ['bl.outsquad.ru', 'localhost:8080', '127.0.0.1:8080', '[::1]:8080']) {
    assert.deepEqual(candidates(`  ${host}${path}  `), [
      `https://${host}${path}`,
      `http://${host}${path}`
    ])
  }
  for (const scheme of ['http', 'https', 'HTTPS']) {
    const url = `${scheme}://example.test:1234${path}`
    assert.deepEqual(candidates(` ${url} `), [url])
  }
  for (const invalid of [
    '',
    ' ',
    'ftp://example.test/sub',
    'file:///tmp/sub',
    'vmess://proxy',
    'mailto:user@example.test',
    '/sub',
    'https:example.test',
    'https://',
    'example.test:99999/sub',
    'example .test/sub',
    'example.test\n/sub',
    'example.test\\sub'
  ]) {
    assert.deepEqual(candidates(invalid), [], invalid)
  }
})

test('a bare subscription address loads HTTPS first and saves its full URL', async (t) => {
  const { profile, state } = await profileFixture(t)
  const address = 'example.test/sub/a%2Fb?token=a%2Bb%3D'
  await profile.addProfileItem({ ...state.config.items[0], url: ` ${address} ` })
  assert.deepEqual(
    state.requests.map(({ url }) => url),
    [`https://${address}`]
  )
  assert.equal((await profile.getProfileItem('active')).url, `https://${address}`)
  assert.equal(state.requests[0].options.headers['x-hwid'], 'test')
  assert.equal(state.requests[0].options.headers['User-Agent'], 'OutClash/Test')
})

test('HTTP fallback saves the successful URL and subsequent updates use it directly', async (t) => {
  const { profile, state } = await profileFixture(t)
  state.request = async (url) => {
    if (url.startsWith('https:')) throw new axios.AxiosError('connect refused', 'ECONNREFUSED')
    return state.response
  }
  await profile.addProfileItem({ ...state.config.items[0], url: 'example.test/sub?token=a%2Fb' })
  const saved = await profile.getProfileItem('active')
  assert.equal(saved.url, 'http://example.test/sub?token=a%2Fb')
  await profile.addProfileItem(saved)
  assert.deepEqual(
    state.requests.map(({ url }) => url),
    [
      'https://example.test/sub?token=a%2Fb',
      'http://example.test/sub?token=a%2Fb',
      'http://example.test/sub?token=a%2Fb'
    ]
  )
})

test('editing the subscription address through profile metadata resolves and saves the working protocol', async (t) => {
  const { profile, state } = await profileFixture(t)
  state.request = async (url) => {
    if (url.startsWith('https:')) throw new axios.AxiosError('connect refused', 'ECONNREFUSED')
    return state.response
  }
  await profile.updateProfileItem({ ...state.config.items[0], url: 'other.test/sub?token=a%2Fb' })
  assert.equal((await profile.getProfileItem('active')).url, 'http://other.test/sub?token=a%2Fb')
  assert.equal(state.requests.length, 2)

  await profile.updateProfileItem({ ...(await profile.getProfileItem('active')), name: 'Renamed' })
  assert.equal((await profile.getProfileItem('active')).name, 'Renamed')
  assert.equal(state.requests.length, 2, 'metadata-only changes do not redownload the subscription')
})

test('HTTP fallback cannot duplicate a previously saved bare subscription address', async (t) => {
  const { profile, state } = await profileFixture(t)
  state.config.items[0].url = 'example.test/sub?token=a%2Fb'
  state.request = async (url) => {
    if (url.startsWith('https:')) throw new axios.AxiosError('connect refused', 'ECONNREFUSED')
    return state.response
  }
  await assert.rejects(
    profile.addProfileItem({ id: 'other', type: 'remote', url: 'example.test/sub?token=a%2Fb' }),
    /duplicateProfile/
  )
  assert.equal((await profile.getProfileConfig()).items.length, 1)
})

test('an incomplete buffered authentication response never triggers protocol fallback', async (t) => {
  const { profile, state } = await profileFixture(t)
  const server = http.createServer((_request, response) => {
    response.writeHead(401, { 'Content-Type': 'text/plain' })
    response.flushHeaders()
    // The body never completes; Axios reports ERR_BAD_RESPONSE without error.response.
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  let failure
  state.request = async (_url, options) => {
    try {
      // Use loopback HTTP to exercise Axios's real buffered response/timeout path;
      // TLS is irrelevant once the response headers have reached ClientRequest.
      return await axios.get(`http://127.0.0.1:${server.address().port}/sub`, {
        ...options,
        proxy: false,
        timeout: 200
      })
    } catch (error) {
      failure = error
      throw error
    }
  }
  await assert.rejects(
    profile.addProfileItem({ ...state.config.items[0], url: 'example.test/sub' })
  )
  assert.equal(failure.code, 'ERR_BAD_RESPONSE')
  assert.equal(failure.response, undefined)
  assert.deepEqual(
    state.requests.map(({ url }) => url),
    ['https://example.test/sub']
  )
})

test('certificate, authentication, HTTP and ambiguous transport failures never cause HTTP fallback', async (t) => {
  const failures = [
    new axios.AxiosError('expired', 'CERT_HAS_EXPIRED'),
    new axios.AxiosError('self signed', 'DEPTH_ZERO_SELF_SIGNED_CERT'),
    new axios.AxiosError('wrong host', 'ERR_TLS_CERT_ALTNAME_INVALID'),
    new axios.AxiosError('unable to verify', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'),
    new axios.AxiosError('tls alert certificate required', 'EPROTO'),
    new axios.AxiosError('socket reset', 'ECONNRESET'),
    new axios.AxiosError('DNS not found', 'ENOTFOUND'),
    ...[401, 403, 404, 500].map(
      (status) => new axios.AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', null, null, { status })
    )
  ]
  for (const failure of failures) {
    await t.test(`${failure.code}: ${failure.message}`, async (t) => {
      const { profile, state, profilePath } = await profileFixture(t)
      const original = await fsp.readFile(profilePath('active'), 'utf8')
      state.request = async () => {
        throw failure
      }
      await assert.rejects(
        profile.addProfileItem({ ...state.config.items[0], url: 'example.test/sub' })
      )
      assert.deepEqual(
        state.requests.map(({ url }) => url),
        ['https://example.test/sub']
      )
      assert.equal((await profile.getProfileItem('active')).url, 'https://example.test/sub')
      assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), original)
    })
  }
})

test('an explicit subscription protocol is tried once and preserved', async (t) => {
  for (const scheme of ['http', 'https']) {
    const { profile, state } = await profileFixture(t)
    const url = `${scheme}://example.test/custom-sub`
    await profile.addProfileItem({ ...state.config.items[0], url })
    assert.equal((await profile.getProfileItem('active')).url, url)
    state.request = async () => {
      throw new axios.AxiosError('connect refused', 'ECONNREFUSED')
    }
    await assert.rejects(profile.addProfileItem({ ...state.config.items[0], url }))
    assert.deepEqual(
      state.requests.map((request) => request.url),
      [url, url]
    )
  }
})

test('failed protocol detection leaves the saved profile and subscription contents untouched', async (t) => {
  const { profile, state, profilePath } = await profileFixture(t)
  const original = await fsp.readFile(profilePath('active'), 'utf8')
  state.request = async () => {
    throw new axios.AxiosError('connect refused', 'ECONNREFUSED')
  }
  await assert.rejects(
    profile.addProfileItem({ ...state.config.items[0], url: 'unavailable.test/sub' })
  )
  assert.deepEqual(
    state.requests.map(({ url }) => url),
    ['https://unavailable.test/sub', 'http://unavailable.test/sub']
  )
  assert.equal((await profile.getProfileItem('active')).url, 'https://example.test/sub')
  assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), original)
})

test('redirect failures and invalid config responses never trigger an HTTP retry', async (t) => {
  const { profile, state } = await profileFixture(t)
  state.request = async (_url, options) => {
    options.beforeRedirect()
    throw new axios.AxiosError('redirect target refused', 'ECONNREFUSED')
  }
  await assert.rejects(
    profile.addProfileItem({ ...state.config.items[0], url: 'example.test/sub' })
  )
  assert.equal(state.requests.length, 1)

  state.request = null
  state.response = {
    data: '<html>not a subscription</html>',
    headers: { 'content-type': 'text/html' }
  }
  await assert.rejects(
    profile.addProfileItem({ ...state.config.items[0], url: 'example.test/sub' }),
    /subscriptionFormatError/
  )
  assert.equal(state.requests.length, 2)
})

test('protocol resolution cannot bypass duplicate checks or overwrite a profile on duplicate failure', async (t) => {
  for (const scheme of ['http', 'https']) {
    const { profile, state, profilePath } = await profileFixture(t)
    const original = await fsp.readFile(profilePath('active'), 'utf8')
    state.config.items.push({ id: 'other', type: 'remote', url: `${scheme}://duplicate.test/sub` })
    state.request = async (url) => {
      if (scheme === 'http' && url.startsWith('https:')) {
        throw new axios.AxiosError('connect refused', 'ECONNREFUSED')
      }
      return state.response
    }
    await assert.rejects(
      profile.addProfileItem({ ...state.config.items[0], url: 'duplicate.test/sub' }),
      /duplicateProfile/
    )
    assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), original)
  }
})

test('a real HTTP-only listener is detected after the HTTPS handshake fails', async (t) => {
  const { profile, state } = await profileFixture(t)
  const received = []
  const server = http.createServer((request, response) => {
    received.push({ url: request.url, hwid: request.headers['x-hwid'] })
    response.setHeader('Content-Type', 'text/yaml')
    response.end(state.response.data)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  state.request = (url, options) => axios.get(url, { ...options, proxy: false })
  const address = `127.0.0.1:${server.address().port}/sub?token=a%2Fb`
  await profile.addProfileItem({ ...state.config.items[0], url: address })
  assert.equal((await profile.getProfileItem('active')).url, `http://${address}`)
  assert.deepEqual(
    state.requests.map(({ url }) => url),
    [`https://${address}`, `http://${address}`]
  )
  assert.deepEqual(received, [{ url: '/sub?token=a%2Fb', hwid: 'test' }])
})

test('a rejected profile restores the previous selection without restarting the healthy core', async (t) => {
  const { profile, state } = await profileFixture(t)
  state.reject = true
  await assert.rejects(profile.changeCurrentProfile('other'), /configuration rejected/)
  assert.equal((await profile.getProfileConfig()).current, 'active')
  assert.equal(state.restarts, 0)
  assert.equal(state.regenerations, 1)
})

test('a rejected profile edit restores its content and does not restart', async (t) => {
  const { profile, state, profilePath } = await profileFixture(t)
  state.reject = true
  const before = await fsp.readFile(profilePath('active'), 'utf8')
  await assert.rejects(profile.setProfileStr('active', 'invalid: config'), /profileReverted/)
  assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), before)
  assert.equal(state.restarts, 0)
})

test('existing subscriptions still update at the HWID limit and retain the manually locked channel', async (t) => {
  const { profile, state, profilePath } = await profileFixture(t)
  state.response.headers = {
    'x-hwid-limit': 'true',
    'support-url': 'https://example.test/support',
    'outclash-update-channel': 'alpha'
  }
  await assert.rejects(profile.addProfileItem(state.config.items[0]), /HWID_LIMIT:/)
  assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), state.response.data)
  assert.equal(state.reloads, 1)
  assert.equal(state.app.updateChannel, 'stable')
  assert.equal(state.config.items[0].supportUrl, 'https://example.test/support')
})

test('new subscriptions at the HWID limit are not saved, and HTML responses clear an existing profile', async (t) => {
  const { profile, state, profilePath } = await profileFixture(t)
  state.response = {
    data: '<html>limit</html>',
    headers: { 'x-hwid-limit': 'true', 'content-type': 'text/html' }
  }
  await assert.rejects(
    profile.addProfileItem({ id: 'new', type: 'remote', url: 'https://example.test/new' }),
    /HWID_LIMIT:/
  )
  assert.equal(fs.existsSync(profilePath('new')), false)
  await assert.rejects(profile.addProfileItem(state.config.items[0]), /HWID_LIMIT:/)
  assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), '')
})

test('a stopped core accepts a subscription edit without being started as a side effect', async (t) => {
  const { profile, state } = await profileFixture(t)
  state.core = 'stopped'
  await profile.setProfileStr('active', 'rules: []')
  assert.equal(state.reloads, 0)
  assert.equal(state.restarts, 0)
})

test('repairing the active subscription recovers a core that failed to start', async (t) => {
  const { profile, state, profilePath } = await profileFixture(t)
  state.core = 'error'
  await profile.setProfileStr('active', 'rules: []')
  assert.equal(await fsp.readFile(profilePath('active'), 'utf8'), 'rules: []')
  assert.equal(state.reloads, 0)
  assert.equal(state.restarts, 1)
})

test('logs are batched newest first, capped, and clearing cancels pending lines', () => {
  let listener
  let timer
  const store = loadModule(
    'src/renderer/src/store/logs-store.ts',
    {},
    {
      window: {
        electron: {
          ipcRenderer: {
            on: (_name, callback) => {
              listener = callback
            },
            removeListener: () => {}
          }
        }
      },
      setTimeout: (callback) => {
        timer = callback
        return 1
      },
      clearTimeout: () => {
        timer = null
      }
    }
  )
  const detach = store.attachLogsStore()
  for (let i = 0; i < 600; i++) listener(null, { type: 'info', payload: String(i) })
  assert.equal(store.useLogsStore.getState().logs.length, 0)
  timer()
  assert.equal(store.useLogsStore.getState().logs.length, 500)
  assert.equal(store.useLogsStore.getState().logs[0].payload, '599')
  listener(null, { type: 'info', payload: 'pending' })
  store.useLogsStore.getState().clear()
  assert.equal(timer, null)
  listener(null, { type: 'info', payload: 'new' })
  timer()
  assert.equal(store.useLogsStore.getState().logs[0].id, 1)
  detach()
  assert.equal(store.useLogsStore.getState().logs.length, 0)
})

test('geo databases are shared by hard links instead of per-profile copies', async (t) => {
  const dir = await temporaryDirectory(t)
  const target = path.join(dir, 'profile')
  await fsp.mkdir(target)
  await fsp.writeFile(path.join(dir, 'country.mmdb'), 'geo data')
  await fsp.writeFile(path.join(target, 'geoip.metadb'), 'unused')
  const geo = loadModule('src/main/utils/geo.ts', { './dirs': { mihomoWorkDir: () => dir } })
  await geo.linkGeoFiles(target)
  await geo.linkGeoFiles(target)
  const source = await fsp.stat(path.join(dir, 'country.mmdb'))
  const linked = await fsp.stat(path.join(target, 'country.mmdb'))
  assert.equal(source.ino, linked.ino)
  assert.equal(fs.existsSync(path.join(target, 'geoip.metadb')), false)
})

test('log cleanup archives previous days and keeps current-day logs readable', async (t) => {
  const dir = await temporaryDirectory(t)
  const today = path.join(dir, '2026-10-20.log')
  const previous = path.join(dir, '2026-10-19.log')
  await fsp.writeFile(today, 'current')
  await fsp.writeFile(previous, 'previous')
  const logs = loadModule('src/main/utils/logs.ts', {
    '../config': { getAppConfig: async () => ({ maxLogDays: 7 }) },
    './dirs': { logDir: () => dir, logPath: () => today }
  })
  await logs.cleanupLogs()
  assert.equal(await fsp.readFile(today, 'utf8'), 'current')
  assert.equal(gunzipSync(await fsp.readFile(`${previous}.gz`)).toString(), 'previous')
})

test('core output rotates at the size limit and stays usable across stream writes', async (t) => {
  const dir = await temporaryDirectory(t)
  const file = path.join(dir, 'today.log')
  const logs = loadModule('src/main/utils/logs.ts', {
    '../config': { getAppConfig: async () => ({}) },
    './dirs': { logDir: () => dir, logPath: () => file }
  })
  const stream = new logs.RotatingLog()
  await new Promise((resolve) => stream.write(Buffer.alloc(20 * 1024 * 1024), resolve))
  stream.end(Buffer.from('next'))
  await once(stream, 'finish')
  assert.equal((await fsp.stat(path.join(dir, 'today.1.log'))).size, 20 * 1024 * 1024)
  assert.equal(await fsp.readFile(file, 'utf8'), 'next')
})

test('the support upload file picker includes archived logs', async (t) => {
  const dir = await temporaryDirectory(t)
  await fsp.writeFile(path.join(dir, 'today.log'), 'current')
  await fsp.writeFile(path.join(dir, 'previous.log.gz'), 'compressed')
  await fsp.writeFile(path.join(dir, 'unrelated.txt'), 'ignore')
  const uploader = loadModule('src/main/resolve/logsUploader.ts', {
    electron: { app: {} },
    '../utils/dirs': { logDir: () => dir },
    '../config': {},
    '../core/factory': {},
    '../utils/userAgent': {},
    '../utils/deviceInfo': {},
    '../utils/i18n': {}
  })
  assert.deepEqual((await uploader.listLogFiles()).map((file) => file.name).sort(), [
    'previous.log.gz',
    'today.log'
  ])
})

function managerFixture(t) {
  const status = loadModule('src/main/core/status.ts', {
    '..': { mainWindow: null },
    '../utils/safeSend': { safeSend: () => {} }
  })
  const state = {
    binaryExists: true,
    validationError: null,
    spawnCount: 0,
    proxyDrops: 0,
    effectiveLogLevel: 'info',
    appliedLogLevels: []
  }
  let onSpawn
  const spawned = new Promise((resolve) => {
    onSpawn = resolve
  })
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.pid = 12345
  child.killed = false
  child.kill = () => {
    child.killed = true
    queueMicrotask(() => child.emit('exit', 0, 'SIGINT'))
    return true
  }
  const noop = async () => {}
  const api = Object.fromEntries(
    [
      'startMihomoTraffic',
      'startMihomoConnections',
      'startMihomoLogs',
      'startMihomoMemory',
      'stopMihomoTraffic',
      'stopMihomoConnections',
      'stopMihomoLogs',
      'stopMihomoMemory',
      'applyLogLevel',
      'mihomoGroups',
      'getAxios'
    ].map((name) => [name, noop])
  )
  const logLevelEvents = new EventEmitter()
  api.applyLogLevel = async (level) => {
    state.appliedLogLevels.push(level)
    logLevelEvents.emit('applied')
  }
  const manager = loadModule(
    'src/main/core/manager.ts',
    {
      '../utils/dirs': {
        dataDir: () => '/tmp/outclash-fake',
        logPath: () => '/tmp/outclash-fake/test.log',
        installedCores: () => ['mihomo'],
        mihomoCorePath: () => '/fake/mihomo',
        mihomoIpcPath: () => '/fake/socket',
        mihomoWorkDir: () => '/fake/work',
        mihomoTestDir: () => '/fake/test',
        mihomoWorkConfigPath: () => '/fake/config'
      },
      './factory': {
        generateProfile: async () => {
          if (state.validationError) throw state.validationError
          return { logLevel: 'info' }
        },
        getRuntimeConfig: async () => ({}),
        getEffectiveLogLevel: async () => ({ value: state.effectiveLogLevel })
      },
      '../config': {
        getAppConfig: async () => ({
          core: 'mihomo',
          autoSetDNSMode: 'none',
          sysProxy: { enable: true }
        }),
        getProfileConfig: async () => ({ current: 'active' }),
        getControledMihomoConfig: async () => ({ tun: { enable: false } })
      },
      electron: { app: {}, ipcMain: {}, net: {} },
      './mihomoApi': api,
      './status': status,
      'fs/promises': { writeFile: noop, rm: noop },
      fs: { existsSync: (file) => file === '/fake/mihomo' && state.binaryExists },
      child_process: {
        spawn: () => {
          state.spawnCount++
          onSpawn()
          return child
        },
        execFile: (...args) => args.at(-1)(null, '', '')
      },
      '..': { mainWindow: null },
      '../sys/sysproxy': {
        disableSysProxy: async () => {
          state.proxyDrops++
        },
        triggerSysProxy: noop
      },
      '../service/api': {},
      '../utils/i18n': { t: (key) => key },
      '../utils/logs': {
        RotatingLog: class extends Writable {
          _write(_chunk, _encoding, callback) {
            callback()
          }
        }
      }
    },
    {
      setTimeout: (callback, milliseconds) => {
        if (milliseconds === 30000) {
          state.timeout = callback
          return null
        }
        return setTimeout(callback, milliseconds)
      }
    }
  )
  t.after(() => manager.stopCore())
  return { state, status, manager, child, spawned, logLevelEvents }
}

test('a missing binary reports an actionable error and drops the OS proxy', async (t) => {
  const { state, manager, status } = managerFixture(t)
  state.binaryExists = false
  await assert.rejects(manager.startCore(), /ENOENT/)
  assert.equal(status.getCoreState().error.reason, 'binary-missing')
  assert.equal(status.getCoreState().status, 'error')
  assert.equal(state.proxyDrops, 1)
  assert.equal(state.spawnCount, 0)
})

test('restart validation happens before stopping a healthy core', async (t) => {
  const { state, manager, status } = managerFixture(t)
  status.setCoreStatus('running')
  state.validationError = new Error('invalid profile')
  await assert.rejects(manager.restartCore(), /invalid profile/)
  assert.equal(status.getCoreState().status, 'running')
  assert.equal(status.getCoreState().error.reason, 'config-invalid')
  assert.equal(state.spawnCount, 0)
  assert.equal(state.proxyDrops, 0)
})

test('a core exiting before its controller is ready rejects immediately', async (t) => {
  const { state, manager, status, child, spawned } = managerFixture(t)
  const starting = manager.startCore()
  await spawned
  child.emit('close', 2, null)
  await assert.rejects(starting, /code: 2/)
  await manager.waitForCoreStart()
  assert.equal(status.getCoreState().status, 'error')
  assert.equal(state.spawnCount, 1)
  assert.equal(state.proxyDrops, 1)
})

test('a silent core still hits the startup deadline instead of hanging indefinitely', async (t) => {
  const { state, manager, status, spawned } = managerFixture(t)
  const starting = manager.startCore()
  await spawned
  state.timeout()
  await assert.rejects(starting, /coreStartTimeout/)
  assert.equal(status.getCoreState().status, 'error')
  assert.equal(state.proxyDrops, 1)
})

test('controller readiness publishes running state and settles the start tracker', async (t) => {
  const { manager, status, child, spawned } = managerFixture(t)
  const starting = manager.startCore()
  await spawned
  child.stdout.write('RESTful API unix listening at: /fake/socket\n')
  await starting
  await manager.waitForCoreStart()
  assert.equal(status.getCoreState().status, 'running')
})

test('profile restarts finish at controller readiness even while providers are still pending', async (t) => {
  const { manager, child, spawned } = managerFixture(t)
  const restarting = manager.restartCoreUntilUp()
  await spawned
  child.stdout.write('RESTful API unix listening at: /fake/socket\n')
  await restarting
  // No provider initialization messages have been emitted; the profile queue can proceed.
  await manager.waitForCoreStart()
})

test('provider initialization after hot reload applies the new profile log level', async (t) => {
  const { state, manager, child, spawned, logLevelEvents } = managerFixture(t)
  const starting = manager.startCore()
  await spawned
  child.stdout.write('RESTful API unix listening at: /fake/socket\n')
  const providers = await starting
  child.stdout.write('Start initial compatible provider default\n')
  await Promise.all(providers)
  assert.deepEqual(state.appliedLogLevels, ['info'])

  state.effectiveLogLevel = 'warning'
  await manager.resetProviderTracking()
  const applied = once(logLevelEvents, 'applied')
  child.stdout.write('Start initial compatible provider default\n')
  await applied
  assert.deepEqual(state.appliedLogLevels, ['info', 'warning'])
})

test('the first write after reopening an oversized log rotates it immediately', async (t) => {
  const dir = await temporaryDirectory(t)
  const file = path.join(dir, 'today.log')
  await fsp.writeFile(file, Buffer.alloc(20 * 1024 * 1024))
  const logs = loadModule('src/main/utils/logs.ts', {
    '../config': { getAppConfig: async () => ({}) },
    './dirs': { logDir: () => dir, logPath: () => file }
  })
  const stream = new logs.RotatingLog()
  stream.end(Buffer.from('next'))
  await once(stream, 'finish')
  assert.equal((await fsp.stat(path.join(dir, 'today.1.log'))).size, 20 * 1024 * 1024)
  assert.equal(await fsp.readFile(file, 'utf8'), 'next')
})

test('the initial core-state request cannot overwrite a newer IPC event', async () => {
  let respond
  const request = new Promise((resolve) => {
    respond = resolve
  })
  const listeners = new Map()
  const lifecycle = loadModule(
    'src/renderer/src/store/core-lifecycle-store.ts',
    {
      '@renderer/utils/ipc': { getCoreState: () => request }
    },
    {
      window: {
        electron: {
          ipcRenderer: {
            on: (name, callback) => listeners.set(name, callback),
            removeListener: (name) => listeners.delete(name)
          }
        }
      }
    }
  )
  const detach = lifecycle.attachCoreLifecycleStore()
  listeners.get('coreStateChanged')(null, { status: 'running' })
  respond({ status: 'stopped' })
  await request
  assert.equal(lifecycle.useCoreLifecycleStore.getState().coreState.status, 'running')
  detach()
})

test('effective port subscribers refresh on every successful restart and profile reload', async () => {
  const listeners = new Map()
  const lifecycle = loadModule(
    'src/renderer/src/store/core-lifecycle-store.ts',
    { '@renderer/utils/ipc': { getCoreState: async () => ({ status: 'stopped' }) } },
    {
      window: {
        electron: {
          ipcRenderer: {
            on: (name, callback) => listeners.set(name, callback),
            removeListener: (name) => listeners.delete(name)
          }
        }
      }
    }
  )
  const detach = lifecycle.attachCoreLifecycleStore()
  let refreshes = 0
  let cleanup
  const hook = loadModule('src/renderer/src/hooks/use-effective-ports.ts', {
    react: { useEffect: (effect) => (cleanup = effect()) },
    swr: {
      default: () => ({
        mutate: async () => {
          refreshes++
        }
      }),
      __esModule: true
    },
    '@renderer/utils/ipc': {},
    '@renderer/store/core-lifecycle-store': lifecycle
  })
  hook.useEffectivePorts()
  const changeState = listeners.get('coreStateChanged')
  changeState(null, { status: 'running' })
  assert.equal(refreshes, 1)
  changeState(null, { status: 'running' })
  assert.equal(refreshes, 1)
  changeState(null, { status: 'starting' })
  changeState(null, { status: 'running' })
  assert.equal(refreshes, 2)
  listeners.get('profile-reloaded')()
  listeners.get('profile-reloaded')()
  assert.equal(refreshes, 4)
  cleanup()
  changeState(null, { status: 'stopped' })
  changeState(null, { status: 'running' })
  assert.equal(refreshes, 4)
  detach()
})
