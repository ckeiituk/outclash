import { forwardRef, useImperativeHandle, useState } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";

// Новые импорты
import { useVerge } from "@/hooks/use-verge";
import { DialogRef, Switch } from "@/components/base";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";
import { showNotice } from "@/services/noticeService";
import { Button } from "@/components/ui/button";
import getSystem from "@/utils/get-system";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Unplug,
  RefreshCw,
  Zap,
  Columns,
  ArchiveRestore,
  Link as LinkIcon,
  Timer,
  PlugZap,
} from "lucide-react";

type AutoLaunchMethod = "plugin" | "shortcut";

type MiscValues = {
  appLogLevel: string;
  autoCloseConnection: boolean;
  autoCheckUpdate: boolean;
  enableBuiltinEnhanced: boolean;
  proxyLayoutColumn: number;
  defaultLatencyTest: string;
  autoLogClean: 0 | 1 | 2 | 3 | 4;
  defaultLatencyTimeout: number;
  autoLaunchMethod: AutoLaunchMethod;
};

const normalizeAutoLaunchMethod = (
  method?: string | null,
): AutoLaunchMethod => (method === "shortcut" ? "shortcut" : "plugin");

interface Props {}

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

export const MiscViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { verge, patchVerge } = useVerge();
  const isWindows = getSystem() === "windows";

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<MiscValues>({
    appLogLevel: "warn",
    autoCloseConnection: true,
    autoCheckUpdate: true,
    enableBuiltinEnhanced: true,
    proxyLayoutColumn: 6,
    defaultLatencyTest: "",
    autoLogClean: 2,
    defaultLatencyTimeout: 10000,
    autoLaunchMethod: "plugin",
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValues({
        appLogLevel: verge?.app_log_level ?? "warn",
        autoCloseConnection: verge?.auto_close_connection ?? true,
        autoCheckUpdate: verge?.auto_check_update ?? true,
        enableBuiltinEnhanced: verge?.enable_builtin_enhanced ?? true,
        proxyLayoutColumn: verge?.proxy_layout_column || 6,
        defaultLatencyTest: verge?.default_latency_test || "",
        autoLogClean: verge?.auto_log_clean || 0,
        defaultLatencyTimeout: verge?.default_latency_timeout || 10000,
        autoLaunchMethod: normalizeAutoLaunchMethod(
          verge?.auto_launch_method ?? null,
        ),
      });
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    try {
      const payload: Partial<IVergeConfig> = {
        app_log_level: values.appLogLevel,
        auto_close_connection: values.autoCloseConnection,
        auto_check_update: values.autoCheckUpdate,
        enable_builtin_enhanced: values.enableBuiltinEnhanced,
        proxy_layout_column: Number(values.proxyLayoutColumn),
        default_latency_test: values.defaultLatencyTest,
        default_latency_timeout: Number(values.defaultLatencyTimeout),
        auto_log_clean: values.autoLogClean,
      };

      if (isWindows) {
        payload.auto_launch_method = values.autoLaunchMethod;
      }

      await patchVerge(payload);
      setOpen(false);
      showNotice("success", t("Saved Successfully"));
    } catch (err: any) {
      showNotice("error", err.toString());
    }
  });

  const handleValueChange = <K extends keyof MiscValues>(
    key: K,
    value: MiscValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Miscellaneous")}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-1 space-y-1">
          <SettingRow
            label={<LabelWithIcon icon={FileText} text={t("App Log Level")} />}
          >
            <Select
              value={values.appLogLevel}
              onValueChange={(v) => handleValueChange("appLogLevel", v)}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["trace", "debug", "info", "warn", "error", "silent"].map(
                  (i) => (
                    <SelectItem value={i} key={i}>
                      {i[0].toUpperCase() + i.slice(1).toLowerCase()}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label={
              <LabelWithIcon icon={Unplug} text={t("Auto Close Connections")} />
            }
            extra={<TooltipIcon tooltip={t("Auto Close Connections Info")} />}
          >
            <Switch
              checked={values.autoCloseConnection}
              onCheckedChange={(c) =>
                handleValueChange("autoCloseConnection", c)
              }
            />
          </SettingRow>

          <SettingRow
            label={
              <LabelWithIcon icon={RefreshCw} text={t("Auto Check Update")} />
            }
          >
            <Switch
              checked={values.autoCheckUpdate}
              onCheckedChange={(c) => handleValueChange("autoCheckUpdate", c)}
            />
          </SettingRow>

          {isWindows && (
            <SettingRow
              label={
                <LabelWithIcon
                  icon={PlugZap}
                  text={t("Auto Launch Method")}
                />
              }
              extra={<TooltipIcon tooltip={t("Auto Launch Method Info")} />}
            >
              <Select
                value={values.autoLaunchMethod}
                onValueChange={(v) =>
                  handleValueChange("autoLaunchMethod", v as AutoLaunchMethod)
                }
              >
                <SelectTrigger className="w-48 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plugin">
                    {t("Auto Launch Method Plugin")}
                  </SelectItem>
                  <SelectItem value="shortcut">
                    {t("Auto Launch Method Shortcut")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          )}

          <SettingRow
            label={
              <LabelWithIcon icon={Zap} text={t("Enable Builtin Enhanced")} />
            }
            extra={<TooltipIcon tooltip={t("Enable Builtin Enhanced Info")} />}
          >
            <Switch
              checked={values.enableBuiltinEnhanced}
              onCheckedChange={(c) =>
                handleValueChange("enableBuiltinEnhanced", c)
              }
            />
          </SettingRow>

          <SettingRow
            label={
              <LabelWithIcon icon={Columns} text={t("Proxy Layout Columns")} />
            }
          >
            <Select
              value={String(values.proxyLayoutColumn)}
              onValueChange={(v) =>
                handleValueChange("proxyLayoutColumn", Number(v))
              }
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">{t("Auto Columns")}</SelectItem>
                {[1, 2, 3, 4, 5].map((i) => (
                  <SelectItem value={String(i)} key={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label={
              <LabelWithIcon icon={ArchiveRestore} text={t("Auto Log Clean")} />
            }
          >
            <Select
              value={String(values.autoLogClean)}
              onValueChange={(v) =>
                handleValueChange(
                  "autoLogClean",
                  Number(v) as MiscValues["autoLogClean"],
                )
              }
            >
              <SelectTrigger className="w-48 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { key: t("Never Clean"), value: 0 },
                  { key: t("Retain _n Days", { n: 1 }), value: 1 },
                  { key: t("Retain _n Days", { n: 7 }), value: 2 },
                  { key: t("Retain _n Days", { n: 30 }), value: 3 },
                  { key: t("Retain _n Days", { n: 90 }), value: 4 },
                ].map((i) => (
                  <SelectItem key={i.value} value={String(i.value)}>
                    {i.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow
            label={
              <LabelWithIcon icon={LinkIcon} text={t("Default Latency Test")} />
            }
            extra={<TooltipIcon tooltip={t("Default Latency Test Info")} />}
          >
            <Input
              className="w-75 h-8"
              value={values.defaultLatencyTest}
              placeholder="https://www.google.com/generate_204"
              onChange={(e) =>
                handleValueChange("defaultLatencyTest", e.target.value)
              }
            />
          </SettingRow>

          <SettingRow
            label={
              <LabelWithIcon icon={Timer} text={t("Default Latency Timeout")} />
            }
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-24 h-8"
                value={values.defaultLatencyTimeout}
                placeholder="5000"
                onChange={(e) =>
                  handleValueChange(
                    "defaultLatencyTimeout",
                    Number(e.target.value),
                  )
                }
              />
              <span className="text-sm text-muted-foreground">
                {t("millis")}
              </span>
            </div>
          </SettingRow>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSave}>
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
