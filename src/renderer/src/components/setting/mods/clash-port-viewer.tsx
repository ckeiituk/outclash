import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn, useRequest } from "ahooks";
import { useClashInfo } from "@/hooks/use-clash";
import { useVerge } from "@/hooks/use-verge";
import { showNotice } from "@/services/noticeService";
import getSystem from "@/utils/get-system";

// Новые импорты
import { DialogRef, Switch } from "@/components/base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shuffle, Loader2 } from "lucide-react";

const OS = getSystem();

interface ClashPortViewerRef {
  open: () => void;
  close: () => void;
}

const generateRandomPort = () =>
  Math.floor(Math.random() * (65535 - 1025 + 1)) + 1025;

// Компонент для одной строки настроек порта
const PortSettingRow = ({
  label,
  port,
  setPort,
  isEnabled,
  setIsEnabled,
  isFixed = false,
}: {
  label: string;
  port: number;
  setPort: (port: number) => void;
  isEnabled: boolean;
  setIsEnabled?: (enabled: boolean) => void;
  isFixed?: boolean;
}) => {
  const { t } = useTranslation();

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Удаляем все нечисловые символы
    if (value === "") {
      setPort(0);
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 65535) {
      setPort(num);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="w-24 h-8 text-center"
          value={port || ""}
          onChange={handleNumericChange}
          disabled={!isEnabled}
        />
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPort(generateRandomPort())}
                disabled={!isEnabled}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Random Port")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Switch
          checked={isEnabled}
          onCheckedChange={isFixed ? undefined : setIsEnabled}
          disabled={isFixed}
        />
      </div>
    </div>
  );
};

export const ClashPortViewer = forwardRef<ClashPortViewerRef>((props, ref) => {
  const { t } = useTranslation();
  const { clashInfo, patchInfo } = useClashInfo();
  const { verge, patchVerge } = useVerge();
  const [open, setOpen] = useState(false);

  const [mixedPort, setMixedPort] = useState(0);
  const [socksPort, setSocksPort] = useState(0);
  const [socksEnabled, setSocksEnabled] = useState(false);
  const [httpPort, setHttpPort] = useState(0);
  const [httpEnabled, setHttpEnabled] = useState(false);
  const [redirPort, setRedirPort] = useState(0);
  const [redirEnabled, setRedirEnabled] = useState(false);
  const [tproxyPort, setTproxyPort] = useState(0);
  const [tproxyEnabled, setTproxyEnabled] = useState(false);

  const { loading, run: saveSettings } = useRequest(
    async (params: { clashConfig: any; vergeConfig: any }) => {
      const { clashConfig, vergeConfig } = params;
      await Promise.all([patchInfo(clashConfig), patchVerge(vergeConfig)]);
    },
    {
      manual: true,
      onSuccess: () => {
        setOpen(false);
        showNotice("success", t("Port settings saved"));
      },
      onError: () => {
        showNotice("error", t("Failed to save settings"));
      },
    },
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setMixedPort(verge?.verge_mixed_port ?? clashInfo?.mixed_port ?? 7890);
      setSocksPort(verge?.verge_socks_port ?? 7891);
      setSocksEnabled(verge?.verge_socks_enabled ?? false);
      setHttpPort(verge?.verge_port ?? 7892);
      setHttpEnabled(verge?.verge_http_enabled ?? false);
      setRedirPort(verge?.verge_redir_port ?? 7893);
      setRedirEnabled(verge?.verge_redir_enabled ?? false);
      setTproxyPort(verge?.verge_tproxy_port ?? 7894);
      setTproxyEnabled(verge?.verge_tproxy_enabled ?? false);
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    const portList = [
      mixedPort,
      socksEnabled ? socksPort : -1,
      httpEnabled ? httpPort : -1,
      redirEnabled ? redirPort : -1,
      tproxyEnabled ? tproxyPort : -1,
    ].filter((p) => p > 0);

    if (new Set(portList).size !== portList.length) {
      showNotice("error", t("Port conflict detected"));
      return;
    }

    const allPortsValid = portList.every((port) => port >= 1 && port <= 65535);
    if (!allPortsValid) {
      showNotice("error", t("Port out of range (1-65535)"));
      return;
    }

    const clashConfig = {
      "mixed-port": mixedPort,
      "socks-port": socksEnabled ? socksPort : 0,
      port: httpEnabled ? httpPort : 0,
      "redir-port": redirEnabled ? redirPort : 0,
      "tproxy-port": tproxyEnabled ? tproxyPort : 0,
    };

    const vergeConfig = {
      verge_mixed_port: mixedPort,
      verge_socks_port: socksPort,
      verge_socks_enabled: socksEnabled,
      verge_port: httpPort,
      verge_http_enabled: httpEnabled,
      verge_redir_port: redirPort,
      verge_redir_enabled: redirEnabled,
      verge_tproxy_port: tproxyPort,
      verge_tproxy_enabled: tproxyEnabled,
    };

    await saveSettings({ clashConfig, vergeConfig });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Port Configuration")}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-1">
          <PortSettingRow
            label={t("Mixed Port")}
            port={mixedPort}
            setPort={setMixedPort}
            isEnabled={true}
            isFixed={true}
          />
          <PortSettingRow
            label={t("Socks Port")}
            port={socksPort}
            setPort={setSocksPort}
            isEnabled={socksEnabled}
            setIsEnabled={setSocksEnabled}
          />
          <PortSettingRow
            label={t("Http Port")}
            port={httpPort}
            setPort={setHttpPort}
            isEnabled={httpEnabled}
            setIsEnabled={setHttpEnabled}
          />
          {OS !== "windows" && (
            <PortSettingRow
              label={t("Redir Port")}
              port={redirPort}
              setPort={setRedirPort}
              isEnabled={redirEnabled}
              setIsEnabled={setRedirEnabled}
            />
          )}
          {OS === "linux" && (
            <PortSettingRow
              label={t("Tproxy Port")}
              port={tproxyPort}
              setPort={setTproxyPort}
              isEnabled={tproxyEnabled}
              setIsEnabled={setTproxyEnabled}
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
