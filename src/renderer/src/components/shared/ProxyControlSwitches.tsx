import { useRef } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useLockFn } from "ahooks";
import { closeAllConnections } from "@/services/api";
import { showNotice } from "@/services/noticeService";
import { useVerge } from "@/hooks/use-verge";
import { useServiceInstaller } from "@/hooks/useServiceInstaller";
import { getRunningMode } from "@/services/cmds";
import { cn } from "@root/lib/utils";

// Новые импорты
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/base";
import { DialogRef } from "@/components/base";
import { GuardState } from "@/components/setting/mods/guard-state";
import { SysproxyViewer } from "@/components/setting/mods/sysproxy-viewer";
import { TunViewer } from "@/components/setting/mods/tun-viewer";
import { Settings, PlayCircle, PauseCircle, Wrench } from "lucide-react";

interface ProxySwitchProps {
  label?: string;
  onError?: (err: Error) => void;
}

const ProxyControlSwitches = ({ label, onError }: ProxySwitchProps) => {
  const { t } = useTranslation();
  const { verge, mutateVerge, patchVerge } = useVerge();
  const { installServiceAndRestartCore } = useServiceInstaller();

  const { data: runningMode } = useSWR("getRunningMode", getRunningMode);
  const isSidecarMode = runningMode === "Sidecar";

  const sysproxyRef = useRef<DialogRef>(null);
  const tunRef = useRef<DialogRef>(null);

  const { enable_tun_mode, enable_system_proxy } = verge ?? {};

  const isSystemProxyMode = label === t("System Proxy") || !label;
  const isTunMode = label === t("Tun Mode");

  const onChangeData = (patch: Partial<IVergeConfig>) =>
    mutateVerge({ ...verge, ...patch }, false);
  const onInstallService = installServiceAndRestartCore;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-2">
        {/* Системный прокси */}
        {isSystemProxyMode && (
          <div
            className={cn(
              "flex items-center justify-between p-2 rounded-lg transition-colors",
              enable_system_proxy && "bg-green-500/10",
            )}
          >
            <div className="flex items-center gap-3">
              {enable_system_proxy ? (
                <PlayCircle className="h-7 w-7 text-green-600" />
              ) : (
                <PauseCircle className="h-7 w-7 text-muted-foreground" />
              )}
              <div>
                <p className="font-semibold text-sm">{t("System Proxy")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Enable this for most users")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => sysproxyRef.current?.open()}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("System Proxy Info")}</p>
                </TooltipContent>
              </Tooltip>
              <GuardState
                value={enable_system_proxy ?? false}
                valueProps="checked"
                onCatch={onError}
                onFormat={(e) => e}
                onChange={(e) => onChangeData({ enable_system_proxy: e })}
                onGuard={async (e) => {
                  if (!e && verge?.auto_close_connection) {
                    closeAllConnections();
                  }
                  await patchVerge({ enable_system_proxy: e });
                }}
              >
                <Switch />
              </GuardState>
            </div>
          </div>
        )}

        {/* TUN режим */}
        {isTunMode && (
          <div
            className={cn(
              "flex items-center justify-between p-2 rounded-lg transition-colors",
              enable_tun_mode && "bg-green-500/10",
              isSidecarMode && "opacity-60",
            )}
          >
            <div className="flex items-center gap-3">
              {enable_tun_mode ? (
                <PlayCircle className="h-7 w-7 text-green-600" />
              ) : (
                <PauseCircle className="h-7 w-7 text-muted-foreground" />
              )}
              <div>
                <p className="font-semibold text-sm">{t("Tun Mode")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("System-level virtual network adapter")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isSidecarMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={onInstallService}
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("Install Service")}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => tunRef.current?.open()}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("Tun Mode Info")}</p>
                </TooltipContent>
              </Tooltip>
              <GuardState
                value={enable_tun_mode ?? false}
                valueProps="checked"
                onCatch={onError}
                onFormat={(e) => e}
                onChange={(e) => {
                  if (isSidecarMode) return Promise.reject();
                  onChangeData({ enable_tun_mode: e });
                }}
                onGuard={(e) => {
                  if (isSidecarMode) {
                    showNotice(
                      "error",
                      t("TUN requires Service Mode or Admin Mode"),
                    );
                    return Promise.reject();
                  }
                  return patchVerge({ enable_tun_mode: e });
                }}
              >
                <Switch disabled={isSidecarMode} />
              </GuardState>
            </div>
          </div>
        )}

        <SysproxyViewer ref={sysproxyRef} />
        <TunViewer ref={tunRef} />
      </div>
    </TooltipProvider>
  );
};

export default ProxyControlSwitches;
