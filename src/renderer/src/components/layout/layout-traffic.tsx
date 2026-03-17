import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Database } from "lucide-react";
import { useClashInfo } from "@/hooks/use-clash";
import { useVerge } from "@/hooks/use-verge";
import { TrafficGraph, type TrafficRef } from "./traffic-graph";
import { useVisibility } from "@/hooks/use-visibility";
import parseTraffic from "@/utils/parse-traffic";
import useSWRSubscription from "swr/subscription";
import { createAuthSockette } from "@/utils/websocket";
import { useTranslation } from "react-i18next";
import { isDebugEnabled, gc } from "@/services/api";
import { cn } from "@root/lib/utils";

interface MemoryUsage {
  inuse: number;
  oslimit?: number;
}

// setup the traffic
export const LayoutTraffic = () => {
  const { t } = useTranslation();
  const { clashInfo } = useClashInfo();
  const { verge } = useVerge();

  // whether hide traffic graph
  const trafficGraph = verge?.traffic_graph ?? true;

  const trafficRef = useRef<TrafficRef>(null);
  const pageVisible = useVisibility();
  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    isDebugEnabled().then((flag) => setIsDebug(flag));
    return () => {};
  }, [isDebug]);

  const { data: traffic = { up: 0, down: 0 } } = useSWRSubscription<
    ITrafficItem,
    any,
    "getRealtimeTraffic" | null
  >(
    clashInfo && pageVisible ? "getRealtimeTraffic" : null,
    (_key, { next }) => {
      const { server = "", secret = "" } = clashInfo!;

      if (!server) {
        console.warn("[Traffic] 服务器地址为空，无法建立连接");
        next(null, { up: 0, down: 0 });
        return () => {};
      }

      console.log(`[Traffic] 正在连接: ${server}/traffic`);

      const s = createAuthSockette(`${server}/traffic`, secret, {
        timeout: 8000, // 8秒超时
        onmessage(event) {
          const data = JSON.parse(event.data) as ITrafficItem;
          trafficRef.current?.appendData(data);
          next(null, data);
        },
        onerror(event) {
          console.error("[Traffic] WebSocket 连接错误", event);
          this.close();
          next(null, { up: 0, down: 0 });
        },
        onclose(event) {
          console.log("[Traffic] WebSocket 连接关闭", event);
        },
        onopen(event) {
          console.log("[Traffic] WebSocket 连接已建立");
        },
      });

      return () => {
        console.log("[Traffic] 清理WebSocket连接");
        try {
          s.close();
        } catch (e) {
          console.error("[Traffic] 关闭连接时出错", e);
        }
      };
    },
    {
      fallbackData: { up: 0, down: 0 },
      keepPreviousData: true,
    },
  );

  /* --------- meta memory information --------- */

  const displayMemory = verge?.enable_memory_usage ?? true;

  const { data: memory = { inuse: 0 } } = useSWRSubscription<
    MemoryUsage,
    any,
    "getRealtimeMemory" | null
  >(
    clashInfo && pageVisible && displayMemory ? "getRealtimeMemory" : null,
    (_key, { next }) => {
      const { server = "", secret = "" } = clashInfo!;

      if (!server) {
        console.warn("[Memory] 服务器地址为空，无法建立连接");
        next(null, { inuse: 0 });
        return () => {};
      }

      console.log(`[Memory] 正在连接: ${server}/memory`);

      const s = createAuthSockette(`${server}/memory`, secret, {
        timeout: 8000, // 8秒超时
        onmessage(event) {
          const data = JSON.parse(event.data) as MemoryUsage;
          next(null, data);
        },
        onerror(event) {
          console.error("[Memory] WebSocket 连接错误", event);
          this.close();
          next(null, { inuse: 0 });
        },
        onclose(event) {
          console.log("[Memory] WebSocket 连接关闭", event);
        },
        onopen(event) {
          console.log("[Memory] WebSocket 连接已建立");
        },
      });

      return () => {
        console.log("[Memory] 清理WebSocket连接");
        try {
          s.close();
        } catch (e) {
          console.error("[Memory] 关闭连接时出错", e);
        }
      };
    },
    {
      fallbackData: { inuse: 0 },
      keepPreviousData: true,
    },
  );

  const [up, upUnit] = parseTraffic(traffic.up);
  const [down, downUnit] = parseTraffic(traffic.down);
  const [inuse, inuseUnit] = parseTraffic(memory.inuse);

  return (
    <div className="relative">
      {trafficGraph && pageVisible && (
        <div
          className="mb-1.5 h-[60px] w-full"
          onClick={trafficRef.current?.toggleStyle}
        >
          <TrafficGraph ref={trafficRef} />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <div
          title={t("Upload Speed")}
          className="flex items-center whitespace-nowrap"
        >
          <ArrowUp
            className={cn(
              "mr-2 h-4 w-4",
              +up > 0 ? "text-secondary" : "text-muted-foreground",
            )}
          />
          <span className="w-[56px] flex-1 select-none text-center text-secondary">
            {up}
          </span>
          <span className="w-[27px] flex-none select-none text-right text-xs text-muted-foreground">
            {upUnit}/s
          </span>
        </div>

        <div
          title={t("Download Speed")}
          className="flex items-center whitespace-nowrap"
        >
          <ArrowDown
            className={cn(
              "mr-2 h-4 w-4",
              +down > 0 ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span className="w-[56px] flex-1 select-none text-center text-primary">
            {down}
          </span>
          <span className="w-[27px] flex-none select-none text-right text-xs text-muted-foreground">
            {downUnit}/s
          </span>
        </div>

        {displayMemory && (
          <div
            title={t(isDebug ? "Memory Cleanup" : "Memory Usage")}
            className={cn(
              "flex items-center whitespace-nowrap",
              isDebug
                ? "cursor-pointer text-green-500"
                : "text-muted-foreground",
            )}
            onClick={async () => {
              isDebug && (await gc());
            }}
          >
            <Database className="mr-2 h-4 w-4" />
            <span className="w-[56px] flex-1 select-none text-center">
              {inuse}
            </span>
            <span className="w-[27px] flex-none select-none text-right text-xs">
              {inuseUnit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
