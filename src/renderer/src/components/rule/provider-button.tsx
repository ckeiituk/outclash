import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import dayjs from "dayjs";
import { useAppData } from "@/providers/app-data-provider";
import { ruleProviderUpdate } from "@/services/api";
import { showNotice } from "@/services/noticeService";

// Компоненты shadcn/ui
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// Иконки
import { Database, RefreshCw } from "lucide-react";
import { cn } from "@root/lib/utils";

// Интерфейс для провайдера (взят из вашего файла)
interface RuleProviderItem {
  behavior: string;
  ruleCount: number;
  updatedAt: number;
  vehicleType: string;
}

export const ProviderButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { ruleProviders, refreshRules, refreshRuleProviders } = useAppData();
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const hasProviders = ruleProviders && Object.keys(ruleProviders).length > 0;

  const updateProvider = useLockFn(async (name: string) => {
    try {
      setUpdating((prev) => ({ ...prev, [name]: true }));
      await ruleProviderUpdate(name);
      await refreshRules();
      await refreshRuleProviders();
      showNotice("success", `${name} ${t("Update Successful")}`);
    } catch (err: any) {
      showNotice(
        "error",
        `${name} ${t("Update Failed")}: ${err?.message || err.toString()}`,
      );
    } finally {
      setUpdating((prev) => ({ ...prev, [name]: false }));
    }
  });

  const updateAllProviders = useLockFn(async () => {
    const allProviders = Object.keys(ruleProviders || {});
    if (allProviders.length === 0) return;

    const newUpdating = allProviders.reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {},
    );
    setUpdating(newUpdating);

    for (const name of allProviders) {
      try {
        await ruleProviderUpdate(name);
      } catch (err) {
        console.error(`Failed to update ${name}`, err);
      }
    }

    await refreshRules();
    await refreshRuleProviders();
    setUpdating({});
    showNotice("success", t("All Rule Providers Updated"));
  });

  if (!hasProviders) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Database className="h-5 w-5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("Rule Provider")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
          {/* Убираем justify-between и используем gap для отступа */}
          <div className="flex items-center gap-4">
            <DialogTitle>{t("Rule Providers")}</DialogTitle>
            <Button size="sm" onClick={updateAllProviders}>
              {t("Update All")}
            </Button>
          </div>
          {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 py-4 space-y-2">
          {Object.entries(ruleProviders || {}).map(([key, item]) => {
            const provider = item as RuleProviderItem;
            const time = dayjs(provider.updatedAt);
            const isUpdating = updating[key];

            return (
              <div
                key={key}
                className="flex items-center rounded-lg border bg-card p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate" title={key}>
                        {key}
                      </p>
                      <Badge variant="secondary">{provider.ruleCount}</Badge>
                    </div>
                    <p
                      className="text-xs text-muted-foreground"
                      title={time.format("YYYY-MM-DD HH:mm:ss")}
                    >
                      {t("Update At")}: {time.fromNow()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{provider.vehicleType}</Badge>
                    <Badge variant="outline">{provider.behavior}</Badge>
                  </div>
                </div>

                <Separator orientation="vertical" className="h-8 mx-4" />

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateProvider(key)}
                        disabled={isUpdating}
                      >
                        <RefreshCw
                          className={cn(
                            "h-5 w-5",
                            isUpdating && "animate-spin",
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("Update Provider")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("Close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
