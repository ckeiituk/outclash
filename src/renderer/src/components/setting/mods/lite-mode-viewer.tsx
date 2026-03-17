import { forwardRef, useImperativeHandle, useState } from "react";
import { useLockFn } from "ahooks";
import { useTranslation } from "react-i18next";
import { useVerge } from "@/hooks/use-verge";
import { entry_lightweight_mode } from "@/services/cmds";
import { showNotice } from "@/services/noticeService";

// Новые импорты
import { DialogRef, Switch } from "@/components/base";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";
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
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium">{label}</p>
      {extra && <div className="text-muted-foreground">{extra}</div>}
    </div>
    <div>{children}</div>
  </div>
);

export const LiteModeViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const { verge, patchVerge } = useVerge();

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    autoEnterLiteMode: false,
    autoEnterLiteModeDelay: 10,
  });

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setValues({
        autoEnterLiteMode: verge?.enable_auto_light_weight_mode ?? false,
        autoEnterLiteModeDelay: verge?.auto_light_weight_minutes ?? 10,
      });
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    try {
      await patchVerge({
        enable_auto_light_weight_mode: values.autoEnterLiteMode,
        auto_light_weight_minutes: values.autoEnterLiteModeDelay,
      });
      setOpen(false);
      showNotice("success", t("Saved Successfully"));
    } catch (err: any) {
      showNotice("error", err.message || err.toString());
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("LightWeight Mode Settings")}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-2">
          <SettingRow label={t("Enter LightWeight Mode Now")}>
            {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
            {/* Меняем variant="link" на "outline" для вида кнопки */}
            <Button
              variant="outline"
              size="sm"
              onClick={entry_lightweight_mode}
            >
              {t("Enable")}
            </Button>
            {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
          </SettingRow>

          <SettingRow
            label={t("Auto Enter LightWeight Mode")}
            extra={
              <TooltipIcon tooltip={t("Auto Enter LightWeight Mode Info")} />
            }
          >
            <Switch
              checked={values.autoEnterLiteMode}
              onCheckedChange={(c) =>
                setValues((v) => ({ ...v, autoEnterLiteMode: c }))
              }
            />
          </SettingRow>

          {values.autoEnterLiteMode && (
            <div className="pl-4">
              <SettingRow label={t("Auto Enter LightWeight Mode Delay")}>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24 h-8"
                    value={values.autoEnterLiteModeDelay}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        autoEnterLiteModeDelay: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("mins")}
                  </span>
                </div>
              </SettingRow>

              <p className="text-xs text-muted-foreground italic mt-2">
                {t(
                  "When closing the window, LightWeight Mode will be automatically activated after _n minutes",
                  { n: values.autoEnterLiteModeDelay },
                )}
              </p>
            </div>
          )}
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
