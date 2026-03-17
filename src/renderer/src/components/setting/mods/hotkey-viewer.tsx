import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { useVerge } from "@/hooks/use-verge";
import { showNotice } from "@/services/noticeService";

// Новые импорты
import { DialogRef } from "@/components/base";
import { HotkeyInput } from "./hotkey-input"; // Наш обновленный компонент
import { Switch } from "@/components/ui/switch"; // Стандартный Switch
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const HOTKEY_FUNC = [
  "open_or_close_dashboard",
  "clash_mode_rule",
  "clash_mode_global",
  "clash_mode_direct",
  "toggle_system_proxy",
  "toggle_tun_mode",
  "entry_lightweight_mode",
];

export const HotkeyViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { verge, patchVerge } = useVerge();

  const [hotkeyMap, setHotkeyMap] = useState<Record<string, string[]>>({});
  const [enableGlobalHotkey, setEnableHotkey] = useState(true);

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setEnableHotkey(verge?.enable_global_hotkey ?? true);
      const map = {} as typeof hotkeyMap;
      verge?.hotkeys?.forEach((text) => {
        const [func, key] = text.split(",").map((e) => e.trim());
        if (!func || !key) return;
        map[func] = key
          .split("+")
          .map((e) => e.trim())
          .map((k) => (k === "PLUS" ? "+" : k));
      });
      setHotkeyMap(map);
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    const hotkeys = Object.entries(hotkeyMap)
      .map(([func, keys]) => {
        if (!func || !keys?.length) return "";
        const key = keys
          .map((k) => k.trim())
          .filter(Boolean)
          .map((k) => (k === "+" ? "PLUS" : k))
          .join("+");
        if (!key) return "";
        return `${func},${key}`;
      })
      .filter(Boolean);

    try {
      await patchVerge({
        hotkeys,
        enable_global_hotkey: enableGlobalHotkey,
      });
      setOpen(false);
      showNotice("success", t("Saved Successfully"));
    } catch (err: any) {
      showNotice("error", err.toString());
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Hotkey Setting")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-global-hotkey" className="font-medium">
              {t("Enable Global Hotkey")}
            </Label>
            <Switch
              id="enable-global-hotkey"
              checked={enableGlobalHotkey}
              onCheckedChange={setEnableHotkey}
            />
          </div>

          <Separator />

          {HOTKEY_FUNC.map((func) => (
            <div key={func} className="flex items-center justify-between">
              <Label className="text-muted-foreground">{t(func)}</Label>
              <HotkeyInput
                value={hotkeyMap[func] ?? []}
                onChange={(v) => setHotkeyMap((m) => ({ ...m, [func]: v }))}
              />
            </div>
          ))}
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
