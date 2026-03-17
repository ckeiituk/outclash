import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR, { mutate } from "swr";
import { useLockFn } from "ahooks";
import { invoke } from "@tauri-apps/api/core";
import getSystem from "@/utils/get-system";

// Сервисы и хуки
import { useClash } from "@/hooks/use-clash";
import { useVerge } from "@/hooks/use-verge";
import { updateGeoData, closeAllConnections } from "@/services/api";
import { showNotice } from "@/services/noticeService";
import { useServiceInstaller } from "@/hooks/useServiceInstaller";
import { getRunningMode, invoke_uwp_tool } from "@/services/cmds";

// Компоненты
import { DialogRef, Switch } from "@/components/base";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuardState } from "./mods/guard-state";

// Иконки
import {
  Settings,
  Network,
  Dna,
  Globe2,
  Timer,
  FileText,
  Plug,
  RadioTower,
  LayoutDashboard,
  Cog,
  Repeat,
  Map as MapIcon,
} from "lucide-react";

// Модальные окна
import { ClashCoreViewer } from "./mods/clash-core-viewer";
import { ClashPortViewer } from "./mods/clash-port-viewer";
import { ControllerViewer } from "./mods/controller-viewer";
import { DnsViewer } from "./mods/dns-viewer";
import { NetworkInterfaceViewer } from "./mods/network-interface-viewer";
import { WebUIViewer } from "./mods/web-ui-viewer";

const isWIN = getSystem() === "windows";

interface Props {
  onError: (err: Error) => void;
}

// Компонент для строки настроек
const SettingRow = ({
  label,
  extra,
  children,
  onClick,
}: {
  label: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    className={`flex items-center justify-between py-3 border-b border-border last:border-b-0 ${onClick ? "cursor-pointer hover:bg-accent/50 -mx-3 px-3 rounded-md" : ""}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium">{label}</div>
      {extra && <div className="text-muted-foreground">{extra}</div>}
    </div>
    <div>{children}</div>
  </div>
);

// Вспомогательная функция для создания лейбла с иконкой
const LabelWithIcon = ({
  icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) => {
  const Icon = icon;
  return (
    <span className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {text}
    </span>
  );
};

const SettingClash = ({ onError }: Props) => {
  const { t } = useTranslation();

  const { clash, version, mutateClash, patchClash } = useClash();
  const { verge, mutateVerge, patchVerge } = useVerge();

  const {
    ipv6,
    "allow-lan": allowLan,
    "log-level": logLevel,
    "unified-delay": unifiedDelay,
  } = clash ?? {};

  const { verge_mixed_port } = verge ?? {};

  const [dnsSettingsEnabled, setDnsSettingsEnabled] = useState(() => {
    return verge?.enable_dns_settings ?? false;
  });

  const webRef = useRef<DialogRef>(null);
  const portRef = useRef<DialogRef>(null);
  const ctrlRef = useRef<DialogRef>(null);
  const coreRef = useRef<DialogRef>(null);
  const networkRef = useRef<DialogRef>(null);
  const dnsRef = useRef<DialogRef>(null);

  const onSwitchFormat = (value: boolean) => value;
  const onSelectFormat = (value: string) => value;

  const onChangeData = (patch: Partial<IConfigData>) => {
    mutateClash((old) => ({ ...(old! || {}), ...patch }), false);
  };

  const onUpdateGeo = useLockFn(async () => {
    try {
      await updateGeoData();
      showNotice("success", t("GeoData Updated"));
    } catch (err: any) {
      showNotice("error", err?.response?.data?.message || err.toString());
    }
  });

  const handleDnsToggle = useLockFn(async (enable: boolean) => {
    try {
      setDnsSettingsEnabled(enable);
      localStorage.setItem("dns_settings_enabled", String(enable));
      await patchVerge({ enable_dns_settings: enable });
      await invoke("apply_dns_config", { apply: enable });
      setTimeout(() => {
        mutateClash();
      }, 500);
    } catch (err: any) {
      setDnsSettingsEnabled(!enable);
      localStorage.setItem("dns_settings_enabled", String(!enable));
      showNotice("error", err.message || err.toString());
      await patchVerge({ enable_dns_settings: !enable }).catch(() => {});
      throw err;
    }
  });

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">{t("Clash Setting")}</h3>
      <div className="space-y-1">
        <WebUIViewer ref={webRef} />
        <ClashPortViewer ref={portRef} />
        <ControllerViewer ref={ctrlRef} />
        <ClashCoreViewer ref={coreRef} />
        <NetworkInterfaceViewer ref={networkRef} />
        <DnsViewer ref={dnsRef} />

        <SettingRow
          label={<LabelWithIcon icon={Network} text={t("Allow Lan")} />}
          extra={
            <TooltipIcon
              tooltip={t("Network Interface")}
              icon={<Settings className="h-4 w-4" />}
              onClick={() => networkRef.current?.open()}
            />
          }
        >
          <GuardState
            value={allowLan ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ "allow-lan": e })}
            onGuard={(e) => patchClash({ "allow-lan": e })}
            onCatch={onError}
          >
            <Switch />
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={Dna} text={t("DNS Overwrite")} />}
          extra={
            <TooltipIcon
              tooltip={t("DNS Settings")}
              icon={<Settings className="h-4 w-4" />}
              onClick={() => dnsRef.current?.open()}
            />
          }
        >
          <Switch
            checked={dnsSettingsEnabled}
            onCheckedChange={handleDnsToggle}
          />
        </SettingRow>

        <SettingRow label={<LabelWithIcon icon={Globe2} text={t("IPv6")} />}>
          <GuardState
            value={ipv6 ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ ipv6: e })}
            onGuard={(e) => patchClash({ ipv6: e })}
            onCatch={onError}
          >
            <Switch />
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={Timer} text={t("Unified Delay")} />}
          extra={<TooltipIcon tooltip={t("Unified Delay Info")} />}
        >
          <GuardState
            value={unifiedDelay ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ "unified-delay": e })}
            onGuard={(e) => patchClash({ "unified-delay": e })}
            onCatch={onError}
          >
            <Switch />
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={FileText} text={t("Log Level")} />}
          extra={<TooltipIcon tooltip={t("Log Level Info")} />}
        >
          <GuardState
            value={logLevel ?? "info"}
            valueProps="value"
            onChangeProps="onValueChange"
            onFormat={onSelectFormat}
            onChange={(e) => onChangeData({ "log-level": e })}
            onGuard={(e) => patchClash({ "log-level": e })}
            onCatch={onError}
          >
            <Select value={logLevel}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="silent">Silent</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={Plug} text={t("Port Config")} />}
        >
          <Button
            variant="outline"
            className="w-28 h-8 font-mono"
            onClick={() => portRef.current?.open()}
          >
            {verge_mixed_port ?? 7897}
          </Button>
        </SettingRow>

        <SettingRow
          onClick={() => ctrlRef.current?.open()}
          label={
            <div className="flex items-center gap-3">
              <RadioTower className="h-4 w-4 text-muted-foreground" />
              {t("External Controller")}{" "}
              <TooltipIcon
                tooltip={t(
                  "Enable one-click random API port and key. Click to randomize the port and key",
                )}
              />
            </div>
          }
        />

        <SettingRow
          onClick={() => webRef.current?.open()}
          label={
            <LabelWithIcon icon={LayoutDashboard} text={t("Yacd Web UI")} />
          }
        />

        <SettingRow
          label={<LabelWithIcon icon={Cog} text={t("Clash Core")} />}
          extra={
            <TooltipIcon
              tooltip={t("Clash Core Settings")}
              icon={<Settings className="h-4 w-4" />}
              onClick={() => coreRef.current?.open()}
            />
          }
        >
          <p className="text-sm font-medium pr-2 font-mono">{version}</p>
        </SettingRow>

        {isWIN && (
          <SettingRow
            onClick={useLockFn(invoke_uwp_tool)}
            label={
              <LabelWithIcon icon={Repeat} text={t("UWP Loopback Tool")} />
            }
            extra={<TooltipIcon tooltip={t("Open UWP tool Info")} />}
          />
        )}

        <SettingRow
          onClick={onUpdateGeo}
          label={<LabelWithIcon icon={MapIcon} text={t("Update GeoData")} />}
        />
      </div>
    </div>
  );
};

export default SettingClash;
