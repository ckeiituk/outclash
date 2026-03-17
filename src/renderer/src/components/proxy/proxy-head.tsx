// ProxyHead.tsx

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVerge } from "@/hooks/use-verge";
import type { HeadState } from "./use-head-state";
import type { ProxySortType } from "./use-filter-sort";
import delayManager from "@/services/delay";

// Утилиты и компоненты shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@root/lib/utils";

// Иконки
import {
  LocateFixed,
  Network,
  ArrowUpDown,
  Timer,
  ArrowDownAZ,
  Wifi,
  Eye,
  Filter,
} from "lucide-react";

interface Props {
  url?: string;
  groupName: string;
  headState: HeadState;
  onLocation: () => void;
  onCheckDelay: () => void;
  onHeadState: (val: Partial<HeadState>) => void;
}

export const ProxyHead = (props: Props) => {
  const { url, groupName, headState, onHeadState } = props;
  const { showType, sortType, filterText, textState, testUrl } = headState;
  const { t } = useTranslation();
  const { verge } = useVerge();

  const [autoFocus, setAutoFocus] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAutoFocus(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    delayManager.setUrl(
      groupName,
      testUrl || url || verge?.default_latency_test!,
    );
  }, [groupName, testUrl, url, verge?.default_latency_test]);

  const getToggleVariant = (isActive: boolean) =>
    isActive ? "secondary" : "ghost";

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-10 items-center justify-between px-2">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title={t("locate")}
                onClick={props.onLocation}
                className="h-8 w-8"
              >
                <LocateFixed className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Locate Current Proxy")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title={t("Delay check")}
                onClick={props.onCheckDelay}
                className="h-8 w-8"
              >
                <Network className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Check Group Latency")}</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  onHeadState({
                    sortType: ((sortType + 1) % 3) as ProxySortType,
                  })
                }
                className="h-8 w-8"
              >
                {sortType === 0 && <ArrowUpDown className="h-5 w-5" />}
                {sortType === 1 && <Timer className="h-5 w-5" />}
                {sortType === 2 && <ArrowDownAZ className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {
                  [t("Sort by default"), t("Sort by delay"), t("Sort by name")][
                    sortType
                  ]
                }
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onHeadState({ showType: !showType })}
                className="h-8 w-8"
              >
                <Eye className={cn("h-5 w-5", showType && "text-primary")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{showType ? t("Show Basic Info") : t("Show Detailed Info")}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={getToggleVariant(textState === "url")}
                size="icon"
                onClick={() =>
                  onHeadState({ textState: textState === "url" ? null : "url" })
                }
                className="h-8 w-8"
              >
                <Wifi className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Set Latency Test URL")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={getToggleVariant(textState === "filter")}
                size="icon"
                onClick={() =>
                  onHeadState({
                    textState: textState === "filter" ? null : "filter",
                  })
                }
                className="h-8 w-8"
              >
                <Filter className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("Filter by Name")}</p>
            </TooltipContent>
          </Tooltip>

          <div
            className={cn(
              "transition-all duration-300 ease-in-out",
              textState ? "w-48 ml-2" : "w-0",
            )}
          >
            {textState === "filter" && (
              <Input
                autoFocus={autoFocus}
                value={filterText}
                placeholder={t("Filter conditions")}
                onChange={(e) => onHeadState({ filterText: e.target.value })}
                className="h-8"
              />
            )}
            {textState === "url" && (
              <Input
                autoFocus={autoFocus}
                value={testUrl}
                placeholder={t("Delay check URL")}
                onChange={(e) => onHeadState({ testUrl: e.target.value })}
                className="h-8"
              />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
