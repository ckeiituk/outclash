import {
  logPath,
  mihomoProfileWorkDir,
  mihomoWorkDir,
  profileConfigPath,
  profilePath,
  rulePath
} from '../utils/dirs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { restartCoreUntilUp, waitForCoreStart } from '../core/manager'
import { generateProfile, getRuntimeConfig } from '../core/factory'
import { isConfigRejection, mihomoHotReloadConfig } from '../core/mihomoApi'
import { getCoreState } from '../core/status'
import { getAppConfig, patchAppConfig } from './app'
import { getControledMihomoConfig, patchControledMihomoConfig } from './controledMihomo'
import { ipcMain } from 'electron'
import { mainWindow } from '..'
import { existsSync } from 'fs'
import axios, { AxiosResponse } from 'axios'
import https from 'https'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { defaultProfile } from '../utils/template'
import { dirname, join } from 'path'
import { deepMerge } from '../utils/merge'
import { getUserAgent } from '../utils/userAgent'
import { getHWID, getDeviceOS, getOSVersion, getDeviceModel } from '../utils/deviceInfo'
import { t } from '../utils/i18n'
import { downloadCustomCss } from '../resolve/theme'
import { getSubscriptionUrlCandidates } from '../../shared/utils/subscription-url'

let profileConfig: ProfileConfig // profile.yaml

// Profile operations change the shared config across several awaits, so they run one at a time
let profileQueue: Promise<unknown> = Promise.resolve()

function withProfileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = profileQueue.then(task)
  profileQueue = run.catch(() => {})
  return run
}

export async function getProfileConfig(force = false): Promise<ProfileConfig> {
  if (force || !profileConfig) {
    const data = await readFile(profileConfigPath(), 'utf-8')
    profileConfig = parseYaml(data) || { items: [] }
  }
  if (typeof profileConfig !== 'object') profileConfig = { items: [] }
  return profileConfig
}

export async function setProfileConfig(config: ProfileConfig): Promise<void> {
  await withProfileLock(() => saveProfileConfig(config))
}

async function saveProfileConfig(config: ProfileConfig): Promise<void> {
  profileConfig = config
  await writeFile(profileConfigPath(), stringifyYaml(config), 'utf-8')
}

export async function getProfileItem(id: string | undefined): Promise<ProfileItem | undefined> {
  const { items } = await getProfileConfig()
  if (!id || id === 'default')
    return { id: 'default', type: 'local', name: t('ui.blankSubscription') }
  return items?.find((item) => item.id === id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  await withProfileLock(() => switchCurrentProfile(id))
}

async function switchCurrentProfile(id: string): Promise<void> {
  const config = await getProfileConfig()
  const previous = config.current
  config.current = id
  await saveProfileConfig(config)
  try {
    await applyCurrentProfile()
  } catch (e) {
    // The core kept the previous profile; restore it unless something switched away meanwhile
    if (config.current === id) {
      config.current = previous
      await saveProfileConfig(config)
    }
    // The failed apply already regenerated the runtime config and factory
    // caches for the new profile — re-sync them with the reverted current.
    try {
      await generateProfile()
    } catch (regenError) {
      await appendProfileReloadLog(
        `revert regenerate failed for profile ${id}: ${formatProfileReloadError(regenError)}`
      )
    }
    throw e
  }
  await enforceGlobalModeRestriction(id)
  await applyProfileExpandProxyGroups(id)
  const profile = await getProfileItem(id)
  await patchAppConfig({ customTheme: profile?.customCss || 'default.css' })
  mainWindow?.webContents.send('appConfigUpdated')
}

// A stopped core loads the selected profile on its next start.
async function applyCurrentProfile(): Promise<void> {
  await waitForCoreStart()
  const { status } = getCoreState()
  // Subscription repair can recover a failed start; an explicit stop stays stopped.
  if (status === 'error') {
    await restartCoreUntilUp()
    return
  }
  if (status !== 'running') return
  const { useHotReloadProfile = true } = await getAppConfig()
  if (useHotReloadProfile) {
    const { current } = await getProfileConfig()
    await reloadCurrentProfileOrRestart(current ?? 'default')
    return
  }
  await restartCoreUntilUp()
}

export async function updateProfileItem(item: ProfileItem): Promise<void> {
  if (item.type === 'remote') {
    const previous = await getProfileItem(item.id)
    if (!previous) throw new Error('Profile not found')
    const candidates = getSubscriptionUrlCandidates(item.url ?? '')
    if (candidates.length !== 1 || item.url?.trim() !== previous.url) {
      // The profile menu edits metadata directly; changed addresses need the same
      // download/protocol selection path as imports before they can be saved.
      await addProfileItem(item)
      return
    }
  }
  await withProfileLock(() => replaceProfileItem(item))
}

async function replaceProfileItem(item: ProfileItem): Promise<void> {
  const config = await getProfileConfig()
  const index = (config.items ?? []).findIndex((i) => i.id === item.id)
  if (index === -1) {
    throw new Error('Profile not found')
  }
  config.items[index] = item
  await saveProfileConfig(config)
}

export async function addProfileItem(item: Partial<ProfileItem>): Promise<void> {
  const { item: newItem, hwidLimitSupportUrl } = await createProfile(item)
  // The download above stays outside the lock, it can take long and changes nothing shared
  await withProfileLock(async () => {
    const config = await getProfileConfig()
    const isExisting = !!(await getProfileItem(newItem.id))
    if (isExisting) {
      await replaceProfileItem(newItem)
    } else {
      if (!config.items) config.items = []
      config.items.push(newItem)
      await saveProfileConfig(config)
    }

    if (!isExisting || !config.current) {
      await switchCurrentProfile(newItem.id)
    } else if (config.current === newItem.id) {
      await enforceGlobalModeRestriction(newItem.id)
      await applyProfileExpandProxyGroups(newItem.id)
      await patchAppConfig({ customTheme: newItem.customCss || 'default.css' })
      mainWindow?.webContents.send('appConfigUpdated')
    }
  })

  // The profile is already saved at this point, the error only reports the limit to the user
  if (hwidLimitSupportUrl !== undefined) {
    throw new Error(`HWID_LIMIT:${hwidLimitSupportUrl}`)
  }
}

// The `expand-proxy-groups` header lets a subscription force the corresponding app setting on
// (or explicitly off). Profiles without the header leave the user's own choice untouched.
async function applyProfileExpandProxyGroups(id: string): Promise<void> {
  const profile = await getProfileItem(id)
  if (profile?.expandProxyGroups === undefined) return
  const { expandProxyGroups } = await getAppConfig()
  if (expandProxyGroups === profile.expandProxyGroups) return
  await patchAppConfig({ expandProxyGroups: profile.expandProxyGroups })
}

async function enforceGlobalModeRestriction(id: string): Promise<void> {
  const profile = await getProfileItem(id)
  if (profile?.globalMode === false) {
    const { mode } = await getControledMihomoConfig()
    if (mode === 'global') {
      // Also patches the running core, if there is one
      await patchControledMihomoConfig({ mode: 'rule' })
      mainWindow?.webContents.send('controledMihomoConfigUpdated')
      mainWindow?.webContents.send('groupsUpdated')
      ipcMain.emit('updateTrayMenu')
    }
  }
}

export async function removeProfileItem(id: string): Promise<void> {
  await withProfileLock(async () => {
    const config = await getProfileConfig()
    config.items = config.items?.filter((item) => item.id !== id)
    let shouldRestart = false
    if (config.current === id) {
      shouldRestart = true
      if (config.items && config.items.length > 0) {
        config.current = config.items[0].id
      } else {
        config.current = undefined
      }
    }
    await saveProfileConfig(config)
    if (existsSync(profilePath(id))) {
      await rm(profilePath(id))
    }
    if (shouldRestart) {
      await applyCurrentProfile()
    }
    if (existsSync(mihomoProfileWorkDir(id))) {
      await rm(mihomoProfileWorkDir(id), { recursive: true })
    }
  })
}

export async function getCurrentProfileItem(): Promise<ProfileItem> {
  const { current } = await getProfileConfig()
  return (
    (await getProfileItem(current)) || {
      id: 'default',
      type: 'local',
      name: t('ui.blankSubscription')
    }
  )
}

async function downloadLogoAsBase64(
  logoUrl: string,
  proxy?: { protocol: string; host: string; port: number }
): Promise<string | null> {
  try {
    const httpsAgent = new https.Agent()
    const res = await axios.get(logoUrl, {
      httpsAgent,
      ...(proxy && { proxy }),
      responseType: 'arraybuffer',
      timeout: 10000
    })
    const contentType = res.headers['content-type'] || 'image/png'
    const base64 = Buffer.from(res.data).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

async function assertUniqueSubscriptionUrl(id: string, url: string): Promise<void> {
  const { items = [] } = await getProfileConfig()
  if (
    items.some(
      (existing: ProfileItem) =>
        existing.id !== id && getSubscriptionUrlCandidates(existing.url ?? '').includes(url)
    )
  ) {
    throw new Error(t('error.duplicateProfile'))
  }
}

function canRetrySubscriptionOverHttp(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response) return false
  switch (error.code) {
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ECONNABORTED':
    case 'ERR_SSL_WRONG_VERSION_NUMBER':
    case 'ERR_SSL_UNKNOWN_PROTOCOL':
    case 'ERR_SSL_PACKET_LENGTH_TOO_LONG':
      return true
    case 'EPROTO':
      // A plain HTTP listener can answer a TLS handshake with an HTTP error.
      // Other TLS failures (including certificate/client-auth errors) stay errors.
      return /wrong version number|unknown protocol|packet length too long/i.test(error.message)
    default:
      return false
  }
}

// `hwidLimitSupportUrl` is set (possibly to '') when the server reported that this device is over the
// HWID limit while updating an existing subscription; the profile is still updated in that case.
export async function createProfile(
  item: Partial<ProfileItem>
): Promise<{ item: ProfileItem; hwidLimitSupportUrl?: string }> {
  const id = item.id || new Date().getTime().toString(16)
  let hwidLimitSupportUrl: string | undefined
  const newItem = {
    id,
    name: item.name || (item.type === 'remote' ? 'Remote File' : 'Local File'),
    type: item.type,
    url: item.url,
    ua: item.ua,
    customHwid: item.customHwid,
    customLogsUploadUrl: item.customLogsUploadUrl,
    verify: item.verify ?? true,
    autoUpdate: item.autoUpdate ?? true,
    interval: item.interval || 0,
    useProxy: item.useProxy || false,
    updated: new Date().getTime()
  } as ProfileItem
  switch (newItem.type) {
    case 'remote': {
      const { 'mixed-port': mixedPort = 0 } = (await getRuntimeConfig()) ?? {}
      if (!item.url) throw new Error('Empty URL')
      const [primaryUrl, fallbackUrl] = getSubscriptionUrlCandidates(item.url)
      if (!primaryUrl) throw new Error(t('error.invalidSubscriptionUrl'))
      if (!fallbackUrl) await assertUniqueSubscriptionUrl(id, primaryUrl)
      let requestUrl = primaryUrl
      let res: AxiosResponse<string>
      try {
        const httpsAgent = new https.Agent()

        const requestOptions = {
          httpsAgent,
          ...(newItem.useProxy &&
            mixedPort && {
              proxy: { protocol: 'http', host: '127.0.0.1', port: mixedPort }
            }),
          headers: {
            'User-Agent': newItem.ua || (await getUserAgent()),
            'x-hwid': item.customHwid || getHWID(),
            'x-device-os': getDeviceOS(),
            'x-ver-os': getOSVersion(),
            'x-device-model': getDeviceModel()
          },
          responseType: 'text' as const
        }
        let redirected = false
        try {
          res = await axios.get<string>(primaryUrl, {
            ...requestOptions,
            ...(fallbackUrl && {
              timeout: 10000,
              beforeRedirect: (): void => {
                redirected = true
              }
            })
          })
        } catch (error: unknown) {
          if (!fallbackUrl || redirected || !canRetrySubscriptionOverHttp(error)) throw error
          requestUrl = fallbackUrl
          res = await axios.get<string>(fallbackUrl, { ...requestOptions, timeout: 10000 })
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
            throw new Error(`${t('error.networkResetOrTimeout')}：${requestUrl}`)
          } else if (error.code === 'CERT_HAS_EXPIRED') {
            throw new Error(`${t('error.serverCertExpired')}：${requestUrl}`)
          } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            throw new Error(`${t('error.unableToVerifyCert')}：${requestUrl}`)
          } else if (error.message.includes('Certificate verification failed')) {
            throw new Error(`${t('error.certVerificationFailed')}：${requestUrl}`)
          } else {
            throw new Error(`${t('error.requestFailed')}：${error.message}`)
          }
        }
        throw error
      }
      await assertUniqueSubscriptionUrl(id, requestUrl)
      newItem.url = requestUrl

      let data: string = res.data
      const headers = res.headers
      const hwidLimitKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('x-hwid-limit')
      )
      const hwidMaxDevicesKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('x-hwid-max-devices-reached')
      )
      if (
        (hwidLimitKey && headers[hwidLimitKey] === 'true') ||
        (hwidMaxDevicesKey && headers[hwidMaxDevicesKey] === 'true')
      ) {
        const hwidSupportKey = Object.keys(headers).find((k) =>
          k.toLowerCase().endsWith('support-url')
        )
        hwidLimitSupportUrl = hwidSupportKey ? headers[hwidSupportKey] : ''
        // A new subscription over the limit is not added at all
        if (!(await getProfileItem(id))) {
          throw new Error(`HWID_LIMIT:${hwidLimitSupportUrl}`)
        }
      }
      const contentType = String(headers['content-type'] ?? '').toLowerCase()
      if (
        hwidLimitSupportUrl === undefined &&
        (contentType.includes('text/html') || contentType.includes('text/xml'))
      ) {
        throw new Error(t('error.subscriptionFormatError'))
      }
      const profileTitleKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('profile-title')
      )
      if (profileTitleKey) {
        const titleValue = headers[profileTitleKey]
        if (titleValue.startsWith('base64:')) {
          newItem.name = Buffer.from(titleValue.slice(7), 'base64').toString('utf-8')
        } else {
          newItem.name = titleValue
        }
      } else {
        const contentDispositionKey = Object.keys(headers).find((k) =>
          k.toLowerCase().endsWith('content-disposition')
        )
        if (contentDispositionKey && newItem.name === 'Remote File') {
          newItem.name = parseFilename(headers[contentDispositionKey])
        }
      }
      const homeKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('profile-web-page-url')
      )
      if (homeKey) {
        newItem.home = headers[homeKey]
      }
      const homeNameKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('profile-web-page-name')
      )
      if (homeNameKey) {
        const homeNameValue = headers[homeNameKey]
        newItem.homeName = homeNameValue.startsWith('base64:')
          ? Buffer.from(homeNameValue.slice(7), 'base64').toString('utf-8')
          : homeNameValue
      }
      const intervalKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('profile-update-interval')
      )
      if (intervalKey) {
        newItem.interval = parseInt(headers[intervalKey]) * 60
        if (newItem.interval) {
          newItem.locked = true
        }
      }
      const userinfoKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('subscription-userinfo')
      )
      if (userinfoKey) {
        newItem.extra = parseSubinfo(headers[userinfoKey])
      }
      const logoKey = Object.keys(headers).find((k) => k.toLowerCase().endsWith('profile-logo'))
      if (logoKey) {
        const logoUrl = headers[logoKey]
        const proxyConfig =
          newItem.useProxy && mixedPort
            ? { protocol: 'http', host: '127.0.0.1', port: mixedPort }
            : undefined
        const base64Logo = await downloadLogoAsBase64(logoUrl, proxyConfig)
        newItem.logo = base64Logo || logoUrl
      }
      const supportUrlKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('support-url')
      )
      if (supportUrlKey) {
        newItem.supportUrl = headers[supportUrlKey]
      }
      const logsUploadUrlKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('logs-upload-url')
      )
      if (logsUploadUrlKey) {
        const logsUploadUrl = String(headers[logsUploadUrlKey]).trim()
        try {
          const parsed = new URL(logsUploadUrl)
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            newItem.logsUploadUrl = logsUploadUrl
          }
        } catch {
          // ignore invalid logs upload url
        }
      }
      const globalModeKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('global-mode')
      )
      if (globalModeKey) {
        newItem.globalMode = headers[globalModeKey].toLowerCase() !== 'false'
      }
      const expandProxyGroupsKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('expand-proxy-groups')
      )
      if (expandProxyGroupsKey) {
        newItem.expandProxyGroups = String(headers[expandProxyGroupsKey]).toLowerCase() !== 'false'
      }
      const announceKey = Object.keys(headers).find((k) => k.toLowerCase().endsWith('announce'))
      if (announceKey) {
        const announceValue = headers[announceKey]
        const decoded = announceValue.startsWith('base64:')
          ? Buffer.from(announceValue.slice(7), 'base64').toString('utf-8')
          : announceValue
        newItem.announce = decoded.replace(/\\n/g, '\n')
      }
      const customCssKey = Object.keys(headers).find((k) => k.toLowerCase().endsWith('custom-css'))
      if (customCssKey) {
        const cssUrl = headers[customCssKey]
        try {
          const proxyConfig =
            newItem.useProxy && mixedPort
              ? { protocol: 'http', host: '127.0.0.1', port: mixedPort }
              : undefined
          const existingProfile = await getProfileItem(id)
          newItem.customCss = await downloadCustomCss(
            cssUrl,
            proxyConfig,
            existingProfile?.customCss
          )
        } catch {
          // ignore css download failure
        }
      }
      const updateChannelKey = Object.keys(headers).find((k) =>
        k.toLowerCase().endsWith('outclash-update-channel')
      )
      if (updateChannelKey) {
        const channel = headers[updateChannelKey].trim().toLowerCase()
        // Server-driven channel cohort: only honour an explicit alpha/stable value
        // (absent header leaves the channel unchanged), and never override a channel
        // the user picked manually in settings (updateChannelLocked).
        if (channel === 'alpha' || channel === 'stable') {
          const { updateChannelLocked } = await getAppConfig()
          if (!updateChannelLocked) {
            await patchAppConfig({ updateChannel: channel })
          }
        }
      }
      if (hwidLimitSupportUrl !== undefined) {
        // Over the limit the server's response still replaces the stored config, otherwise the
        // previously downloaded one keeps working. A body that is not a config is stored as empty.
        try {
          verifyProfileStr(data)
        } catch {
          data = ''
        }
      } else if (newItem.verify) {
        verifyProfileStr(data)
      }
      await setProfileStr(id, data)
      break
    }
    case 'local': {
      const data = item.file || ''
      await setProfileStr(id, data)
      break
    }
  }
  return { item: newItem, hwidLimitSupportUrl }
}

function verifyProfileStr(data: string): void {
  let parsed: MihomoConfig
  try {
    parsed = parseYaml<MihomoConfig>(data)
  } catch (error) {
    throw new Error(t('error.subscriptionFormatError') + '\n' + (error as Error).message)
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !(
      'proxies' in parsed ||
      'proxy-providers' in parsed ||
      'proxy-groups' in parsed ||
      'rules' in parsed ||
      'rule-providers' in parsed ||
      'dns' in parsed ||
      'tun' in parsed ||
      'mixed-port' in parsed
    )
  ) {
    throw new Error(t('error.subscriptionFormatError'))
  }
}

export async function getProfileStr(id: string | undefined): Promise<string> {
  if (existsSync(profilePath(id || 'default'))) {
    return await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    return stringifyYaml(defaultProfile)
  }
}

export async function getProfileParseStr(id: string | undefined): Promise<string> {
  let data: string
  if (existsSync(profilePath(id || 'default'))) {
    data = await readFile(profilePath(id || 'default'), 'utf-8')
  } else {
    data = stringifyYaml(defaultProfile)
  }
  const profile = deepMerge(parseYaml<object>(data), {})
  return stringifyYaml(profile)
}

async function appendProfileReloadLog(message: string): Promise<void> {
  await writeFile(logPath(), `[Profile]: ${message}\n`, { flag: 'a' })
}

function formatProfileReloadError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

async function reloadCurrentProfileOrRestart(id: string): Promise<void> {
  try {
    await appendProfileReloadLog(`reload start for profile ${id}`)
    await mihomoHotReloadConfig()
    await appendProfileReloadLog(`reload success for profile ${id}`)
  } catch (error) {
    if (isConfigRejection(error)) {
      // The core rejected the config and keeps serving the old one —
      // restarting would only tear down a healthy core.
      await appendProfileReloadLog(
        `reload rejected for profile ${id}: ${formatProfileReloadError(error)}`
      )
      throw error
    }
    await appendProfileReloadLog(
      `reload failed for profile ${id}, fallback restart: ${formatProfileReloadError(error)}`
    )
    await restartCoreUntilUp()
    try {
      const { mihomoVersion } = await import('../core/mihomoApi')
      await mihomoVersion()
      await appendProfileReloadLog(`fallback restart success for profile ${id}`)
    } catch (restartError) {
      await appendProfileReloadLog(
        `fallback restart verification failed for profile ${id}: ${formatProfileReloadError(restartError)}`
      )
      throw restartError
    }
  }
}

// Restore the previous profile content after a failed apply and re-sync the
// runtime config plus the factory caches poisoned by the failed generate.
// Every step is best-effort: the ORIGINAL apply error must reach the caller.
async function revertProfileApply(
  id: string,
  previousContent: string | null,
  applyError: unknown
): Promise<void> {
  await appendProfileReloadLog(
    `apply failed for profile ${id}, reverting: ${formatProfileReloadError(applyError)}`
  )
  try {
    if (previousContent === null) {
      await rm(profilePath(id))
    } else {
      await writeFile(profilePath(id), previousContent, 'utf-8')
    }
  } catch (restoreError) {
    await appendProfileReloadLog(
      `revert write failed for profile ${id}: ${formatProfileReloadError(restoreError)}`
    )
  }
  try {
    await generateProfile()
  } catch (regenError) {
    await appendProfileReloadLog(
      `revert regenerate failed for profile ${id}: ${formatProfileReloadError(regenError)}`
    )
  }
  if (!isConfigRejection(applyError)) {
    // Transport failure: the core may be down. One attempt with the
    // restored, previously working config.
    try {
      await restartCoreUntilUp()
      await appendProfileReloadLog(`revert restart success for profile ${id}`)
    } catch (restartError) {
      await appendProfileReloadLog(
        `revert restart failed for profile ${id}: ${formatProfileReloadError(restartError)}`
      )
    }
  }
}

export async function setProfileStr(id: string, content: string): Promise<void> {
  await withProfileLock(() => saveProfileStr(id, content))
}

async function saveProfileStr(id: string, content: string): Promise<void> {
  const { current } = await getProfileConfig()
  const previousContent = existsSync(profilePath(id))
    ? await readFile(profilePath(id), 'utf-8')
    : null
  await writeFile(profilePath(id), content, 'utf-8')
  if (current === id) {
    try {
      await applyCurrentProfile()
    } catch (error) {
      await revertProfileApply(id, previousContent, error)
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`${reason}\n${t('error.profileReverted')}`)
    }
  }
}

export async function getProfile(id: string | undefined): Promise<MihomoConfig> {
  const profile = await getProfileStr(id)
  let result = parseYaml<MihomoConfig>(profile)
  if (typeof result !== 'object' || result === null || Array.isArray(result))
    result = {} as MihomoConfig
  return result
}

// attachment;filename=xxx.yaml; filename*=UTF-8''%xx%xx%xx
function parseFilename(str: string): string {
  if (str.match(/filename\*=.*''/)) {
    return decodeURIComponent(str.split(/filename\*=.*''/)[1])
  } else {
    return str.split('filename=')[1]
  }
}

// subscription-userinfo: upload=1234; download=2234; total=1024000; expire=2218532293
function parseSubinfo(str: string): SubscriptionUserInfo {
  const parts = str.split(';')
  const obj = {} as SubscriptionUserInfo
  parts.forEach((part) => {
    const [key, value] = part.trim().split('=')
    obj[key] = parseInt(value)
  })
  return obj
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path)
}

export async function getFileStr(path: string): Promise<string> {
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  if (isAbsolutePath(path)) {
    return await readFile(path, 'utf-8')
  } else {
    return await readFile(
      join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), path),
      'utf-8'
    )
  }
}

export async function setFileStr(path: string, content: string): Promise<void> {
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  if (isAbsolutePath(path)) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
  } else {
    const target = join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf-8')
  }
}

export async function getRuleStr(id: string): Promise<string> {
  // 规则文件不存在属于正常情况（尚未添加自定义规则），不应作为错误抛出，
  // 否则渲染层无法区分「没有规则」和「读取失败」
  if (!existsSync(rulePath(id))) {
    return ''
  }
  return await readFile(rulePath(id), 'utf-8')
}

export async function setRuleStr(id: string, str: string): Promise<void> {
  await writeFile(rulePath(id), str, 'utf-8')
}

export async function convertMrsRuleset(filePath: string, behavior: string): Promise<string> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)
  const { mihomoCorePath } = await import('../utils/dirs')
  const { getAppConfig } = await import('./app')
  const { tmpdir } = await import('os')
  const { randomBytes } = await import('crypto')
  const { unlink } = await import('fs/promises')

  const { core = 'mihomo' } = await getAppConfig()
  const corePath = mihomoCorePath(core)
  const { diffWorkDir = false } = await getAppConfig()
  const { current } = await getProfileConfig()
  let fullPath: string
  if (isAbsolutePath(filePath)) {
    fullPath = filePath
  } else {
    fullPath = join(diffWorkDir ? mihomoProfileWorkDir(current) : mihomoWorkDir(), filePath)
  }

  const tempFileName = `mrs-convert-${randomBytes(8).toString('hex')}.txt`
  const tempFilePath = join(tmpdir(), tempFileName)

  try {
    // 使用 mihomo convert-ruleset 命令转换 MRS 文件为 text 格式
    // 命令格式: mihomo convert-ruleset <behavior> <format> <source>
    await execAsync(`"${corePath}" convert-ruleset ${behavior} mrs "${fullPath}" "${tempFilePath}"`)
    const content = await readFile(tempFilePath, 'utf-8')
    await unlink(tempFilePath)

    return content
  } catch (error) {
    try {
      await unlink(tempFilePath)
    } catch {
      // ignore
    }
    throw error
  }
}
