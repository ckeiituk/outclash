import { Fragment } from "react";
import { useTranslation } from "react-i18next";

// Новые импорты
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { BaseEmpty } from "@/components/base";
import { cn } from "@root/lib/utils";

interface Props {
  open: boolean;
  logInfo: [string, string][];
  onClose: () => void;
}

export const LogViewer = (props: Props) => {
  const { open, logInfo, onClose } = props;
  const { t } = useTranslation();

  // Вспомогательная функция для определения варианта Badge
  const getLogLevelVariant = (level: string): "destructive" | "secondary" => {
    return level === "error" || level === "exception"
      ? "destructive"
      : "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Script Console")}</DialogTitle>
        </DialogHeader>

        {/* Контейнер для логов с прокруткой */}
        <div className="h-[300px] overflow-y-auto space-y-2 p-1">
          {logInfo.length > 0 ? (
            logInfo.map(([level, log], index) => (
              <div
                key={index}
                className="pb-2 border-b border-border last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <Badge variant={getLogLevelVariant(level)} className="mt-0.5">
                    {level}
                  </Badge>
                  {/* `whitespace-pre-wrap` сохраняет переносы строк и пробелы в логах */}
                  <p className="flex-1 text-sm whitespace-pre-wrap break-words font-mono">
                    {log}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <BaseEmpty />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("Close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
