import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const HwidErrorDialog = () => {
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleShowHwidError = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setErrorMessage(customEvent.detail);
    };

    window.addEventListener("show-hwid-error", handleShowHwidError);

    return () => {
      window.removeEventListener("show-hwid-error", handleShowHwidError);
    };
  }, []);

  if (!errorMessage) {
    return null;
  }

  return (
    <Dialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t("Device Limit Reached")}
          </DialogTitle>
          <DialogDescription className="pt-4 text-left">
            {errorMessage}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => setErrorMessage(null)}>{t("OK")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
