import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface BridgeRelease {
  version: string;
  download_url: string;
  body: string;
}

interface BridgeProgress {
  downloaded: number;
  total: number;
  phase: string;
}

export function BridgeDialog() {
  const { t } = useTranslation();
  const [release, setRelease] = useState<BridgeRelease | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<BridgeProgress>({
    downloaded: 0,
    total: 0,
    phase: "downloading",
  });
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("bridge-dismissed") === "1",
  );

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("bridge-dismissed", "1");
  };

  useEffect(() => {
    if (dismissed) return;
    invoke<BridgeRelease | null>("bridge_check")
      .then((r) => {
        if (r) setRelease(r);
      })
      .catch(() => {});
  }, [dismissed]);

  // Allow settings "Check for Updates" to trigger this dialog immediately
  useEffect(() => {
    const handleRecheck = (e: Event) => {
      const detail = (e as CustomEvent<BridgeRelease>).detail;
      if (detail) setRelease(detail);
      setDismissed(false);
    };
    window.addEventListener("bridge-recheck", handleRecheck);
    return () => window.removeEventListener("bridge-recheck", handleRecheck);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<BridgeProgress>("bridge-progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const handleUpdate = async () => {
    if (!release) return;
    setDownloading(true);
    try {
      await invoke("bridge_download", { url: release.download_url });
      // Installer launched — dismiss dialog, app stays running.
      // The installer will ask the user to close when they click Install.
      dismiss();
    } catch {
      setDownloading(false);
    }
  };

  const handleCancel = () => {
    setDownloading(false);
    dismiss();
  };

  if (!release || dismissed) return null;

  const isInstalling = progress.phase === "installing";
  const pct =
    progress.total > 0 ? (progress.downloaded / progress.total) * 100 : 0;
  const downloadedMB = (progress.downloaded / 1024 / 1024).toFixed(1);
  const totalMB = (progress.total / 1024 / 1024).toFixed(1);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => !open && !downloading && dismiss()}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!downloading}>
        <DialogHeader>
          <DialogTitle>
            {isInstalling
              ? t("Launching installer...")
              : downloading
                ? t("Downloading new version...")
                : `OutClash v${release.version} available`}
          </DialogTitle>
        </DialogHeader>

        {downloading ? (
          <div className="space-y-2 py-4">
            {isInstalling ? (
              <p className="text-xs text-muted-foreground text-center">
                {t("Please wait, the installer will open shortly...")}
              </p>
            ) : (
              <>
                <Progress value={pct} />
                <p className="text-xs text-muted-foreground text-center">
                  {downloadedMB} / {totalMB} MB ({Math.round(pct)}%)
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="py-4 text-sm text-muted-foreground">
            <p>
              A major update with a new engine is available. The installer will
              open automatically — your profiles will be migrated.
            </p>
          </div>
        )}

        <DialogFooter>
          {downloading && !isInstalling ? (
            <Button variant="ghost" onClick={handleCancel}>
              {t("Cancel")}
            </Button>
          ) : !downloading ? (
            <>
              <Button variant="ghost" onClick={() => dismiss()}>
                {t("Later")}
              </Button>
              <Button onClick={handleUpdate}>{t("Update")}</Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
