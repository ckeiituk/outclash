import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn, useRequest } from "ahooks";
import { mutate } from "swr";
import { useClash, useClashInfo } from "@/hooks/use-clash";
import { useVerge } from "@/hooks/use-verge";
import { enhanceProfiles, restartCore } from "@/services/cmds";
import { showNotice } from "@/services/noticeService";
import getSystem from "@/utils/get-system";

// Новые импорты
import { DialogRef, Switch } from "@/components/base";
import { StackModeSwitch } from "./stack-mode-switch";
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
import {
  RotateCcw,
  Layers,
  Laptop,
  Route,
  RouteOff,
  Network,
  Dna,
  Gauge,
} from "lucide-react";

const OS = getSystem();
type StackMode = "mixed" | "gvisor" | "system";

// Компоненты-хелперы
const SettingRow = ({
  label,
  children,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium">{label}</div>
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

export const TunViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { clash, mutateClash, patchClash } = useClash();

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    stack: "gvisor" as StackMode,
    device: OS === "macos" ? "utun1024" : "Mihomo",
    autoRoute: true,
    autoDetectInterface: true,
    dnsHijack: ["any:53"],
    strictRoute: false,
    mtu: 1500,
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValues({
        // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
        // Добавляем утверждение типа, чтобы TypeScript был уверен в значении
        stack: (clash?.tun.stack as StackMode) ?? "gvisor",
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
        device: clash?.tun.device ?? (OS === "macos" ? "utun1024" : "Mihomo"),
        autoRoute: clash?.tun["auto-route"] ?? true,
        autoDetectInterface: clash?.tun["auto-detect-interface"] ?? true,
        dnsHijack: clash?.tun["dns-hijack"] ?? ["any:53"],
        strictRoute: clash?.tun["strict-route"] ?? false,
        mtu: clash?.tun.mtu ?? 1500,
      });
    },
    close: () => setOpen(false),
  }));

  const resetToDefaults = () => {
    setValues({
      stack: "gvisor",
      device: OS === "macos" ? "utun1024" : "Mihomo",
      autoRoute: true,
      autoDetectInterface: true,
      dnsHijack: ["any:53"],
      strictRoute: false,
      mtu: 1500,
    });
  };

  const onSave = useLockFn(async () => {
    try {
      const tun = {
        stack: values.stack,
        device:
          values.device === ""
            ? OS === "macos"
              ? "utun1024"
              : "Mihomo"
            : values.device,
        "auto-route": values.autoRoute,
        "auto-detect-interface": values.autoDetectInterface,
        "dns-hijack": values.dnsHijack[0] === "" ? [] : values.dnsHijack,
        "strict-route": values.strictRoute,
        mtu: values.mtu ?? 1500,
      };
      await patchClash({ tun });
      await mutateClash((old) => ({ ...(old! || {}), tun }), false);
      try {
        await enhanceProfiles();
        showNotice("success", t("Settings Applied"));
      } catch (err: any) {
        showNotice("error", err.message || err.toString());
      }
      setOpen(false);
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-between items-center pr-12">
            <DialogTitle>{t("Tun Mode")}</DialogTitle>
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("Reset to Default")}
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto space-y-1 px-1">
          <SettingRow label={<LabelWithIcon icon={Layers} text={t("Stack")} />}>
            <StackModeSwitch
              value={values.stack}
              onChange={(value) => setValues((v) => ({ ...v, stack: value }))}
            />
          </SettingRow>
          <SettingRow
            label={<LabelWithIcon icon={Laptop} text={t("Device")} />}
          >
            <Input
              className="h-8 w-40"
              value={values.device}
              placeholder="Mihomo"
              onChange={(e) =>
                setValues((v) => ({ ...v, device: e.target.value }))
              }
            />
          </SettingRow>
          <SettingRow
            label={<LabelWithIcon icon={Route} text={t("Auto Route")} />}
          >
            <Switch
              checked={values.autoRoute}
              onCheckedChange={(c) =>
                setValues((v) => ({ ...v, autoRoute: c }))
              }
            />
          </SettingRow>
          <SettingRow
            label={<LabelWithIcon icon={RouteOff} text={t("Strict Route")} />}
          >
            <Switch
              checked={values.strictRoute}
              onCheckedChange={(c) =>
                setValues((v) => ({ ...v, strictRoute: c }))
              }
            />
          </SettingRow>
          <SettingRow
            label={
              <LabelWithIcon icon={Network} text={t("Auto Detect Interface")} />
            }
          >
            <Switch
              checked={values.autoDetectInterface}
              onCheckedChange={(c) =>
                setValues((v) => ({ ...v, autoDetectInterface: c }))
              }
            />
          </SettingRow>
          <SettingRow
            label={<LabelWithIcon icon={Dna} text={t("DNS Hijack")} />}
          >
            <Input
              className="h-8 w-40"
              value={values.dnsHijack.join(",")}
              placeholder="any:53"
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  dnsHijack: e.target.value.split(","),
                }))
              }
            />
          </SettingRow>
          <SettingRow label={<LabelWithIcon icon={Gauge} text={t("MTU")} />}>
            <Input
              type="number"
              className="h-8 w-40"
              value={values.mtu}
              placeholder="1500"
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  mtu: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
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
