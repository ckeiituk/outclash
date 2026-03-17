import { forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { useLockFn } from "ahooks";
import yaml from "js-yaml";
import { useTranslation } from "react-i18next";
import MonacoEditor from "react-monaco-editor";
import { invoke } from "@tauri-apps/api/core";

// Новые импорты
import { DialogRef } from "@/components/base";
import { useThemeMode } from "@/services/states";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, RotateCcw, Code } from "lucide-react";

const DEFAULT_DNS_CONFIG = {
  enable: true,
  listen: ":53",
  "enhanced-mode": "fake-ip" as "fake-ip" | "redir-host",
  "fake-ip-range": "198.18.0.1/16",
  "fake-ip-filter-mode": "blacklist" as "blacklist" | "whitelist",
  "prefer-h3": false,
  "respect-rules": false,
  "use-hosts": false,
  "use-system-hosts": false,
  ipv6: true,
  "fake-ip-filter": [
    "*.lan",
    "*.local",
    "*.arpa",
    "time.*.com",
    "ntp.*.com",
    "+.market.xiaomi.com",
    "localhost.ptlogin2.qq.com",
    "*.msftncsi.com",
    "www.msftconnecttest.com",
  ],
  "default-nameserver": [
    "system",
    "8.8.8.8",
    "1.1.1.1",
    "2001:4860:4860::8888",
  ],
  nameserver: [
    "8.8.8.8",
    "https://doh.pub/dns-query",
    "https://dns.google/dns-query",
    "https://cloudflare-dns.com/dns-query",
  ],
  fallback: [],
  "nameserver-policy": {},
  "proxy-server-nameserver": [
    "https://doh.pub/dns-query",
    "https://dns.google/dns-query",
    "https://cloudflare-dns.com/dns-query",
    "tls://1.1.1.1",
  ],
  "direct-nameserver": [],
  "direct-nameserver-follow-policy": false,
  "fallback-filter": {
    geoip: true,
    "geoip-code": "CN",
    ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
    domain: ["+.google.com", "+.facebook.com", "+.youtube.com"],
  },
};

interface Props {
  onSave?: (prev?: string, curr?: string) => void;
}

// Функция-помощник, которая всегда возвращает состояние в правильном формате (со строками)
const formatValues = (config: any = {}): any => {
  const dnsConfig = config.dns || {};
  const hostsConfig = config.hosts || {};
  const formatList = (arr: any[] | undefined = []): string =>
    (arr || []).join(", ");
  const formatHosts = (hosts: any): string =>
    !hosts
      ? ""
      : Object.entries(hosts)
          .map(
            ([domain, value]) =>
              `${domain}=${Array.isArray(value) ? value.join(";") : value}`,
          )
          .join(", ");
  const formatNameserverPolicy = (policy: any): string =>
    !policy
      ? ""
      : Object.entries(policy)
          .map(
            ([domain, servers]) =>
              `${domain}=${Array.isArray(servers) ? servers.join(";") : servers}`,
          )
          .join(", ");

  const enhancedMode = dnsConfig["enhanced-mode"];
  const validEnhancedMode = ["fake-ip", "redir-host"].includes(enhancedMode)
    ? enhancedMode
    : DEFAULT_DNS_CONFIG["enhanced-mode"];
  const fakeIpFilterMode = dnsConfig["fake-ip-filter-mode"];
  const validFakeIpFilterMode = ["blacklist", "whitelist"].includes(
    fakeIpFilterMode,
  )
    ? fakeIpFilterMode
    : DEFAULT_DNS_CONFIG["fake-ip-filter-mode"];

  return {
    enable: dnsConfig.enable ?? DEFAULT_DNS_CONFIG.enable,
    listen: dnsConfig.listen ?? DEFAULT_DNS_CONFIG.listen,
    enhancedMode: validEnhancedMode,
    fakeIpRange:
      dnsConfig["fake-ip-range"] ?? DEFAULT_DNS_CONFIG["fake-ip-range"],
    fakeIpFilterMode: validFakeIpFilterMode,
    preferH3: dnsConfig["prefer-h3"] ?? DEFAULT_DNS_CONFIG["prefer-h3"],
    respectRules:
      dnsConfig["respect-rules"] ?? DEFAULT_DNS_CONFIG["respect-rules"],
    useHosts: dnsConfig["use-hosts"] ?? DEFAULT_DNS_CONFIG["use-hosts"],
    useSystemHosts:
      dnsConfig["use-system-hosts"] ?? DEFAULT_DNS_CONFIG["use-system-hosts"],
    ipv6: dnsConfig.ipv6 ?? DEFAULT_DNS_CONFIG.ipv6,
    fakeIpFilter: formatList(
      dnsConfig["fake-ip-filter"] ?? DEFAULT_DNS_CONFIG["fake-ip-filter"],
    ),
    defaultNameserver: formatList(
      dnsConfig["default-nameserver"] ??
        DEFAULT_DNS_CONFIG["default-nameserver"],
    ),
    nameserver: formatList(
      dnsConfig.nameserver ?? DEFAULT_DNS_CONFIG.nameserver,
    ),
    fallback: formatList(dnsConfig.fallback ?? DEFAULT_DNS_CONFIG.fallback),
    proxyServerNameserver: formatList(
      dnsConfig["proxy-server-nameserver"] ??
        DEFAULT_DNS_CONFIG["proxy-server-nameserver"],
    ),
    directNameserver: formatList(
      dnsConfig["direct-nameserver"] ?? DEFAULT_DNS_CONFIG["direct-nameserver"],
    ),
    directNameserverFollowPolicy:
      dnsConfig["direct-nameserver-follow-policy"] ??
      DEFAULT_DNS_CONFIG["direct-nameserver-follow-policy"],
    fallbackGeoip:
      dnsConfig["fallback-filter"]?.geoip ??
      DEFAULT_DNS_CONFIG["fallback-filter"].geoip,
    fallbackGeoipCode:
      dnsConfig["fallback-filter"]?.["geoip-code"] ??
      DEFAULT_DNS_CONFIG["fallback-filter"]["geoip-code"],
    fallbackIpcidr:
      formatList(dnsConfig["fallback-filter"]?.ipcidr) ??
      formatList(DEFAULT_DNS_CONFIG["fallback-filter"].ipcidr),
    fallbackDomain:
      formatList(dnsConfig["fallback-filter"]?.domain) ??
      formatList(DEFAULT_DNS_CONFIG["fallback-filter"].domain),
    nameserverPolicy:
      formatNameserverPolicy(dnsConfig["nameserver-policy"]) || "",
    hosts: formatHosts(hostsConfig) || "",
  };
};

export const DnsViewer = forwardRef<DialogRef, Props>(({ onSave }, ref) => {
  const { t } = useTranslation();
  const themeMode = useThemeMode();
  const [open, setOpen] = useState(false);
  const [visualization, setVisualization] = useState(true);
  const [values, setValues] = useState(() =>
    formatValues({ dns: DEFAULT_DNS_CONFIG, hosts: {} }),
  );
  const [yamlContent, setYamlContent] = useState("");
  const [prevData, setPrevData] = useState("");

  const parseList = (str: string = ""): string[] =>
    str
      ? str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const parseHosts = (str: string): Record<string, any> =>
    str.split(",").reduce(
      (acc, item) => {
        const parts = item.trim().split("=");
        if (parts.length >= 2) {
          const domain = parts[0].trim();
          const valueStr = parts.slice(1).join("=").trim();
          acc[domain] = valueStr.includes(";")
            ? valueStr
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean)
            : valueStr;
        }
        return acc;
      },
      {} as Record<string, any>,
    );
  const parseNameserverPolicy = (str: string): Record<string, any> =>
    str.split(",").reduce(
      (acc, item) => {
        const parts = item.trim().split("=");
        if (parts.length >= 2) {
          const domain = parts[0].trim();
          const serversStr = parts.slice(1).join("=").trim();
          acc[domain] = serversStr.includes(";")
            ? serversStr
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean)
            : serversStr;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

  const generateDnsConfig = () => {
    const dnsConfig: any = {
      enable: values.enable,
      listen: values.listen,
      "enhanced-mode": values.enhancedMode,
      "fake-ip-range": values.fakeIpRange,
      "fake-ip-filter-mode": values.fakeIpFilterMode,
      "prefer-h3": values.preferH3,
      "respect-rules": values.respectRules,
      "use-hosts": values.useHosts,
      "use-system-hosts": values.useSystemHosts,
      ipv6: values.ipv6,
      "fake-ip-filter": parseList(values.fakeIpFilter),
      "default-nameserver": parseList(values.defaultNameserver),
      nameserver: parseList(values.nameserver),
      "direct-nameserver-follow-policy": values.directNameserverFollowPolicy,
      "fallback-filter": {
        geoip: values.fallbackGeoip,
        "geoip-code": values.fallbackGeoipCode,
        ipcidr: parseList(values.fallbackIpcidr),
        domain: parseList(values.fallbackDomain),
      },
    };
    if (values.fallback) dnsConfig["fallback"] = parseList(values.fallback);
    const policy = parseNameserverPolicy(values.nameserverPolicy);
    if (Object.keys(policy).length > 0) dnsConfig["nameserver-policy"] = policy;
    if (values.proxyServerNameserver)
      dnsConfig["proxy-server-nameserver"] = parseList(
        values.proxyServerNameserver,
      );
    if (values.directNameserver)
      dnsConfig["direct-nameserver"] = parseList(values.directNameserver);
    return dnsConfig;
  };

  const updateYamlFromValues = () => {
    const config: Record<string, any> = {};
    const dnsConfig = generateDnsConfig();
    if (Object.keys(dnsConfig).length > 0) {
      config.dns = dnsConfig;
    }
    const hosts = parseHosts(values.hosts);
    if (Object.keys(hosts).length > 0) {
      config.hosts = hosts;
    }
    setYamlContent(yaml.dump(config, { forceQuotes: true }));
  };

  const resetToDefaults = () => {
    const defaultConfig = { dns: DEFAULT_DNS_CONFIG, hosts: {} };
    setValues(formatValues(defaultConfig));
    updateYamlFromValues();
  };

  const initDnsConfig = async () => {
    try {
      const dnsConfigExists = await invoke<boolean>("check_dns_config_exists");
      if (dnsConfigExists) {
        const content = await invoke<string>("get_dns_config_content");
        const config = yaml.load(content) as any;
        setValues(formatValues(config));
        setYamlContent(content);
        setPrevData(content);
      } else {
        resetToDefaults();
      }
    } catch (err) {
      console.error("Failed to initialize DNS config", err);
      resetToDefaults();
    }
  };

  const handleSave = useLockFn(async () => {
    try {
      let finalConfig: Record<string, any>;
      if (visualization) {
        finalConfig = {
          dns: generateDnsConfig(),
          hosts: parseHosts(values.hosts),
        };
      } else {
        const parsed = yaml.load(yamlContent);
        if (typeof parsed !== "object" || parsed === null)
          throw new Error(t("Invalid configuration"));
        finalConfig = parsed as Record<string, any>;
      }

      const currentData = yaml.dump(finalConfig, { forceQuotes: true });
      await invoke("save_dns_config", { dnsConfig: finalConfig });

      const [isValid, errorMsg] = await invoke<[boolean, string]>(
        "validate_dns_config",
        {},
      );
      if (!isValid) {
        const cleanErrorMsg = errorMsg.split(/msg="([^"]+)"/)[1] || errorMsg;
        showNotice(
          "error",
          t("DNS configuration error") + ": " + cleanErrorMsg,
        );
        return;
      }

      onSave?.(prevData, currentData);
      setOpen(false);
      showNotice("success", t("DNS settings saved"));
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  const handleChange =
    (field: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string) => {
      const value =
        typeof e === "string"
          ? e
          : e.target.type === "checkbox"
            ? (e.target as any).checked
            : e.target.value;
      setValues((prev: any) => ({ ...prev, [field]: value }));
    };

  const handleSwitchChange =
    (field: keyof typeof values) => (checked: boolean) => {
      setValues((prev: any) => ({ ...prev, [field]: checked }));
    };

  useEffect(() => {
    if (visualization && open) updateYamlFromValues();
  }, [values, visualization, open]);

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      initDnsConfig();
    },
    close: () => setOpen(false),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader>
          {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
          {/* Добавляем классы flex-wrap и gap-y-2 для корректного переноса */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pr-12">
            <DialogTitle>{t("DNS Overwrite")}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("Reset to Default")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVisualization((prev) => !prev)}
              >
                <Code className="mr-2 h-4 w-4" />
                {visualization ? t("Advanced") : t("Visualization")}
              </Button>
            </div>
          </div>
          {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4">
          {visualization ? (
            <div className="h-full pr-4 -mr-4 space-y-6 overflow-y-auto">
              <Alert
                variant="destructive"
                className="bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="h-4 w-4 !text-amber-500" />
                <AlertTitle>{t("Warning")}</AlertTitle>
                <AlertDescription>{t("DNS Settings Warning")}</AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h4 className="font-semibold">{t("DNS Settings")}</h4>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dns-enable">{t("Enable DNS")}</Label>
                  <Switch
                    id="dns-enable"
                    checked={values.enable}
                    onCheckedChange={handleSwitchChange("enable")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-listen">{t("DNS Listen")}</Label>
                  <Input
                    id="dns-listen"
                    value={values.listen || ""}
                    onChange={handleChange("listen")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("Enhanced Mode")}</Label>
                  <Select
                    value={values.enhancedMode}
                    onValueChange={handleChange("enhancedMode")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fake-ip">fake-ip</SelectItem>
                      <SelectItem value="redir-host">redir-host</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-fake-ip-range">
                    {t("Fake IP Range")}
                  </Label>
                  <Input
                    id="dns-fake-ip-range"
                    value={values.fakeIpRange || ""}
                    onChange={handleChange("fakeIpRange")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("Fake IP Filter Mode")}</Label>
                  <Select
                    value={values.fakeIpFilterMode}
                    onValueChange={handleChange("fakeIpFilterMode")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blacklist">blacklist</SelectItem>
                      <SelectItem value="whitelist">whitelist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("IPv6")}</Label>
                  <Switch
                    checked={values.ipv6}
                    onCheckedChange={handleSwitchChange("ipv6")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("Prefer H3")}</Label>
                  <Switch
                    checked={values.preferH3}
                    onCheckedChange={handleSwitchChange("preferH3")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("Respect Rules")}</Label>
                  <Switch
                    checked={values.respectRules}
                    onCheckedChange={handleSwitchChange("respectRules")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("Use Hosts")}</Label>
                  <Switch
                    checked={values.useHosts}
                    onCheckedChange={handleSwitchChange("useHosts")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("Use System Hosts")}</Label>
                  <Switch
                    checked={values.useSystemHosts}
                    onCheckedChange={handleSwitchChange("useSystemHosts")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("Direct Nameserver Follow Policy")}</Label>
                  <Switch
                    checked={values.directNameserverFollowPolicy}
                    onCheckedChange={handleSwitchChange(
                      "directNameserverFollowPolicy",
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-default-nameserver">
                    {t("Default Nameserver")}
                  </Label>
                  <Textarea
                    id="dns-default-nameserver"
                    value={values.defaultNameserver || ""}
                    onChange={handleChange("defaultNameserver")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-nameserver">{t("Nameserver")}</Label>
                  <Textarea
                    id="dns-nameserver"
                    value={values.nameserver || ""}
                    onChange={handleChange("nameserver")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-fallback">{t("Fallback")}</Label>
                  <Textarea
                    id="dns-fallback"
                    value={values.fallback || ""}
                    onChange={handleChange("fallback")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-proxy-server">
                    {t("Proxy Server Nameserver")}
                  </Label>
                  <Textarea
                    id="dns-proxy-server"
                    value={values.proxyServerNameserver || ""}
                    onChange={handleChange("proxyServerNameserver")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-direct-server">
                    {t("Direct Nameserver")}
                  </Label>
                  <Textarea
                    id="dns-direct-server"
                    value={values.directNameserver || ""}
                    onChange={handleChange("directNameserver")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-fake-ip-filter">
                    {t("Fake IP Filter")}
                  </Label>
                  <Textarea
                    id="dns-fake-ip-filter"
                    value={values.fakeIpFilter || ""}
                    onChange={handleChange("fakeIpFilter")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dns-policy">{t("Nameserver Policy")}</Label>
                  <Textarea
                    id="dns-policy"
                    value={values.nameserverPolicy || ""}
                    onChange={handleChange("nameserverPolicy")}
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold">
                  {t("Fallback Filter Settings")}
                </h4>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fallback-geoip">{t("GeoIP Filtering")}</Label>
                  <Switch
                    id="fallback-geoip"
                    checked={values.fallbackGeoip}
                    onCheckedChange={handleSwitchChange("fallbackGeoip")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fallback-geoip-code">{t("GeoIP Code")}</Label>
                  <Input
                    id="fallback-geoip-code"
                    value={values.fallbackGeoipCode || ""}
                    onChange={handleChange("fallbackGeoipCode")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fallback-ip-cidr">
                    {t("Fallback IP CIDR")}
                  </Label>
                  <Textarea
                    id="fallback-ip-cidr"
                    value={values.fallbackIpcidr || ""}
                    onChange={handleChange("fallbackIpcidr")}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fallback-domain">
                    {t("Fallback Domain")}
                  </Label>
                  <Textarea
                    id="fallback-domain"
                    value={values.fallbackDomain || ""}
                    onChange={handleChange("fallbackDomain")}
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold">{t("Hosts Settings")}</h4>
                <div className="grid gap-2">
                  <Label htmlFor="hosts-settings">{t("Hosts")}</Label>
                  <Textarea
                    id="hosts-settings"
                    value={values.hosts || ""}
                    onChange={handleChange("hosts")}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-md border">
              <MonacoEditor
                height="100%"
                language="yaml"
                value={yamlContent}
                theme={themeMode === "light" ? "vs" : "vs-dark"}
                options={{
                  tabSize: 2,
                  minimap: {
                    enabled: document.documentElement.clientWidth >= 1500,
                  },
                  mouseWheelZoom: true,
                  quickSuggestions: {
                    strings: true,
                    comments: true,
                    other: true,
                  },
                  padding: { top: 16 },
                  fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji"${getSystem() === "windows" ? ", twemoji mozilla" : ""}`,
                  fontLigatures: false,
                  smoothScrolling: true,
                }}
                onChange={(value) => setYamlContent(value || "")}
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
