import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import { Switch } from '@renderer/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, setupFirewall } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useTranslation } from 'react-i18next'

const DEFAULT_ROUTE_EXCLUDE_ADDRESSES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '::/128',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8'
] as const

const VIVOX_ROUTE_EXCLUDE_ADDRESSES = ['85.236.96.0/21', '85.236.104.0/23'] as const

const Tun: React.FC = () => {
  const { t } = useTranslation()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { autoSetDNSMode = 'exec', controlTun = false } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const [loading, setLoading] = useState(false)
  const {
    device = platform === 'darwin' ? undefined : 'mihomo',
    stack = 'mixed',
    'auto-route': autoRoute = true,
    'auto-redirect': autoRedirect = false,
    'auto-detect-interface': autoDetectInterface = true,
    'dns-hijack': dnsHijack = ['any:53'],
    'route-exclude-address': routeExcludeAddress = [],
    'strict-route': strictRoute = false,
    'disable-icmp-forwarding': disableIcmpForwarding = false,
    mtu = 1500
  } = tun || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    device,
    stack,
    autoRoute,
    autoRedirect,
    autoDetectInterface,
    dnsHijack,
    strictRoute,
    routeExcludeAddress,
    disableIcmpForwarding,
    mtu
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<MihomoConfig>): Promise<void> => {
    try {
      await patchControledMihomoConfig(patch)
      setChanged(false)
    } catch (e) {
      toast.error(`${e}`)
    }
  }

  return (
    <>
      <BasePage
        title={t('pages.tun.title')}
        header={
          controlTun &&
          changed && (
            <Button
              size="sm"
              className="app-nodrag"
              onClick={() =>
                onSave({
                  tun: {
                    device: values.device,
                    stack: values.stack,
                    'auto-route': values.autoRoute,
                    'auto-redirect': values.autoRedirect,
                    'auto-detect-interface': values.autoDetectInterface,
                    'dns-hijack': values.dnsHijack,
                    'strict-route': values.strictRoute,
                    'route-exclude-address': values.routeExcludeAddress,
                    'disable-icmp-forwarding': values.disableIcmpForwarding,
                    mtu: values.mtu
                  }
                })
              }
            >
              {t('common.save')}
            </Button>
          )
        }
      >
        <SettingCard className="tun-settings">
          <SettingItem title={t('pages.tun.takeOverTun')} divider>
            <Switch
              checked={controlTun}
              onCheckedChange={async (value) => {
                try {
                  await patchAppConfig({ controlTun: value })
                  await patchControledMihomoConfig({})
                  if (!value) setChanged(false)
                } catch (e) {
                  toast.error(`${e}`)
                }
              }}
            />
          </SettingItem>
          <div className={controlTun ? undefined : 'pointer-events-none opacity-50'}>
            {platform === 'win32' && (
              <SettingItem title={t('pages.tun.resetFirewall')} divider>
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true)
                    try {
                      await setupFirewall()
                      new Notification(t('pages.tun.firewallResetSuccess'))
                      await restartCore()
                    } catch (e) {
                      toast.error(`${e}`)
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  {loading && <Spinner className="mr-2 size-4" />}
                  {t('pages.tun.resetFirewallButton')}
                </Button>
              </SettingItem>
            )}
            {platform === 'darwin' && (
              <SettingItem title={t('pages.tun.autoSetSystemDNS')} divider>
                <Select
                  value={autoSetDNSMode}
                  onValueChange={async (value) => {
                    await patchAppConfig({ autoSetDNSMode: value as 'none' | 'exec' | 'service' })
                  }}
                >
                  <SelectTrigger size="sm" className="w-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="mr-5.5">
                    <SelectItem value="none">{t('pages.tun.noAutoSet')}</SelectItem>
                    <SelectItem value="exec">{t('pages.tun.execCommand')}</SelectItem>
                    <SelectItem value="service">{t('pages.tun.serviceMode')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>
            )}
            <SettingItem title={t('pages.tun.tunModeStack')} divider>
              <Tabs
                value={values.stack}
                onValueChange={(value) => setValues({ ...values, stack: value as TunStack })}
              >
                <TabsList>
                  <TabsTrigger value="gvisor">gVisor</TabsTrigger>
                  <TabsTrigger value="mixed">Mixed</TabsTrigger>
                  <TabsTrigger value="system">System</TabsTrigger>
                </TabsList>
              </Tabs>
            </SettingItem>
            {platform !== 'darwin' && (
              <>
                <SettingItem title={t('pages.tun.tunCardName')} divider>
                  <Input
                    className="w-[100px]"
                    value={values.device || ''}
                    onChange={(event) => {
                      setValues({ ...values, device: event.target.value })
                    }}
                  />
                </SettingItem>
                <SettingItem title={t('pages.tun.strictRoute')} divider>
                  <Switch
                    checked={values.strictRoute}
                    onCheckedChange={(value) => {
                      setValues({ ...values, strictRoute: value })
                    }}
                  />
                </SettingItem>
              </>
            )}
            <SettingItem title={t('pages.tun.autoSetRouteRules')} divider>
              <Switch
                checked={values.autoRoute}
                onCheckedChange={(value) => {
                  setValues({ ...values, autoRoute: value })
                }}
              />
            </SettingItem>
            {platform === 'linux' && (
              <SettingItem title={t('pages.tun.autoSetTCPRedirect')} divider>
                <Switch
                  checked={values.autoRedirect}
                  onCheckedChange={(value) => {
                    setValues({ ...values, autoRedirect: value })
                  }}
                />
              </SettingItem>
            )}
            <SettingItem title={t('pages.tun.autoSelectTrafficExit')} divider>
              <Switch
                checked={values.autoDetectInterface}
                onCheckedChange={(value) => {
                  setValues({ ...values, autoDetectInterface: value })
                }}
              />
            </SettingItem>
            <SettingItem title={t('pages.tun.icmpForwarding')} divider>
              <Switch
                checked={!values.disableIcmpForwarding}
                onCheckedChange={(value) => {
                  setValues({ ...values, disableIcmpForwarding: !value })
                }}
              />
            </SettingItem>
            <SettingItem title="MTU" divider>
              <Input
                type="number"
                className="w-[100px]"
                value={values.mtu.toString()}
                onChange={(event) => {
                  setValues({ ...values, mtu: parseInt(event.target.value) })
                }}
              />
            </SettingItem>
            <SettingItem title={t('pages.tun.dnsHijack')} divider>
              <Input
                className="w-[50%]"
                value={values.dnsHijack.join(',')}
                onChange={(event) => {
                  const inputValue = event.target.value
                  const arr = inputValue !== '' ? inputValue.split(',') : []
                  setValues({ ...values, dnsHijack: arr })
                }}
              />
            </SettingItem>
            <SettingItem title={t('pages.tun.excludeCustomNetworks')} divider={false}>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const addresses = [
                      ...new Set([...values.routeExcludeAddress, ...DEFAULT_ROUTE_EXCLUDE_ADDRESSES])
                    ]
                    setValues({ ...values, routeExcludeAddress: addresses })
                  }}
                >
                  {t('pages.tun.addDefaultNetworks')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const addresses = [
                      ...new Set([...values.routeExcludeAddress, ...VIVOX_ROUTE_EXCLUDE_ADDRESSES])
                    ]
                    setValues({ ...values, routeExcludeAddress: addresses })
                  }}
                >
                  {t('pages.tun.addVivoxNetworks')}
                </Button>
              </div>
            </SettingItem>
            <EditableList
              items={values.routeExcludeAddress}
              placeholder={t('pages.tun.exampleNetwork')}
              onChange={(list) => setValues({ ...values, routeExcludeAddress: list as string[] })}
              divider={false}
            />
          </div>
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Tun
