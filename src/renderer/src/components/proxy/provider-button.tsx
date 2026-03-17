import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLockFn } from "ahooks";
import { proxyProviderUpdate } from "@/services/api";
import { useAppData } from "@/providers/app-data-provider";
import { showNotice } from "@/services/noticeService";
import { Database, RefreshCw } from "lucide-react";
import dayjs from "dayjs";
import parseTraffic from "@/utils/parse-traffic";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// 定义代理提供者类型
interface ProxyProviderItem {
  name?: string;
  proxies: any[];
  updatedAt: number;
  vehicleType: string;
  subscriptionInfo?: {
    Upload: number;
    Download: number;
    Total: number;
    Expire: number;
  };
}

// 解析过期时间
const parseExpire = (expire?: number) => {
  if (!expire) return "-";
  return dayjs(expire * 1000).format("YYYY-MM-DD");
};

export const ProviderButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { proxyProviders, refreshProxy, refreshProxyProviders } = useAppData();
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  // 检查是否有提供者
  const hasProviders = Object.keys(proxyProviders || {}).length > 0;

  // 更新单个代理提供者
  const updateProvider = useLockFn(async (name: string) => {
    try {
      // 设置更新状态
      setUpdating((prev) => ({ ...prev, [name]: true }));

      await proxyProviderUpdate(name);

      // 刷新数据
      await refreshProxy();
      await refreshProxyProviders();

      showNotice("success", `${name} 更新成功`);
    } catch (err: any) {
      showNotice(
        "error",
        `${name} 更新失败: ${err?.message || err.toString()}`,
      );
    } finally {
      // 清除更新状态
      setUpdating((prev) => ({ ...prev, [name]: false }));
    }
  });

  // 更新所有代理提供者
  const updateAllProviders = useLockFn(async () => {
    try {
      // 获取所有provider的名称
      const allProviders = Object.keys(proxyProviders || {});
      if (allProviders.length === 0) {
        showNotice("info", "没有可更新的代理提供者");
        return;
      }

      // 设置所有provider为更新中状态
      const newUpdating = allProviders.reduce(
        (acc, key) => {
          acc[key] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      );
      setUpdating(newUpdating);

      // 改为串行逐个更新所有provider
      for (const name of allProviders) {
        try {
          await proxyProviderUpdate(name);
          // 每个更新完成后更新状态
          setUpdating((prev) => ({ ...prev, [name]: false }));
        } catch (err) {
          console.error(`更新 ${name} 失败`, err);
          // 继续执行下一个，不中断整体流程
        }
      }

      // 刷新数据
      await refreshProxy();
      await refreshProxyProviders();

      showNotice("success", "全部代理提供者更新成功");
    } catch (err: any) {
      showNotice("error", `更新失败: ${err?.message || err.toString()}`);
    } finally {
      // 清除所有更新状态
      setUpdating({});
    }
  });

  if (!hasProviders) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mr-1">
          <Database className="mr-2 h-4 w-4" />
          {t("Proxy Provider")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <div className="flex justify-between items-center">
              <span>{t("Proxy Provider")}</span>
              <Button
                variant="default"
                size="sm"
                onClick={updateAllProviders}
                disabled={Object.values(updating).some(Boolean)}
              >
                {t("Update All")}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto py-0 px-1 my-2">
          <div className="space-y-2">
            {Object.entries(proxyProviders || {}).map(([key, item]) => {
              const provider = item as ProxyProviderItem;
              const time = dayjs(provider.updatedAt);
              const isUpdating = updating[key];

              const sub = provider.subscriptionInfo;
              const hasSubInfo = !!sub;
              const upload = sub?.Upload || 0;
              const download = sub?.Download || 0;
              const total = sub?.Total || 0;
              const expire = sub?.Expire || 0;

              const progress =
                total > 0
                  ? Math.min(
                      Math.round(((download + upload) * 100) / total) + 1,
                      100,
                    )
                  : 0;

              const TypeBoxDisplay = ({
                children,
              }: {
                children: React.ReactNode;
              }) => (
                <span className="inline-block border border-border text-xs text-muted-foreground rounded px-1 py-0.5 mr-1">
                  {children}
                </span>
              );

              return (
                <div
                  key={key}
                  className="p-3 rounded-lg border bg-card text-card-foreground shadow-sm flex items-center"
                >
                  <div className="flex-grow space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center font-semibold truncate">
                        <span className="mr-2 truncate" title={key}>
                          {key}
                        </span>
                        <TypeBoxDisplay>
                          {provider.proxies.length}
                        </TypeBoxDisplay>
                        <TypeBoxDisplay>{provider.vehicleType}</TypeBoxDisplay>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        <small>{t("Update At")}: </small>
                        {time.fromNow()}
                      </div>
                    </div>
                    {hasSubInfo && (
                      <div className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span title={t("Used / Total") as string}>
                            {parseTraffic(upload + download)} /{" "}
                            {parseTraffic(total)}
                          </span>
                          <span title={t("Expire Time") as string}>
                            {parseExpire(expire)}
                          </span>
                        </div>
                        {total > 0 && (
                          <Progress value={progress} className="h-1.5" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="pl-3 ml-3 border-l border-border flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateProvider(key)}
                      disabled={isUpdating}
                      title={t("Update Provider") as string}
                      className={isUpdating ? "animate-spin" : ""}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
