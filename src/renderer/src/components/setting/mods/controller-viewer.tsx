import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { useClashInfo } from "@/hooks/use-clash";
import { showNotice } from "@/services/noticeService";

// Новые импорты
import { DialogRef } from "@/components/base";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Loader2 } from "lucide-react";

export const ControllerViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { clashInfo, patchInfo } = useClashInfo();
  const [controller, setController] = useState("");
  const [secret, setSecret] = useState("");

  useImperativeHandle(ref, () => ({
    open: async () => {
      setController(clashInfo?.server || "");
      setSecret(clashInfo?.secret || "");
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  const onSave = useLockFn(async () => {
    if (!controller.trim()) {
      showNotice("error", t("Controller address cannot be empty"));
      return;
    }
    // Секрет может быть пустым
    // if (!secret.trim()) {
    //   showNotice("error", t("Secret cannot be empty"));
    //   return;
    // }
    try {
      setIsSaving(true);
      await patchInfo({ "external-controller": controller, secret });
      showNotice("success", t("Configuration saved successfully"));
      setOpen(false);
    } catch (err: any) {
      showNotice(
        "error",
        err.message || t("Failed to save configuration"),
        4000,
      );
    } finally {
      setIsSaving(false);
    }
  });

  const handleCopyToClipboard = useLockFn(
    async (text: string, type: string) => {
      try {
        await navigator.clipboard.writeText(text);
        // --- ИЗМЕНЕНИЕ: Используем showNotice вместо Snackbar ---
        const message =
          type === "controller"
            ? t("Controller address copied to clipboard")
            : t("Secret copied to clipboard");
        showNotice("success", message);
      } catch (err) {
        showNotice("error", t("Failed to copy"));
      }
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("External Controller")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="controller-address">
              {t("External Controller")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="controller-address"
                value={controller}
                placeholder="127.0.0.1:9090"
                onChange={(e) => setController(e.target.value)}
                disabled={isSaving}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleCopyToClipboard(controller, "controller")
                      }
                      disabled={isSaving}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("Copy to clipboard")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="core-secret">{t("Core Secret")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="core-secret"
                value={secret}
                placeholder={t("Recommended")}
                onChange={(e) => setSecret(e.target.value)}
                disabled={isSaving}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToClipboard(secret, "secret")}
                      disabled={isSaving}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("Copy to clipboard")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
