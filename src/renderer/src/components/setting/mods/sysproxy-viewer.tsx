import {
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
  useEffect,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import useSWR, { mutate } from "swr";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

// Новые импорты
import { DialogRef, Switch } from "@/components/base";
import { BaseFieldset } from "@/components/base/base-fieldset";
import { EditorViewer } from "@/components/profile/editor-viewer";
import { useVerge } from "@/hooks/use-verge";
import { useAppData } from "@/providers/app-data-provider";
import { getClashConfig } from "@/services/api";
import {
  getAutotemProxy,
  getNetworkInterfacesInfo,
  getSystemHostname,
  getSystemProxy,
  patchVergeConfig,
} from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import getSystem from "@/utils/get-system";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Edit, Loader2 } from "lucide-react";
import { cn } from "@root/lib/utils";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";

// --- Вся ваша оригинальная логика, константы и хелперы ---
const DEFAULT_PAC = `function FindProxyForURL(url, host) { return "PROXY %proxy_host%:%mixed-port%; SOCKS5 %proxy_host%:%mixed-port%; DIRECT;"; }`;
const ipv4_part = String.raw`\d{1,3}`;
const rDomainSimple =
  String.raw`(?:[a-z0-9\-\*]+\.|\*)*` + String.raw`(?:\w{2,64}\*?|\*)`;
const ipv6_part = "(?:[a-fA-F0-9:])+";
const rLocal = `localhost|<local>|localdomain`;
const getValidReg = (isWindows: boolean) => {
  const rIPv4Unix = String.raw`(?:${ipv4_part}\.){3}${ipv4_part}(?:\/\d{1,2})?`;
  const rIPv4Windows = String.raw`(?:${ipv4_part}\.){3}${ipv4_part}`;
  const rIPv6Unix = String.raw`(?:${ipv6_part}:+)+${ipv6_part}(?:\/\d{1,3})?`;
  const rIPv6Windows = String.raw`(?:${ipv6_part}:+)+${ipv6_part}`;
  const rValidPart = `${rDomainSimple}|${isWindows ? rIPv4Windows : rIPv4Unix}|${isWindows ? rIPv6Windows : rIPv6Unix}|${rLocal}`;
  const separator = isWindows ? ";" : ",";
  const rValid = String.raw`^(${rValidPart})(?:${separator}\s?(${rValidPart}))*${separator}?$`;
  return new RegExp(rValid);
};

// --- Компонент Combobox для замены Autocomplete ---
const Combobox = ({
  options,
  value,
  onValueChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 h-8 justify-between font-normal"
        >
          {value || placeholder || "Select..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command onValueChange={onValueChange}>
          <CommandInput placeholder="Search or type..." />
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandList>
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={(currentValue) => {
                  onValueChange(
                    options.find((opt) => opt.toLowerCase() === currentValue) ||
                      "",
                  );
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option ? "opacity-100" : "opacity-0",
                  )}
                />
                {option}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// --- Наш переиспользуемый компонент для строки настроек ---
const SettingRow = ({
  label,
  children,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-2">
    <Label className="text-sm text-muted-foreground flex items-center gap-2">
      {label}
    </Label>
    <div>{children}</div>
  </div>
);

export const SysproxyViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const isWindows = getSystem() === "windows";
  const validReg = useMemo(() => getValidReg(isWindows), [isWindows]);

  const [open, setOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { verge, patchVerge, mutateVerge } = useVerge();
  const [hostOptions, setHostOptions] = useState<string[]>([]);

  type SysProxy = Awaited<ReturnType<typeof getSystemProxy>>;
  const [sysproxy, setSysproxy] = useState<SysProxy>();

  type AutoProxy = Awaited<ReturnType<typeof getAutotemProxy>>;
  const [autoproxy, setAutoproxy] = useState<AutoProxy>();

  const {
    enable_system_proxy: enabled,
    proxy_auto_config,
    pac_file_content,
    enable_proxy_guard,
    use_default_bypass,
    system_proxy_bypass,
    proxy_guard_duration,
    proxy_host,
  } = verge ?? {};

  const [value, setValue] = useState({
    guard: enable_proxy_guard,
    bypass: system_proxy_bypass,
    duration: proxy_guard_duration ?? 10,
    use_default: use_default_bypass ?? true,
    pac: proxy_auto_config,
    pac_content: pac_file_content ?? DEFAULT_PAC,
    proxy_host: proxy_host ?? "127.0.0.1",
  });

  const defaultBypass = () => {
    if (isWindows)
      return "localhost;127.*;192.168.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;<local>";
    if (getSystem() === "linux")
      return "localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,172.29.0.0/16,::1";
    return "127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,172.29.0.0/16,localhost,*.local,*.crashlytics.com,<local>";
  };

  const { data: clashConfig } = useSWR("getClashConfig", getClashConfig, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    dedupingInterval: 1000,
    errorRetryInterval: 5000,
  });
  const [prevMixedPort, setPrevMixedPort] = useState(
    clashConfig?.["mixed-port"],
  );

  useEffect(() => {
    if (
      clashConfig?.["mixed-port"] &&
      clashConfig?.["mixed-port"] !== prevMixedPort
    ) {
      setPrevMixedPort(clashConfig?.["mixed-port"]);
      resetSystemProxy();
    }
  }, [clashConfig?.["mixed-port"]]);

  const resetSystemProxy = async () => {
    try {
      const currentSysProxy = await getSystemProxy();
      const currentAutoProxy = await getAutotemProxy();
      if (value.pac ? currentAutoProxy?.enable : currentSysProxy?.enable) {
        await patchVergeConfig({ enable_system_proxy: false });
        await new Promise((resolve) => setTimeout(resolve, 200));
        await patchVergeConfig({ enable_system_proxy: true });
        await Promise.all([
          mutate("getSystemProxy"),
          mutate("getAutotemProxy"),
        ]);
      }
    } catch (err: any) {
      showNotice("error", err.toString());
    }
  };

  const { systemProxyAddress } = useAppData();

  const getSystemProxyAddress = useMemo(() => {
    if (!clashConfig) return "-";
    const isPacMode = value.pac ?? false;
    if (isPacMode) {
      const host = value.proxy_host || "127.0.0.1";
      const port = verge?.verge_mixed_port || clashConfig["mixed-port"] || 7897;
      return `${host}:${port}`;
    } else {
      return systemProxyAddress;
    }
  }, [
    value.pac,
    value.proxy_host,
    verge?.verge_mixed_port,
    clashConfig,
    systemProxyAddress,
  ]);

  const getCurrentPacUrl = useMemo(() => {
    const host = value.proxy_host || "127.0.0.1";
    const port = import.meta.env.DEV ? 11233 : 33331;
    return `http://${host}:${port}/commands/pac`;
  }, [value.proxy_host]);

  const fetchNetworkInterfaces = async () => {
    try {
      const interfaces = await getNetworkInterfacesInfo();
      const ipAddresses: string[] = [];
      interfaces.forEach((iface) => {
        iface.addr.forEach((address) => {
          if (address.V4 && address.V4.ip) ipAddresses.push(address.V4.ip);
          if (address.V6 && address.V6.ip) ipAddresses.push(address.V6.ip);
        });
      });
      let hostname = "";
      try {
        hostname = await getSystemHostname();
        if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
          hostname = hostname + ".local";
        }
      } catch (err) {
        console.error("Failed to get hostname:", err);
      }
      const options = ["127.0.0.1", "localhost"];
      if (hostname) options.push(hostname);
      options.push(...ipAddresses);
      setHostOptions(Array.from(new Set(options)));
    } catch (error) {
      console.error("Failed to get network interfaces:", error);
      setHostOptions(["127.0.0.1", "localhost"]);
    }
  };

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValue({
        guard: enable_proxy_guard,
        bypass: system_proxy_bypass,
        duration: proxy_guard_duration ?? 10,
        use_default: use_default_bypass ?? true,
        pac: proxy_auto_config,
        pac_content: pac_file_content ?? DEFAULT_PAC,
        proxy_host: proxy_host ?? "127.0.0.1",
      });
      getSystemProxy().then(setSysproxy);
      getAutotemProxy().then(setAutoproxy);
      fetchNetworkInterfaces();
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    if (value.duration < 1) {
      showNotice(
        "error",
        t("Proxy Daemon Duration Cannot be Less than 1 Second"),
      );
      return;
    }
    if (value.bypass && !validReg.test(value.bypass)) {
      showNotice("error", t("Invalid Bypass Format"));
      return;
    }

    // 修改验证规则，允许IP和主机名
    const ipv4Regex =
      /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    const hostnameRegex =
      /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

    if (
      !ipv4Regex.test(value.proxy_host) &&
      !ipv6Regex.test(value.proxy_host) &&
      !hostnameRegex.test(value.proxy_host)
    ) {
      showNotice("error", t("Invalid Proxy Host Format"));
      return;
    }

    setSaving(true);
    setOpen(false);
    setSaving(false);
    const patch: Partial<IVergeConfig> = {};

    if (value.guard !== enable_proxy_guard) {
      patch.enable_proxy_guard = value.guard;
    }
    if (value.duration !== proxy_guard_duration) {
      patch.proxy_guard_duration = value.duration;
    }
    if (value.bypass !== system_proxy_bypass) {
      patch.system_proxy_bypass = value.bypass;
    }
    if (value.pac !== proxy_auto_config) {
      patch.proxy_auto_config = value.pac;
    }
    if (value.use_default !== use_default_bypass) {
      patch.use_default_bypass = value.use_default;
    }

    let pacContent = value.pac_content;
    if (pacContent) {
      pacContent = pacContent.replace(/%proxy_host%/g, value.proxy_host);
      // 将 mixed-port 转换为字符串
      const mixedPortStr = (clashConfig?.["mixed-port"] || "").toString();
      pacContent = pacContent.replace(/%mixed-port%/g, mixedPortStr);
    }

    if (pacContent !== pac_file_content) {
      patch.pac_file_content = pacContent;
    }

    // 处理IPv6地址，如果是IPv6地址但没有被方括号包围，则添加方括号
    let proxyHost = value.proxy_host;
    if (
      ipv6Regex.test(proxyHost) &&
      !proxyHost.startsWith("[") &&
      !proxyHost.endsWith("]")
    ) {
      proxyHost = `[${proxyHost}]`;
    }

    if (proxyHost !== proxy_host) {
      patch.proxy_host = proxyHost;
    }

    // 判断是否需要重置系统代理
    const needResetProxy =
      value.pac !== proxy_auto_config ||
      proxyHost !== proxy_host ||
      pacContent !== pac_file_content ||
      value.bypass !== system_proxy_bypass ||
      value.use_default !== use_default_bypass;

    Promise.resolve().then(async () => {
      try {
        // 乐观更新本地状态
        if (Object.keys(patch).length > 0) {
          mutateVerge({ ...verge, ...patch }, false);
        }
        if (Object.keys(patch).length > 0) {
          await patchVerge(patch);
        }
        setTimeout(async () => {
          try {
            await Promise.all([
              mutate("getSystemProxy"),
              mutate("getAutotemProxy"),
            ]);

            // 如果需要重置代理且代理当前启用
            if (needResetProxy && enabled) {
              const [currentSysProxy, currentAutoProxy] = await Promise.all([
                getSystemProxy(),
                getAutotemProxy(),
              ]);

              const isProxyActive = value.pac
                ? currentAutoProxy?.enable
                : currentSysProxy?.enable;

              if (isProxyActive) {
                await patchVergeConfig({ enable_system_proxy: false });
                await new Promise((resolve) => setTimeout(resolve, 50));
                await patchVergeConfig({ enable_system_proxy: true });
                await Promise.all([
                  mutate("getSystemProxy"),
                  mutate("getAutotemProxy"),
                ]);
              }
            }
          } catch (err) {
            console.warn("Proxy status update failed:", err);
          }
        }, 50);
      } catch (err: any) {
        console.error("Configuration save failed:", err);
        mutateVerge();
        showNotice("error", err.toString());
        // setOpen(true);
      }
    });
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("System Proxy Setting")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-4 py-4 px-1">
            <BaseFieldset label={t("Current System Proxy")}>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("Enable status")}
                  </span>
                  <span>
                    {value.pac
                      ? autoproxy?.enable
                        ? t("Enabled")
                        : t("Disabled")
                      : sysproxy?.enable
                        ? t("Enabled")
                        : t("Disabled")}
                  </span>
                </div>
                {!value.pac && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("Server Addr")}
                    </span>
                    <span className="font-mono">{getSystemProxyAddress}</span>
                  </div>
                )}
                {value.pac && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("PAC URL")}
                    </span>
                    <span className="font-mono">{getCurrentPacUrl || "-"}</span>
                  </div>
                )}
              </div>
            </BaseFieldset>

            <SettingRow label={t("Proxy Host")}>
              <Combobox
                options={hostOptions}
                value={value.proxy_host}
                onValueChange={(val) =>
                  setValue((v) => ({ ...v, proxy_host: val }))
                }
                placeholder="127.0.0.1"
              />
            </SettingRow>
            <SettingRow label={t("Use PAC Mode")}>
              <Switch
                disabled={!enabled}
                checked={value.pac}
                onCheckedChange={(e) => setValue((v) => ({ ...v, pac: e }))}
              />
            </SettingRow>
            <SettingRow
              label={
                <>
                  {t("Proxy Guard")}{" "}
                  <TooltipIcon tooltip={t("Proxy Guard Info")} />
                </>
              }
            >
              <Switch
                disabled={!enabled}
                checked={value.guard}
                onCheckedChange={(e) => setValue((v) => ({ ...v, guard: e }))}
              />
            </SettingRow>
            <SettingRow label={t("Guard Duration")}>
              <div className="flex items-center gap-2">
                <Input
                  disabled={!enabled}
                  type="number"
                  className="w-24 h-8"
                  value={value.duration}
                  onChange={(e) =>
                    setValue((v) => ({
                      ...v,
                      duration: +e.target.value.replace(/\D/, ""),
                    }))
                  }
                />
                <span className="text-sm text-muted-foreground">s</span>
              </div>
            </SettingRow>
            {!value.pac && (
              <SettingRow label={t("Always use Default Bypass")}>
                <Switch
                  disabled={!enabled}
                  checked={value.use_default}
                  onCheckedChange={(e) =>
                    setValue((v) => ({
                      ...v,
                      use_default: e,
                      bypass: !e && !v.bypass ? defaultBypass() : v.bypass,
                    }))
                  }
                />
              </SettingRow>
            )}
            {!value.pac && !value.use_default && (
              <div className="space-y-2">
                <Label>{t("Proxy Bypass")}</Label>
                <Textarea
                  id="proxy-bypass"
                  disabled={!enabled}
                  rows={4}
                  value={value.bypass}
                  onChange={(e) =>
                    setValue((v) => ({ ...v, bypass: e.target.value }))
                  }
                  // Вместо пропса `error` используем условные классы
                  className={cn(
                    value.bypass &&
                      !validReg.test(value.bypass) &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
              </div>
            )}
            {value.pac && (
              <SettingRow label={t("PAC Script Content")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditorOpen(true)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t("Edit")} PAC
                </Button>
              </SettingRow>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("Cancel")}
              </Button>
            </DialogClose>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {editorOpen && (
        <EditorViewer
          open={true}
          title={`${t("Edit")} PAC`}
          initialData={Promise.resolve(value.pac_content ?? "")}
          language="javascript"
          onSave={(_prev, curr) => {
            let pac = DEFAULT_PAC;
            if (curr && curr.trim().length > 0) {
              pac = curr;
            }
            setValue((v) => ({ ...v, pac_content: pac }));
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  );
});
