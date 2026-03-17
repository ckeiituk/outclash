import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

// Новые импорты
import { useVerge } from "@/hooks/use-verge";
import { DialogRef, Switch } from "@/components/base";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";
import { GuardState } from "./guard-state";
import { copyIconFile, getAppDir } from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import getSystem from "@/utils/get-system";
import { Loader2 } from "lucide-react";

const OS = getSystem();

const getIcons = async (icon_dir: string, name: string) => {
  const updateTime = localStorage.getItem(`icon_${name}_update_time`) || "";
  const icon_png = await join(icon_dir, `${name}-${updateTime}.png`);
  const icon_ico = await join(icon_dir, `${name}-${updateTime}.ico`);
  return { icon_png, icon_ico };
};

// Наш переиспользуемый компонент для строки настроек
const SettingRow = ({
  label,
  extra,
  children,
}: {
  label: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium">{label}</p>
      {extra && <div className="text-muted-foreground">{extra}</div>}
    </div>
    <div>{children}</div>
  </div>
);

export const LayoutViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { verge, patchVerge, mutateVerge } = useVerge();

  const [localConfig, setLocalConfig] = useState<Partial<IVergeConfig>>({});
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [commonIcon, setCommonIcon] = useState("");
  const [sysproxyIcon, setSysproxyIcon] = useState("");
  const [tunIcon, setTunIcon] = useState("");

  const initIconPath = useCallback(async () => {
    const appDir = await getAppDir();
    const icon_dir = await join(appDir, "icons");
    const { icon_png: common_icon_png, icon_ico: common_icon_ico } =
      await getIcons(icon_dir, "common");
    const { icon_png: sysproxy_icon_png, icon_ico: sysproxy_icon_ico } =
      await getIcons(icon_dir, "sysproxy");
    const { icon_png: tun_icon_png, icon_ico: tun_icon_ico } = await getIcons(
      icon_dir,
      "tun",
    );

    setCommonIcon(
      (await exists(common_icon_ico)) ? common_icon_ico : common_icon_png,
    );
    setSysproxyIcon(
      (await exists(sysproxy_icon_ico)) ? sysproxy_icon_ico : sysproxy_icon_png,
    );
    setTunIcon((await exists(tun_icon_ico)) ? tun_icon_ico : tun_icon_png);
  }, []);

  useEffect(() => {
    if (open) {
      setLocalConfig(verge ?? {});
      initIconPath();
    }
  }, [open, verge, initIconPath]);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  const handleConfigChange = (patch: Partial<IVergeConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleIconChange = useLockFn(
    async (type: "common" | "sysproxy" | "tun") => {
      const key = `${type}_tray_icon` as keyof IVergeConfig;
      if (localConfig[key]) {
        handleConfigChange({ [key]: false });
      } else {
        const selected = await openDialog({
          directory: false,
          multiple: false,
          filters: [{ name: "Tray Icon Image", extensions: ["png", "ico"] }],
        });
        if (selected) {
          const path = Array.isArray(selected) ? selected[0] : selected;
          await copyIconFile(path, type);
          await initIconPath();
          handleConfigChange({ [key]: true });
        }
      }
    },
  );

  const handleSave = useLockFn(async () => {
    setLoading(true);
    try {
      await patchVerge(localConfig);
      showNotice("success", t("Settings saved successfully"));
      setOpen(false);
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    } finally {
      setLoading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Layout Setting")}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-1">
          {OS === "macos" && (
            <>
              <SettingRow label={t("Tray Icon")}>
                <Select
                  onValueChange={(value) =>
                    handleConfigChange({ tray_icon: value as any })
                  }
                  value={localConfig.tray_icon ?? "monochrome"}
                >
                  <SelectTrigger className="w-40 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monochrome">
                      {t("Monochrome")}
                    </SelectItem>
                    <SelectItem value="colorful">{t("Colorful")}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label={t("Enable Tray Icon")}>
                <Switch
                  checked={localConfig.enable_tray_icon ?? true}
                  onCheckedChange={(checked) =>
                    handleConfigChange({ enable_tray_icon: checked })
                  }
                />
              </SettingRow>
            </>
          )}

          <SettingRow label={t("Common Tray Icon")}>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleIconChange("common")}
            >
              {localConfig.common_tray_icon && commonIcon && (
                <img
                  src={convertFileSrc(commonIcon)}
                  className="h-5 mr-2"
                  alt="common tray icon"
                />
              )}
              {localConfig.common_tray_icon ? t("Clear") : t("Browse")}
            </Button>
          </SettingRow>

          <SettingRow label={t("System Proxy Tray Icon")}>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleIconChange("sysproxy")}
            >
              {localConfig.sysproxy_tray_icon && sysproxyIcon && (
                <img
                  src={convertFileSrc(sysproxyIcon)}
                  className="h-5 mr-2"
                  alt="system proxy tray icon"
                />
              )}
              {localConfig.sysproxy_tray_icon ? t("Clear") : t("Browse")}
            </Button>
          </SettingRow>

          <SettingRow label={t("Tun Tray Icon")}>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleIconChange("tun")}
            >
              {localConfig.tun_tray_icon && tunIcon && (
                <img
                  src={convertFileSrc(tunIcon)}
                  className="h-5 mr-2"
                  alt="tun mode tray icon"
                />
              )}
              {localConfig.tun_tray_icon ? t("Clear") : t("Browse")}
            </Button>
          </SettingRow>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
