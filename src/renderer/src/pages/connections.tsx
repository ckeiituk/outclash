import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useLockFn } from "ahooks";
import { Virtuoso } from "react-virtuoso";
import { useTranslation } from "react-i18next";
import { useConnectionSetting } from "@/services/states";
import { useVisibility } from "@/hooks/use-visibility";
import { useAppData } from "@/providers/app-data-provider";
import { closeAllConnections } from "@/services/api";
import parseTraffic from "@/utils/parse-traffic";
import { cn } from "@root/lib/utils";

import { BaseEmpty } from "@/components/base";
import { ConnectionItem } from "@/components/connection/connection-item";
import { ConnectionTable } from "@/components/connection/connection-table";
import {
  ConnectionDetail,
  ConnectionDetailRef,
} from "@/components/connection/connection-detail";
import { BaseSearchBox } from "@/components/base/base-search-box";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  List,
  Table2,
  PlayCircle,
  PauseCircle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface IConnectionsItem {
  id: string;
  metadata: {
    host: string;
    destinationIP: string;
    process?: string;
  };
  start?: string;
  curUpload?: number;
  curDownload?: number;
}

interface IConnections {
  uploadTotal: number;
  downloadTotal: number;
  connections: IConnectionsItem[];
  data: IConnectionsItem[];
}

type OrderFunc = (list: IConnectionsItem[]) => IConnectionsItem[];

const initConn: IConnections = {
  uploadTotal: 0,
  downloadTotal: 0,
  connections: [],
  data: [],
};

const ConnectionsPage = () => {
  const { t } = useTranslation();
  const pageVisible = useVisibility();
  const [match, setMatch] = useState(() => (_: string) => true);
  const [curOrderOpt, setOrderOpt] = useState("Default");
  const { connections } = useAppData();
  const [setting, setSetting] = useConnectionSetting();
  const isTableLayout = setting.layout === "table";

  const orderOpts: Record<string, OrderFunc> = {
    Default: (list) =>
      list.sort(
        (a, b) =>
          new Date(b.start || "0").getTime()! -
          new Date(a.start || "0").getTime()!,
      ),
    "Upload Speed": (list) =>
      list.sort((a, b) => (b.curUpload ?? 0) - (a.curUpload ?? 0)),
    "Download Speed": (list) =>
      list.sort((a, b) => (b.curDownload ?? 0) - (a.curDownload ?? 0)),
  };

  const [isPaused, setIsPaused] = useState(false);
  const [frozenData, setFrozenData] = useState<IConnections | null>(null);

  const displayData = useMemo(() => {
    if (!pageVisible) return initConn;
    const currentData = {
      uploadTotal: connections.uploadTotal,
      downloadTotal: connections.downloadTotal,
      connections: connections.data,
      data: connections.data,
    };
    if (isPaused) return frozenData ?? currentData;
    return currentData;
  }, [isPaused, frozenData, connections, pageVisible]);

  const filterConn = useMemo(() => {
    const orderFunc = orderOpts[curOrderOpt];
    let conns = displayData.connections.filter((conn) => {
      const { host, destinationIP, process } = conn.metadata;
      return (
        match(host || "") || match(destinationIP || "") || match(process || "")
      );
    });
    if (orderFunc) conns = orderFunc(conns);
    return conns;
  }, [displayData, match, curOrderOpt]);

  const [scrollingElement, setScrollingElement] = useState<
    HTMLElement | Window | null
  >(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const scrollerRefCallback = useCallback(
    (node: HTMLElement | Window | null) => {
      setScrollingElement(node);
    },
    [],
  );

  useEffect(() => {
    if (!scrollingElement) return;
    const handleScroll = () => {
      const scrollTop =
        scrollingElement instanceof Window
          ? scrollingElement.scrollY
          : scrollingElement.scrollTop;
      setIsScrolled(scrollTop > 5);
    };

    scrollingElement.addEventListener("scroll", handleScroll);
    return () => scrollingElement.removeEventListener("scroll", handleScroll);
  }, [scrollingElement]);

  const onCloseAll = useLockFn(closeAllConnections);
  const detailRef = useRef<ConnectionDetailRef>(null!);
  const handleSearch = useCallback(
    (m: (content: string) => boolean) => setMatch(() => m),
    [],
  );
  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => {
      if (!prev) {
        setFrozenData({
          uploadTotal: connections.uploadTotal,
          downloadTotal: connections.downloadTotal,
          connections: connections.data,
          data: connections.data,
        });
      } else {
        setFrozenData(null);
      }
      return !prev;
    });
  }, [connections]);

  const headerHeight = "7rem";

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute top-0 left-0 right-0 z-20 p-4 bg-background/80 backdrop-blur-sm"
        style={{ height: headerHeight }}
      >
        <div className="flex justify-between items-center">
          <div className="w-10">
            <SidebarTrigger />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Connections")}
          </h2>
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ArrowDown className="h-4 w-4 text-green-500" />
                  {parseTraffic(displayData.downloadTotal)}
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUp className="h-4 w-4 text-sky-500" />
                  {parseTraffic(displayData.uploadTotal)}
                </div>
              </div>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setSetting((o) =>
                        o?.layout !== "table"
                          ? { ...o, layout: "table" }
                          : { ...o, layout: "list" },
                      )
                    }
                  >
                    {isTableLayout ? (
                      <List className="h-5 w-5" />
                    ) : (
                      <Table2 className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isTableLayout ? t("List View") : t("Table View")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePauseToggle}
                  >
                    {isPaused ? (
                      <PlayCircle className="h-5 w-5" />
                    ) : (
                      <PauseCircle className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPaused ? t("Resume") : t("Pause")}</p>
                </TooltipContent>
              </Tooltip>
              <Button size="sm" variant="destructive" onClick={onCloseAll}>
                {t("Close All")}
              </Button>
            </div>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {!isTableLayout && (
            <Select
              value={curOrderOpt}
              onValueChange={(value) => setOrderOpt(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("Sort by")} />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(orderOpts).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1">
            <BaseSearchBox onSearch={handleSearch} />
          </div>
        </div>
      </div>

      <div
        ref={scrollerRefCallback}
        className="absolute left-0 right-0 bottom-0 overflow-y-auto"
        style={{ top: headerHeight }}
      >
        {filterConn.length === 0 ? (
          <BaseEmpty />
        ) : isTableLayout ? (
          <div className="p-4 pt-0">
            <ConnectionTable
              connections={filterConn}
              onShowDetail={(detail) => detailRef.current?.open(detail)}
              scrollerRef={scrollerRefCallback}
            />
          </div>
        ) : (
          <Virtuoso
            scrollerRef={scrollerRefCallback}
            data={filterConn}
            className="h-full w-full"
            itemContent={(_, item) => (
              <ConnectionItem
                value={item}
                onShowDetail={() => detailRef.current?.open(item)}
              />
            )}
          />
        )}
        <ConnectionDetail ref={detailRef} />
      </div>
    </div>
  );
};

export default ConnectionsPage;
