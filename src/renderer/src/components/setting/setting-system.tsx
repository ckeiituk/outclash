import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { mutate } from "swr";
import { invoke } from "@tauri-apps/api/core";
import getSystem from "@/utils/get-system";

// Сервисы и хуки
import { useVerge } from "@/hooks/use-verge";
import { useSystemProxyState } from "@/hooks/use-system-proxy-state"; // Ваш хук
import { useSystemState } from "@/hooks/use-system-state";
import { useServiceInstaller } from "@/hooks/useServiceInstaller";
import {
  uninstallService,
  restartCore,
  stopCore,
  invoke_uwp_tool,
} from "@/services/cmds";
import { showNotice } from "@/services/noticeService";

// Компоненты
import { DialogRef, Switch } from "@/components/base";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { GuardState } from "./mods/guard-state";

// Иконки
import {
  Settings,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  Wrench,
  Trash2,
  Funnel,
  Monitor,
  Power,
  BellOff,
  Repeat,
  Fingerprint,
} from "lucide-react";

// Модальные окна
import { SysproxyViewer } from "./mods/sysproxy-viewer";
import { TunViewer } from "./mods/tun-viewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfiles } from "@/hooks/use-profiles";

const isWIN = getSystem() === "windows";
interface Props {
  onError?: (err: Error) => void;
}

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

const SettingSystem = ({ onError }: Props) => {
  const { t } = useTranslation();
  const { verge, patchVerge, mutateVerge } = useVerge();
  const { installServiceAndRestartCore } = useServiceInstaller();

  const { profiles } = useProfiles();
  const hasProfiles = useMemo(() => {
    const items = profiles?.items ?? [];
    return items.some((p) => p.type === "local" || p.type === "remote");
  }, [profiles]);

  const {
    actualState: systemProxyActualState,
    indicator: systemProxyIndicator,
    toggleSystemProxy,
  } = useSystemProxyState();

  const { isAdminMode, isServiceMode, mutateRunningMode } = useSystemState();
  const isTunAvailable = isServiceMode || isAdminMode;

  const sysproxyRef = useRef<DialogRef>(null);
  const tunRef = useRef<DialogRef>(null);

  const { enable_tun_mode, enable_auto_launch, enable_silent_start } =
    verge ?? {};

  const onSwitchFormat = (val: boolean) => val;
  const onChangeData = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false);
  };

  const handleServiceOperation = useLockFn(
    async ({
      beforeMsg,
      action,
      actionMsg,
      successMsg,
    }: {
      beforeMsg: string;
      action: () => Promise<void>;
      actionMsg: string;
      successMsg: string;
    }) => {
      try {
        showNotice("info", beforeMsg);
        await stopCore();
        showNotice("info", actionMsg);
        await action();
        showNotice("success", successMsg);
        showNotice("info", t("Restarting Core..."));
        await restartCore();
        await mutateRunningMode();
      } catch (err: any) {
        showNotice("error", err.message || err.toString());
        try {
          showNotice("info", t("Try running core as Sidecar..."));
          await restartCore();
          await mutateRunningMode();
        } catch (e: any) {
          showNotice("error", e?.message || e?.toString());
        }
      }
    },
  );

  const onUninstallService = () =>
    handleServiceOperation({
      beforeMsg: t("Stopping Core..."),
      action: uninstallService,
      actionMsg: t("Uninstalling Service..."),
      successMsg: t("Service Uninstalled Successfully"),
    });

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">{t("System Setting")}</h3>
      <div className="space-y-1">
        <SysproxyViewer ref={sysproxyRef} />
        <TunViewer ref={tunRef} />

        <SettingRow
          label={<LabelWithIcon icon={Funnel} text={t("Tun Mode")} />}
          extra={
            <div className="flex items-center gap-1">
              <TooltipIcon
                tooltip={t("Tun Mode Info")}
                icon={<Settings className="h-4 w-4" />}
                onClick={() => tunRef.current?.open()}
              />
              {!isTunAvailable && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("TUN requires Service Mode or Admin Mode")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {!isServiceMode && !isAdminMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={installServiceAndRestartCore}
                      >
                        <Wrench className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("Install Service")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isServiceMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onUninstallService}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("Uninstall Service")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          }
        >
          <GuardState
            value={enable_tun_mode ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ enable_tun_mode: e })}
            onGuard={(e) => {
              if (!isTunAvailable) {
                showNotice(
                  "error",
                  t("TUN requires Service Mode or Admin Mode"),
                );
                return Promise.reject(
                  new Error(t("TUN requires Service Mode or Admin Mode")),
                );
              }
              if (e) {
                return patchVerge({
                  enable_tun_mode: true,
                  enable_system_proxy: false,
                });
              } else {
                return patchVerge({ enable_tun_mode: false });
              }
            }}
            onCatch={onError}
          >
            <Switch disabled={!isTunAvailable || !hasProfiles} />
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={Monitor} text={t("System Proxy")} />}
          extra={
            <div className="flex items-center gap-2">
              <TooltipIcon
                tooltip={t("System Proxy Info")}
                icon={<Settings className="h-4 w-4" />}
                onClick={() => sysproxyRef.current?.open()}
              />
              {systemProxyIndicator ? (
                <PlayCircle className="h-5 w-5 text-green-500" />
              ) : (
                <PauseCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          }
        >
          <GuardState
            value={systemProxyActualState}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onGuard={(e) => {
              if (e) {
                patchVerge({ enable_tun_mode: false });
                return toggleSystemProxy(true);
              } else {
                return toggleSystemProxy(false);
              }
            }}
            onCatch={onError}
          >
            <Switch disabled={!hasProfiles} />
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={Power} text={t("Auto Launch")} />}
          extra={
            isAdminMode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("Administrator mode may not support auto launch")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
        >
          <GuardState
            value={enable_auto_launch ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ enable_auto_launch: e })}
            onGuard={async (e) => {
              if (isAdminMode) {
                showNotice(
                  "info",
                  t("Administrator mode may not support auto launch"),
                );
              }
              try {
                onChangeData({ enable_auto_launch: e });
                await patchVerge({ enable_auto_launch: e });
                await mutate("getAutoLaunchStatus");
                return Promise.resolve();
              } catch (error) {
                onChangeData({ enable_auto_launch: !e });
                return Promise.reject(error);
              }
            }}
            onCatch={onError}
          >
            <Switch />
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={BellOff} text={t("Silent Start")} />}
          extra={<TooltipIcon tooltip={t("Silent Start Info")} />}
        >
          <GuardState
            value={enable_silent_start ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ enable_silent_start: e })}
            onGuard={(e) => patchVerge({ enable_silent_start: e })}
            onCatch={onError}
          >
            <Switch />
          </GuardState>
        </SettingRow>
        <SettingRow
          label={<LabelWithIcon icon={Repeat} text={t("Main Toggle Action")} />}
        >
          <GuardState
            value={verge?.primary_action ?? "tun-mode"}
            valueProps="value"
            onChangeProps="onValueChange"
            onFormat={(val) => val}
            onGuard={(value) =>
              patchVerge({
                primary_action: value as "tun-mode" | "system-proxy",
              })
            }
            onCatch={onError}
          >
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select an action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tun-mode">{t("TUN Mode")}</SelectItem>
                <SelectItem value="system-proxy">
                  {t("System Proxy")}
                </SelectItem>
              </SelectContent>
            </Select>
          </GuardState>
        </SettingRow>

        <SettingRow
          label={<LabelWithIcon icon={Fingerprint} text={t("Send HWID")} />}
        >
          <GuardState
            value={verge?.enable_send_hwid ?? true}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onFormat={onSwitchFormat}
            onChange={(e) => onChangeData({ enable_send_hwid: e })}
            onGuard={(e) => patchVerge({ enable_send_hwid: e })}
            onCatch={onError}
          >
            <Switch disabled={true} />
          </GuardState>
        </SettingRow>
      </div>
    </div>
  );
};

export default SettingSystem;
